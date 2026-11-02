import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { z } from 'zod';
import type { WorkspaceRole, inviteMemberSchema, workspaceSettingsSchema } from '@openlet/shared';
import { ROLE_LABELS } from '@openlet/shared';
import { config } from '../config.js';
import { PrismaService } from '../prisma.service.js';
import { ActivityService } from '../common/activity.service.js';
import { RateLimitService } from '../common/rate-limit.service.js';
import type { StaffContext, UserContext } from '../common/auth-context.js';
import { randomToken, sha256 } from '../common/crypto.js';
import { readSettings } from '../common/settings.js';
import { MailService } from '../mail/mail.service.js';
import { email } from '../mail/templates.js';
import type { Prisma } from '../generated/prisma/client.js';
import { createWorkspace } from './create-workspace.js';
import { StorageService } from '../files/storage.service.js';
import { StreamableFile } from '@nestjs/common';

export const INVITE_TTL_MS = 7 * 24 * 3600 * 1000;

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly mail: MailService,
    private readonly limits: RateLimitService,
    private readonly storage: StorageService,
  ) {}

  /** An Owner can add more workspaces; anyone can when sign-up is open. Never in the demo. */
  async create(user: UserContext, name: string) {
    if (user.isDemo || config().DEMO_MODE) throw new ForbiddenException({ message: 'New workspaces can’t be created in the demo.' });
    const isOwner = await this.prisma.membership.findFirst({ where: { userId: user.userId, role: 'OWNER' } });
    if (!isOwner && !config().SIGNUP_ENABLED) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Only an Owner can create a new workspace.' });
    const ws = await this.prisma.$transaction((tx) => createWorkspace(tx, user.userId, name, user.email));
    await this.activity.audit({ workspaceId: ws.id, userId: user.userId, action: 'workspace.created', ip: user.ip });
    return { id: ws.id, name: ws.name, role: 'OWNER' as WorkspaceRole };
  }

  async current(ctx: StaffContext) {
    const ws = await this.prisma.workspace.findUniqueOrThrow({ where: { id: ctx.workspaceId } });
    return {
      id: ws.id,
      name: ws.name,
      contactEmail: ws.contactEmail,
      contactPhone: ws.contactPhone,
      address: ws.address,
      hasLogo: !!ws.logoKey,
      role: ctx.role,
      settings: readSettings(ws.settings),
    };
  }

  async updateSettings(ctx: StaffContext, input: z.infer<typeof workspaceSettingsSchema>) {
    const { name, contactEmail, contactPhone, address, ...settings } = input;
    await this.prisma.workspace.update({
      where: { id: ctx.workspaceId },
      data: { name, contactEmail, contactPhone, address, settings: settings as unknown as Prisma.InputJsonValue },
    });
    await this.activity.record({ workspaceId: ctx.workspaceId, actor: { type: 'STAFF', id: ctx.userId, name: ctx.name }, action: 'settings.updated', summary: 'Updated workspace settings' });
    return this.current(ctx);
  }

  async remove(ctx: StaffContext, confirmName: string) {
    const ws = await this.prisma.workspace.findUniqueOrThrow({ where: { id: ctx.workspaceId } });
    if (ctx.isDemo) throw new ForbiddenException({ message: 'The demo workspace can’t be deleted.' });
    if (confirmName.trim() !== ws.name.trim()) {
      throw new BadRequestException({ code: 'CONFIRM_MISMATCH', message: 'Type the workspace name exactly to confirm.', field: 'confirmName' });
    }
    const files = await this.prisma.document.findMany({ where: { workspaceId: ws.id }, select: { storageKey: true } });
    const exportsFiles = await this.prisma.exportJob.findMany({ where: { workspaceId: ws.id, storageKey: { not: null } }, select: { storageKey: true } });
    // The audit row survives the delete (its workspaceId becomes null).
    await this.activity.audit({ workspaceId: ws.id, userId: ctx.userId, action: 'workspace.deleted', targetType: 'workspace', targetId: ws.id, ip: ctx.ip });
    await this.prisma.workspace.delete({ where: { id: ws.id } });
    const keys = [...files.map((f) => f.storageKey), ...exportsFiles.map((f) => f.storageKey!), ...(ws.logoKey ? [ws.logoKey] : [])];
    await Promise.all(keys.map((k) => this.storage.remove(k)));
    return { ok: true };
  }

  /** PNG or JPEG, re-encoded (metadata stripped). Replaces the old logo. */
  async setLogo(ctx: StaffContext, file: Express.Multer.File | undefined) {
    const stored = await this.storage.saveUpload(file, { imagesOnly: true });
    if (stored.needsConversion) {
      await this.storage.remove(stored.key);
      throw new BadRequestException({ code: 'BAD_TYPE', message: 'Upload the logo as a PNG or JPEG.' });
    }
    const ws = await this.prisma.workspace.findUniqueOrThrow({ where: { id: ctx.workspaceId }, select: { logoKey: true } });
    await this.prisma.workspace.update({ where: { id: ctx.workspaceId }, data: { logoKey: stored.key, logoMime: stored.mime } });
    if (ws.logoKey) await this.storage.remove(ws.logoKey);
    return { ok: true };
  }

  /** Logos are public branding (shown on emails, PDFs and the portal), served by workspace id. */
  async logo(workspaceId: string) {
    const ws = await this.prisma.workspace.findUnique({ where: { id: workspaceId }, select: { logoKey: true, logoMime: true } });
    if (!ws?.logoKey) throw new NotFoundException({ message: 'No logo.' });
    return new StreamableFile(await this.storage.stream(ws.logoKey), { type: ws.logoMime ?? 'image/png' });
  }

  // ---------- Team ----------

  async members(ctx: StaffContext) {
    const [members, invites] = await Promise.all([
      this.prisma.membership.findMany({
        where: { workspaceId: ctx.workspaceId },
        orderBy: { createdAt: 'asc' },
        select: { id: true, role: true, createdAt: true, user: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.invite.findMany({
        where: { workspaceId: ctx.workspaceId, kind: 'MEMBER', acceptedAt: null, revokedAt: null },
        orderBy: { createdAt: 'desc' },
        select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
      }),
    ]);
    return {
      members: members.map((m) => ({ id: m.id, userId: m.user.id, name: m.user.name, email: m.user.email, role: m.role, joinedAt: m.createdAt, isYou: m.user.id === ctx.userId })),
      invites: invites.map((i) => ({ ...i, expired: i.expiresAt < new Date() })),
    };
  }

  async invite(ctx: StaffContext, input: z.infer<typeof inviteMemberSchema>) {
    await this.limits.hit(`invite:send:${ctx.workspaceId}`, 30, 3600);
    const already = await this.prisma.membership.findFirst({ where: { workspaceId: ctx.workspaceId, user: { email: input.email } } });
    if (already) throw new ConflictException({ message: 'That person is already in the team.', field: 'email' });
    const ws = await this.prisma.workspace.findUniqueOrThrow({ where: { id: ctx.workspaceId }, select: { name: true } });
    const token = randomToken(32);
    await this.prisma.$transaction([
      this.prisma.invite.updateMany({ where: { workspaceId: ctx.workspaceId, kind: 'MEMBER', email: input.email, acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } }),
      this.prisma.invite.create({
        data: { workspaceId: ctx.workspaceId, kind: 'MEMBER', email: input.email, role: input.role, tokenHash: sha256(token), invitedById: ctx.userId, expiresAt: new Date(Date.now() + INVITE_TTL_MS) },
      }),
    ]);
    await this.mail.send({
      to: input.email,
      workspaceId: ctx.workspaceId,
      ...email({
        subject: `${ctx.name} invited you to ${ws.name} on OpenLet`,
        from: ws.name,
        heading: `Join ${ws.name} on OpenLet`,
        paragraphs: [`${ctx.name} has invited you to join the team as ${ROLE_LABELS[input.role]}.`, 'The invite works for 7 days.'],
        button: { label: 'Accept the invite', url: `${config().APP_URL}/invite/${token}` },
      }),
    });
    await this.activity.audit({ workspaceId: ctx.workspaceId, userId: ctx.userId, action: 'member.invited', targetType: 'invite', ip: ctx.ip });
    return { ok: true };
  }

  async revokeInvite(ctx: StaffContext, id: string) {
    const res = await this.prisma.invite.updateMany({ where: { id, workspaceId: ctx.workspaceId, acceptedAt: null }, data: { revokedAt: new Date() } });
    if (!res.count) throw new NotFoundException({ message: 'Invite not found.' });
    return { ok: true };
  }

  private async member(ctx: StaffContext, id: string) {
    const m = await this.prisma.membership.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
    if (!m) throw new NotFoundException({ message: 'Team member not found.' });
    return m;
  }

  private async assertAnotherOwner(ctx: StaffContext, membershipId: string) {
    const owners = await this.prisma.membership.count({ where: { workspaceId: ctx.workspaceId, role: 'OWNER', NOT: { id: membershipId } } });
    if (!owners) throw new BadRequestException({ code: 'LAST_OWNER', message: 'A workspace needs at least one Owner. Make someone else an Owner first.' });
  }

  async changeRole(ctx: StaffContext, id: string, role: WorkspaceRole) {
    const m = await this.member(ctx, id);
    if (m.role === 'OWNER' && role !== 'OWNER') await this.assertAnotherOwner(ctx, m.id);
    await this.prisma.membership.update({ where: { id: m.id }, data: { role } });
    await this.activity.audit({ workspaceId: ctx.workspaceId, userId: ctx.userId, action: `member.role.${role.toLowerCase()}`, targetType: 'membership', targetId: m.id, ip: ctx.ip });
    return { ok: true };
  }

  async removeMember(ctx: StaffContext, id: string) {
    const m = await this.member(ctx, id);
    if (m.role === 'OWNER') await this.assertAnotherOwner(ctx, m.id);
    await this.prisma.membership.delete({ where: { id: m.id } });
    await this.activity.audit({ workspaceId: ctx.workspaceId, userId: ctx.userId, action: 'member.removed', targetType: 'membership', targetId: m.id, ip: ctx.ip });
    return { ok: true };
  }

  async auditLog(ctx: StaffContext, page: number) {
    const take = 50;
    const rows = await this.prisma.auditLog.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * take,
      take: take + 1,
    });
    const userIds = [...new Set(rows.map((r) => r.userId).filter(Boolean))] as string[];
    const users = await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } });
    const names = new Map(users.map((u) => [u.id, u.name]));
    return {
      items: rows.slice(0, take).map((r) => ({ id: r.id, action: r.action, targetType: r.targetType, who: r.userId ? (names.get(r.userId) ?? 'Former user') : 'System', ip: r.ip, at: r.createdAt })),
      hasMore: rows.length > take,
    };
  }
}

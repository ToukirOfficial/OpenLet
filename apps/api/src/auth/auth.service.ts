import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { Response } from 'express';
import type { z } from 'zod';
import type { acceptInviteSchema, loginSchema, resetConfirmSchema, setupSchema } from '@openlet/shared';
import { config } from '../config.js';
import { PrismaService } from '../prisma.service.js';
import { ActivityService } from '../common/activity.service.js';
import { RateLimitService } from '../common/rate-limit.service.js';
import { keyedHash, randomCode, randomToken, sha256, signPayload, verifyPayload } from '../common/crypto.js';
import { MailService } from '../mail/mail.service.js';
import { email } from '../mail/templates.js';
import { createWorkspace } from '../workspaces/create-workspace.js';
import { dummyHash, hashPassword, verifyPassword } from './passwords.js';
import { SessionService } from './session.service.js';

const CODE_TTL_MS = 10 * 60 * 1000;
const RESET_TTL_MS = 30 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;

type Meta = { ip: string | null; res: Response; deviceToken?: string };
export type LoginResult = { status: 'ok' } | { status: 'code'; challenge: string; email: string };

const invalidLogin = () => new UnauthorizedException({ code: 'INVALID_LOGIN', message: 'That email and password don’t match.' });

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly mail: MailService,
    private readonly limits: RateLimitService,
    private readonly activity: ActivityService,
  ) {}

  // ---------- First-run setup and sign-up ----------

  async setupStatus() {
    const done = await this.prisma.installState.findUnique({ where: { id: 1 } });
    return { setupNeeded: !done, signupEnabled: config().SIGNUP_ENABLED, demoMode: config().DEMO_MODE };
  }

  /** The very first visitor creates the Owner and the first workspace. Afterwards this is closed for good. */
  async setup(input: z.infer<typeof setupSchema>, meta: Meta) {
    await this.limits.hit(`setup:${meta.ip}`, 10, 3600);
    const passwordHash = await hashPassword(input.password);
    const user = await this.prisma.$transaction(async (tx) => {
      // The insert of row id=1 is the lock: a second setup at the same moment fails on the primary key.
      const done = await tx.installState.findUnique({ where: { id: 1 } });
      if (done) throw new ForbiddenException({ code: 'SETUP_DONE', message: 'OpenLet is already set up. Please log in.' });
      await tx.installState.create({ data: { id: 1, completedAt: new Date() } });
      if (await tx.user.findUnique({ where: { email: input.email } })) throw new ConflictException({ message: 'That email is already in use.' });
      const created = await tx.user.create({ data: { email: input.email, name: input.name, passwordHash } });
      await createWorkspace(tx, created.id, input.workspaceName, input.email);
      return created;
    });
    await this.activity.audit({ userId: user.id, action: 'setup.completed', ip: meta.ip });
    await this.sessions.start(user.id, meta.res);
    await this.sessions.trustDevice(user.id, meta.res);
    return { status: 'ok' as const };
  }

  /** Only when SIGNUP_ENABLED=true (a hosted service). The first login sends an email code, which confirms the address. */
  async signup(input: z.infer<typeof setupSchema>, meta: Meta) {
    if (!config().SIGNUP_ENABLED) throw new ForbiddenException({ code: 'SIGNUP_CLOSED', message: 'Sign-up is closed on this site.' });
    await this.limits.hit(`signup:${meta.ip}`, 10, 3600);
    if (await this.prisma.user.findUnique({ where: { email: input.email } })) {
      throw new ConflictException({ code: 'EMAIL_TAKEN', message: 'An account with that email already exists. Please log in.' });
    }
    const passwordHash = await hashPassword(input.password);
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({ data: { email: input.email, name: input.name, passwordHash } });
      await createWorkspace(tx, created.id, input.workspaceName, input.email);
      await tx.installState.upsert({ where: { id: 1 }, create: { id: 1, completedAt: new Date() }, update: {} });
      return created;
    });
    await this.activity.audit({ userId: user.id, action: 'signup.completed', ip: meta.ip });
    return { status: 'created' as const, email: user.email };
  }

  // ---------- Login with email code on new devices ----------

  async login(input: z.infer<typeof loginSchema>, meta: Meta): Promise<LoginResult> {
    await this.limits.hit(`login:ip:${meta.ip}`, 30, 900);
    await this.limits.hit(`login:email:${sha256(input.email)}`, 10, 900);
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    const ok = user ? await verifyPassword(user.passwordHash, input.password) : (await verifyPassword(await dummyHash(), input.password), false);
    if (!user || !ok) {
      await this.activity.audit({ userId: user?.id ?? null, action: 'login.failed', ip: meta.ip });
      throw invalidLogin();
    }
    // Demo accounts and trusted browsers skip the code.
    if (user.isDemo || (await this.sessions.isTrusted(user.id, meta.deviceToken))) {
      await this.completeLogin(user.id, meta, false);
      return { status: 'ok' };
    }
    return this.sendLoginCode(user);
  }

  private async sendLoginCode(user: { id: string; email: string; name: string }): Promise<LoginResult> {
    await this.limits.hit(`code:send:${user.id}`, 5, 900);
    const code = randomCode();
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.authCode.updateMany({ where: { userId: user.id, purpose: 'LOGIN', consumedAt: null }, data: { consumedAt: new Date() } });
      return tx.authCode.create({
        data: { userId: user.id, purpose: 'LOGIN', codeHash: keyedHash(code), expiresAt: new Date(Date.now() + CODE_TTL_MS) },
      });
    });
    await this.mail.send({
      to: user.email,
      ...email({
        subject: `${code} is your OpenLet login code`,
        from: 'OpenLet',
        heading: 'Your login code',
        paragraphs: [`Hello ${user.name},`, `Your code is ${code}. It works for 10 minutes.`, 'If you didn’t try to log in, you can ignore this email.'],
      }),
    });
    return { status: 'code', challenge: signPayload({ cid: row.id, uid: user.id }, 15 * 60), email: user.email };
  }

  async resendCode(challenge: string): Promise<LoginResult> {
    const data = verifyPayload<{ uid: string }>(challenge);
    if (!data) throw new BadRequestException({ code: 'CHALLENGE_EXPIRED', message: 'That login has expired. Please log in again.' });
    const user = await this.prisma.user.findUnique({ where: { id: data.uid } });
    if (!user) throw new BadRequestException({ code: 'CHALLENGE_EXPIRED', message: 'That login has expired. Please log in again.' });
    return this.sendLoginCode(user);
  }

  async verifyCode(challenge: string, code: string, meta: Meta) {
    const data = verifyPayload<{ cid: string; uid: string }>(challenge);
    const expired = () => new BadRequestException({ code: 'CHALLENGE_EXPIRED', message: 'That code has expired. Please log in again.' });
    if (!data) throw expired();
    await this.limits.hit(`code:verify:${data.uid}`, 10, 900);
    const row = await this.prisma.authCode.findUnique({ where: { id: data.cid } });
    if (!row || row.userId !== data.uid || row.purpose !== 'LOGIN' || row.consumedAt || row.expiresAt < new Date() || row.attempts >= MAX_CODE_ATTEMPTS) {
      throw expired();
    }
    if (row.codeHash !== keyedHash(code)) {
      await this.prisma.authCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
      throw new BadRequestException({ code: 'WRONG_CODE', message: 'That code isn’t right. Check the email and try again.', field: 'code' });
    }
    const claimed = await this.prisma.authCode.updateMany({ where: { id: row.id, consumedAt: null }, data: { consumedAt: new Date() } });
    if (claimed.count !== 1) throw expired();
    await this.completeLogin(row.userId, meta, true);
    return { status: 'ok' as const };
  }

  private async completeLogin(userId: string, meta: Meta, trust: boolean) {
    await this.sessions.start(userId, meta.res);
    if (trust) await this.sessions.trustDevice(userId, meta.res);
    await this.activity.audit({ userId, action: 'login.success', ip: meta.ip });
  }

  // ---------- Password reset ----------

  /** Always answers the same way, so it can't be used to find out who has an account. */
  async requestReset(address: string, ip: string | null) {
    await this.limits.hit(`reset:ip:${ip}`, 10, 3600);
    await this.limits.hit(`reset:email:${sha256(address)}`, 3, 3600);
    const user = await this.prisma.user.findUnique({ where: { email: address } });
    if (!user || user.isDemo) return { ok: true };
    const token = randomToken(32);
    await this.prisma.authCode.create({
      data: { userId: user.id, purpose: 'RESET', codeHash: sha256(token), expiresAt: new Date(Date.now() + RESET_TTL_MS) },
    });
    await this.mail.send({
      to: user.email,
      ...email({
        subject: 'Reset your OpenLet password',
        from: 'OpenLet',
        heading: 'Reset your password',
        paragraphs: [`Hello ${user.name},`, 'Use the button below to choose a new password. The link works for 30 minutes.', 'If you didn’t ask for this, you can ignore this email.'],
        button: { label: 'Choose a new password', url: `${config().APP_URL}/reset?token=${token}` },
      }),
    });
    return { ok: true };
  }

  async confirmReset(input: z.infer<typeof resetConfirmSchema>, ip: string | null) {
    await this.limits.hit(`reset:confirm:${ip}`, 20, 3600);
    const row = await this.prisma.authCode.findFirst({ where: { codeHash: sha256(input.token), purpose: 'RESET' } });
    if (!row || row.consumedAt || row.expiresAt < new Date()) {
      throw new BadRequestException({ code: 'RESET_EXPIRED', message: 'That reset link has expired. Please ask for a new one.' });
    }
    const passwordHash = await hashPassword(input.password);
    await this.prisma.$transaction([
      this.prisma.authCode.update({ where: { id: row.id }, data: { consumedAt: new Date() } }),
      this.prisma.user.update({ where: { id: row.userId }, data: { passwordHash } }),
    ]);
    // A new password logs every device out and forgets trusted browsers.
    await this.sessions.revokeAllForUser(row.userId);
    await this.sessions.forgetDevices(row.userId);
    await this.activity.audit({ userId: row.userId, action: 'password.reset', ip });
    return { ok: true };
  }

  async changePassword(userId: string, current: string, next: string, res: Response) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.isDemo) throw new ForbiddenException({ message: 'The demo password can’t be changed.' });
    if (!(await verifyPassword(user.passwordHash, current))) {
      throw new BadRequestException({ code: 'WRONG_PASSWORD', message: 'Your current password isn’t right.', field: 'currentPassword' });
    }
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(next) } });
    await this.sessions.revokeAllForUser(userId);
    await this.sessions.start(userId, res);
    await this.activity.audit({ userId, action: 'password.changed' });
    return { ok: true };
  }

  // ---------- Invites (team members and tenants) ----------

  private async liveInvite(token: string) {
    const invite = await this.prisma.invite.findUnique({ where: { tokenHash: sha256(token) }, include: { workspace: { select: { name: true } } } });
    if (!invite || invite.acceptedAt || invite.revokedAt || invite.expiresAt < new Date()) {
      throw new NotFoundException({ code: 'INVITE_INVALID', message: 'This invite has expired or was already used. Ask for a new one.' });
    }
    return invite;
  }

  async inviteInfo(token: string, ip: string | null) {
    await this.limits.hit(`invite:view:${ip}`, 60, 900);
    const invite = await this.liveInvite(token);
    const existing = await this.prisma.user.findUnique({ where: { email: invite.email }, select: { id: true } });
    return { kind: invite.kind, workspaceName: invite.workspace.name, email: invite.email, role: invite.role, hasAccount: !!existing };
  }

  /**
   * Accepting proves the person owns the invited email. A new person sets a name and password; someone who
   * already has an account confirms it with their password. Either way they're logged in afterwards.
   */
  async acceptInvite(input: z.infer<typeof acceptInviteSchema>, meta: Meta) {
    await this.limits.hit(`invite:accept:${meta.ip}`, 20, 900);
    const invite = await this.liveInvite(input.token);
    const existing = await this.prisma.user.findUnique({ where: { email: invite.email } });
    if (existing && !(input.password && (await verifyPassword(existing.passwordHash, input.password)))) {
      throw new BadRequestException({ code: 'WRONG_PASSWORD', message: 'Enter the password for your existing OpenLet account.', field: 'password' });
    }
    if (!existing && (!input.name || !input.password)) {
      throw new BadRequestException({ code: 'VALIDATION', message: 'Enter your name and choose a password.' });
    }
    const passwordHash = existing ? null : await hashPassword(input.password!);
    const userId = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.invite.updateMany({ where: { id: invite.id, acceptedAt: null }, data: { acceptedAt: new Date() } });
      if (claimed.count !== 1) throw new NotFoundException({ code: 'INVITE_INVALID', message: 'This invite was already used.' });
      const user = existing ?? (await tx.user.create({ data: { email: invite.email, name: input.name!, passwordHash: passwordHash! } }));
      if (invite.kind === 'MEMBER') {
        await tx.membership.upsert({
          where: { workspaceId_userId: { workspaceId: invite.workspaceId, userId: user.id } },
          create: { workspaceId: invite.workspaceId, userId: user.id, role: invite.role ?? 'STAFF' },
          update: {},
        });
      } else if (invite.tenantId) {
        const tenant = await tx.tenant.findUnique({ where: { id: invite.tenantId } });
        if (!tenant || tenant.workspaceId !== invite.workspaceId || tenant.anonymisedAt) throw new NotFoundException({ code: 'INVITE_INVALID', message: 'This invite is no longer valid.' });
        if (tenant.userId && tenant.userId !== user.id) throw new ConflictException({ message: 'This tenant already has a portal login.' });
        const clash = await tx.tenant.findFirst({ where: { workspaceId: invite.workspaceId, userId: user.id, NOT: { id: tenant.id } } });
        if (clash) throw new ConflictException({ message: 'Your account is already linked to another tenant record here.' });
        await tx.tenant.update({ where: { id: tenant.id }, data: { userId: user.id } });
      }
      return user.id;
    });
    await this.activity.audit({ workspaceId: invite.workspaceId, userId, action: `invite.accepted.${invite.kind.toLowerCase()}`, ip: meta.ip });
    await this.sessions.start(userId, meta.res);
    await this.sessions.trustDevice(userId, meta.res);
    return { status: 'ok' as const, kind: invite.kind, workspaceId: invite.workspaceId };
  }

  // ---------- Who am I ----------

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        isDemo: true,
        memberships: { select: { role: true, workspace: { select: { id: true, name: true } } }, orderBy: { createdAt: 'asc' } },
        tenants: { where: { anonymisedAt: null }, select: { id: true, workspace: { select: { id: true, name: true } } }, orderBy: { createdAt: 'asc' } },
      },
    });
    const isOwnerSomewhere = user.memberships.some((m) => m.role === 'OWNER');
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      isDemo: user.isDemo,
      workspaces: user.memberships.map((m) => ({ id: m.workspace.id, name: m.workspace.name, role: m.role })),
      tenancies: user.tenants.map((t) => ({ workspaceId: t.workspace.id, workspaceName: t.workspace.name, tenantId: t.id })),
      canCreateWorkspace: !user.isDemo && (isOwnerSomewhere || config().SIGNUP_ENABLED),
      demoMode: config().DEMO_MODE,
    };
  }
}

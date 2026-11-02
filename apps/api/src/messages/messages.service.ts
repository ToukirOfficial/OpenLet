import { Injectable } from '@nestjs/common';
import type { MessageItem, ThreadSummary } from '@openlet/shared';
import { config } from '../config.js';
import { PrismaService } from '../prisma.service.js';
import type { StaffContext } from '../common/auth-context.js';
import { notFound } from '../common/not-found.js';
import { MailService } from '../mail/mail.service.js';
import { email } from '../mail/templates.js';
import { RateLimitService } from '../common/rate-limit.service.js';
import { unitLabel } from '../tenancies/tenancies.service.js';
import type { Message } from '../generated/prisma/client.js';

const preview = (s: string) => (s.length > 140 ? `${s.slice(0, 137)}…` : s);

/** One message thread per tenancy, between the team and the tenants. Emails tell the other side. */
@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly limits: RateLimitService,
  ) {}

  item(m: Message, viewer: { userId: string }): MessageItem {
    return { id: m.id, authorType: m.authorType, authorName: m.authorName, body: m.body, createdAt: m.createdAt.toISOString(), mine: m.authorUserId === viewer.userId };
  }

  async threads(ctx: StaffContext): Promise<ThreadSummary[]> {
    const tenancies = await this.prisma.tenancy.findMany({
      where: { workspaceId: ctx.workspaceId, messages: { some: {} } },
      include: {
        unit: { include: { property: true } },
        tenants: { include: { tenant: { select: { firstName: true, lastName: true } } } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        _count: { select: { messages: { where: { authorType: 'TENANT', readByStaffAt: null } } } },
      },
    });
    return tenancies
      .map((t) => ({
        tenancyId: t.id,
        tenantNames: t.tenants.map((x) => `${x.tenant.firstName} ${x.tenant.lastName}`).join(' and '),
        address: `${unitLabel(t.unit.name)}${t.unit.property.addressLine1}, ${t.unit.property.town}`,
        lastMessage: t.messages[0] ? { body: preview(t.messages[0].body), authorType: t.messages[0].authorType, createdAt: t.messages[0].createdAt.toISOString() } : null,
        unread: t._count.messages,
      }))
      .sort((a, b) => (b.lastMessage?.createdAt ?? '').localeCompare(a.lastMessage?.createdAt ?? ''));
  }

  private async tenancy(workspaceId: string, tenancyId: string) {
    const t = await this.prisma.tenancy.findFirst({ where: { id: tenancyId, workspaceId }, include: { unit: { include: { property: true } }, tenants: { include: { tenant: true } }, workspace: true } });
    if (!t) throw notFound('Tenancy');
    return t;
  }

  async forStaff(ctx: StaffContext, tenancyId: string) {
    await this.tenancy(ctx.workspaceId, tenancyId);
    await this.prisma.message.updateMany({ where: { tenancyId, authorType: 'TENANT', readByStaffAt: null }, data: { readByStaffAt: new Date() } });
    const rows = await this.prisma.message.findMany({ where: { tenancyId }, orderBy: { createdAt: 'asc' }, take: 500 });
    return rows.map((m) => this.item(m, ctx));
  }

  async sendAsStaff(ctx: StaffContext, tenancyId: string, body: string) {
    const t = await this.tenancy(ctx.workspaceId, tenancyId);
    await this.limits.hit(`msg:${ctx.userId}`, 60, 3600);
    await this.prisma.message.create({ data: { workspaceId: ctx.workspaceId, tenancyId, authorType: 'STAFF', authorUserId: ctx.userId, authorName: ctx.name, body } });
    for (const { tenant } of t.tenants) {
      if (!tenant.email || tenant.anonymisedAt) continue;
      await this.mail.send({
        to: tenant.email,
        workspaceId: ctx.workspaceId,
        ...email({
          subject: `New message from ${t.workspace.name}`,
          from: t.workspace.name,
          heading: 'You have a new message',
          paragraphs: [`Hello ${tenant.firstName},`, `${ctx.name} wrote:`, body],
          button: tenant.userId ? { label: 'Reply in your portal', url: `${config().APP_URL}/portal/messages` } : undefined,
        }),
      });
    }
    return this.forStaff(ctx, tenancyId);
  }

  /** Tenant side: the caller's own tenancy only (checked by the portal service before this is called). */
  async forTenant(viewer: { userId: string }, tenancyId: string) {
    await this.prisma.message.updateMany({ where: { tenancyId, authorType: 'STAFF', readByTenantAt: null }, data: { readByTenantAt: new Date() } });
    const rows = await this.prisma.message.findMany({ where: { tenancyId }, orderBy: { createdAt: 'asc' }, take: 500 });
    return rows.map((m) => this.item(m, viewer));
  }

  async sendAsTenant(viewer: { userId: string; name: string; workspaceId: string }, tenancyId: string, body: string) {
    await this.limits.hit(`msg:${viewer.userId}`, 30, 3600);
    const t = await this.tenancy(viewer.workspaceId, tenancyId);
    await this.prisma.message.create({ data: { workspaceId: viewer.workspaceId, tenancyId, authorType: 'TENANT', authorUserId: viewer.userId, authorName: viewer.name, body } });
    const team = await this.prisma.membership.findMany({ where: { workspaceId: viewer.workspaceId }, include: { user: { select: { email: true, name: true } } } });
    for (const m of team) {
      await this.mail.send({
        to: m.user.email,
        workspaceId: viewer.workspaceId,
        ...email({
          subject: `Message from ${viewer.name} (${t.unit.property.addressLine1})`,
          from: 'OpenLet',
          heading: `New message from ${viewer.name}`,
          paragraphs: [`${viewer.name} wrote about ${unitLabel(t.unit.name)}${t.unit.property.addressLine1}:`, body],
          button: { label: 'Reply', url: `${config().APP_URL}/app/tenancies/${t.id}?tab=messages` },
        }),
      });
    }
    return this.forTenant(viewer, tenancyId);
  }
}

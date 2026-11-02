import { BadRequestException, Injectable } from '@nestjs/common';
import type { z } from 'zod';
import {
  OPEN_REPAIR_STATUSES,
  effectiveEnd,
  londonDate,
  tenancyStatus,
  type PortalDetails,
  type PortalHome,
  type PortalRepair,
  type PortalTenancy,
  type portalContactSchema,
  type reportRepairSchema,
} from '@openlet/shared';
import { config } from '../config.js';
import { PrismaService } from '../prisma.service.js';
import { ActivityService } from '../common/activity.service.js';
import { actorOf, type TenantContext } from '../common/auth-context.js';
import { fromDbReq, tenancyDates } from '../common/dates.js';
import { notFound } from '../common/not-found.js';
import { RateLimitService } from '../common/rate-limit.service.js';
import { DocumentsService, toItem } from '../documents/documents.service.js';
import { ExportsService } from '../exports/exports.service.js';
import { LedgerService } from '../ledger/ledger.service.js';
import { MailService } from '../mail/mail.service.js';
import { email } from '../mail/templates.js';
import { MessagesService } from '../messages/messages.service.js';
import { formatAddress } from '../properties/properties.service.js';
import { RepairsService } from '../repairs/repairs.service.js';
import { unitLabel } from '../tenancies/tenancies.service.js';
import type { Prisma } from '../generated/prisma/client.js';

const MAX_PHOTOS_PER_REPAIR = 10;

/**
 * Everything a tenant sees. Every method starts from the tenant's own tenancies (TenancyTenant rows for
 * their tenant record in this workspace); any id outside that set gets "not found". Internal notes, internal
 * repair comments, costs and staff-only fields are never returned.
 */
@Injectable()
export class PortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly repairService: RepairsService,
    private readonly documents: DocumentsService,
    private readonly messages: MessagesService,
    private readonly exports: ExportsService,
    private readonly activity: ActivityService,
    private readonly mail: MailService,
    private readonly limits: RateLimitService,
  ) {}

  /** The tenant's tenancies in this workspace, current first. */
  private async myTenancies(ctx: TenantContext) {
    const rows = await this.prisma.tenancy.findMany({
      where: { workspaceId: ctx.workspaceId, tenants: { some: { tenantId: ctx.tenantId } } },
      include: { unit: { include: { property: true } }, rentChanges: { orderBy: { effectiveFrom: 'asc' } } },
    });
    const today = londonDate();
    const order = { ACTIVE: 0, ENDING: 1, UPCOMING: 2, ENDED: 3 } as const;
    return rows
      .map((t) => ({ t, status: tenancyStatus(tenancyDates(t), today) }))
      .sort((a, b) => order[a.status] - order[b.status] || (a.t.startDate < b.t.startDate ? 1 : -1));
  }

  /** One of the tenant's tenancies: the one asked for (if it's theirs) or their current one. */
  private async pick(ctx: TenantContext, tenancyId?: string) {
    const mine = await this.myTenancies(ctx);
    const found = tenancyId ? mine.find((x) => x.t.id === tenancyId) : mine[0];
    if (!found) throw notFound('Tenancy');
    return found;
  }

  private summary({ t, status }: Awaited<ReturnType<PortalService['myTenancies']>>[number]): PortalTenancy {
    const today = londonDate();
    const rent = [...t.rentChanges].reverse().find((r) => fromDbReq(r.effectiveFrom) <= today) ?? t.rentChanges[0];
    return {
      id: t.id,
      address: unitLabel(t.unit.name) + formatAddress(t.unit.property),
      status,
      startDate: fromDbReq(t.startDate),
      endDate: effectiveEnd(tenancyDates(t)),
      rentPence: rent?.amountPence ?? 0,
      frequency: t.frequency,
    };
  }

  async home(ctx: TenantContext): Promise<PortalHome> {
    const mine = await this.myTenancies(ctx);
    const ws = await this.prisma.workspace.findUniqueOrThrow({ where: { id: ctx.workspaceId }, select: { id: true, name: true, contactEmail: true, contactPhone: true, logoKey: true } });
    const current = mine[0];
    const ledger = current ? await this.ledger.ledger(current.t.id) : null;
    const nextCharge = ledger?.rows.find((r) => r.type === 'RENT_CHARGE' && r.status === 'UPCOMING');
    const ids = mine.map((x) => x.t.id);
    const [repairs, messages, unread] = await Promise.all([
      this.prisma.repair.findMany({ where: { tenancyId: { in: ids }, status: { in: [...OPEN_REPAIR_STATUSES] } }, include: { property: true, unit: true, contractor: true }, orderBy: { createdAt: 'desc' }, take: 5 }),
      current ? this.prisma.message.findMany({ where: { tenancyId: current.t.id }, orderBy: { createdAt: 'desc' }, take: 3 }) : [],
      this.prisma.message.count({ where: { tenancyId: { in: ids }, authorType: 'STAFF', readByTenantAt: null } }),
    ]);
    return {
      workspace: { id: ws.id, name: ws.name, contactEmail: ws.contactEmail, contactPhone: ws.contactPhone, hasLogo: !!ws.logoKey },
      tenancy: current ? this.summary(current) : null,
      tenancies: mine.map((x) => this.summary(x)),
      balancePence: ledger?.balancePence ?? 0,
      arrearsPence: ledger?.arrearsPence ?? 0,
      nextDueDate: ledger?.nextDueDate ?? null,
      nextDuePence: nextCharge?.outstandingPence ?? (current ? this.summary(current).rentPence : null),
      // Tenants never see who the contractor is or what the repair cost.
      openRepairs: repairs.map((r) => ({ ...this.repairService.item(r), contractorName: null, costPence: null })),
      latestMessages: messages.reverse().map((m) => this.messages.item(m, ctx)),
      unreadMessages: unread,
    };
  }

  // ---------- Rent ----------

  async ledgerFor(ctx: TenantContext, tenancyId?: string) {
    const { t } = await this.pick(ctx, tenancyId);
    const l = await this.ledger.ledger(t.id);
    return { ...l, rows: l.rows.map((r) => ({ ...r, createdBy: null })) };
  }

  async statement(ctx: TenantContext, input: { tenancyId?: string; from: string; to: string }) {
    const { t } = await this.pick(ctx, input.tenancyId);
    await this.limits.hit(`portal:statement:${ctx.userId}`, 20, 3600);
    return this.exports.request(ctx, 'statement', { tenancyId: t.id, from: input.from, to: input.to });
  }

  // ---------- Repairs ----------

  private async myRepair(ctx: TenantContext, id: string) {
    const ids = (await this.myTenancies(ctx)).map((x) => x.t.id);
    const r = await this.prisma.repair.findFirst({
      where: { id, workspaceId: ctx.workspaceId, tenancyId: { in: ids } },
      include: { events: { where: { visibility: 'TENANT' }, orderBy: { createdAt: 'asc' } }, documents: { where: { type: 'PHOTO' }, orderBy: { createdAt: 'asc' } } },
    });
    if (!r) throw notFound('Repair');
    return r;
  }

  async repairs(ctx: TenantContext) {
    const ids = (await this.myTenancies(ctx)).map((x) => x.t.id);
    const rows = await this.prisma.repair.findMany({ where: { tenancyId: { in: ids } }, include: { property: true, unit: true, contractor: true }, orderBy: { createdAt: 'desc' } });
    return rows.map((r) => ({ ...this.repairService.item(r), contractorName: null, costPence: null }));
  }

  async repair(ctx: TenantContext, id: string): Promise<PortalRepair> {
    const r = await this.myRepair(ctx, id);
    return {
      id: r.id,
      reference: r.reference,
      title: r.title,
      category: r.category,
      status: r.status,
      description: r.description,
      accessNotes: r.accessNotes,
      availability: r.availability,
      visitAt: r.visitAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      // Costs stay with the landlord, even when the contractor typed them as a note.
      events: r.events.filter((e) => e.type !== 'COST').map((e) => ({ type: e.type, actorType: e.actorType, actorName: e.actorName, toStatus: e.toStatus, body: e.body, createdAt: e.createdAt.toISOString() })),
      photos: r.documents.map((d) => ({ id: d.id, ready: d.ready })),
    };
  }

  async reportRepair(ctx: TenantContext, input: z.infer<typeof reportRepairSchema> & { tenancyId?: string }) {
    const { t, status } = await this.pick(ctx, input.tenancyId);
    if (status === 'ENDED') throw new BadRequestException({ message: 'This tenancy has ended. Contact your landlord or agent directly.' });
    await this.limits.hit(`portal:repair:${ctx.userId}`, 15, 3600);
    const { tenancyId: _t, ...fields } = input;
    const repair = await this.repairService.createRepair(ctx.workspaceId, { ...fields, propertyId: t.unit.propertyId, unitId: t.unitId, tenancyId: t.id, priority: 'ROUTINE', reportedByTenantId: ctx.tenantId }, actorOf(ctx));
    const team = await this.prisma.membership.findMany({ where: { workspaceId: ctx.workspaceId }, include: { user: { select: { email: true } } } });
    for (const m of team) {
      await this.mail.send({
        to: m.user.email,
        workspaceId: ctx.workspaceId,
        ...email({
          subject: `New repair reported: ${repair.title} (#${repair.reference})`,
          from: 'OpenLet',
          heading: 'A tenant reported a repair',
          paragraphs: [`${ctx.name} reported a repair at ${unitLabel(t.unit.name)}${t.unit.property.addressLine1}.`, `${repair.title}: ${repair.description}`, 'Set its priority and assign a contractor.'],
          button: { label: 'Open the repair', url: `${config().APP_URL}/app/repairs/${repair.id}` },
        }),
      });
    }
    return this.repair(ctx, repair.id);
  }

  async addRepairPhoto(ctx: TenantContext, id: string, file: Express.Multer.File | undefined) {
    const r = await this.myRepair(ctx, id);
    if (r.documents.length >= MAX_PHOTOS_PER_REPAIR) throw new BadRequestException({ message: `A repair can have up to ${MAX_PHOTOS_PER_REPAIR} photos.` });
    await this.documents.store(ctx.workspaceId, file, { repairId: r.id, type: 'PHOTO', title: `Photo for repair #${r.reference}`, sharedWithTenant: true }, actorOf(ctx), { imagesOnly: true });
    await this.prisma.repairEvent.create({ data: { repairId: r.id, type: 'PHOTO', visibility: 'TENANT', actorType: 'TENANT', actorId: ctx.userId, actorName: ctx.name, body: 'Added a photo.' } });
    return this.repair(ctx, id);
  }

  async repairPhoto(ctx: TenantContext, id: string, documentId: string) {
    const r = await this.myRepair(ctx, id);
    const d = r.documents.find((x) => x.id === documentId);
    if (!d) throw notFound('Photo');
    return this.documents.stream(d, ctx, true);
  }

  async commentOnRepair(ctx: TenantContext, id: string, body: string) {
    const r = await this.myRepair(ctx, id);
    await this.limits.hit(`portal:comment:${ctx.userId}`, 60, 3600);
    await this.prisma.repairEvent.create({ data: { repairId: r.id, type: 'COMMENT', visibility: 'TENANT', actorType: 'TENANT', actorId: ctx.userId, actorName: ctx.name, body } });
    await this.activity.record({ workspaceId: ctx.workspaceId, actor: actorOf(ctx), action: 'repair.comment', summary: `Commented on repair #${r.reference}`, repairId: r.id, propertyId: r.propertyId, tenancyId: r.tenancyId });
    return this.repair(ctx, id);
  }

  // ---------- Documents ----------

  /** Shared documents only: their tenancies' documents, their own, and their current home's certificates. */
  private async documentWhere(ctx: TenantContext): Promise<Prisma.DocumentWhereInput> {
    const mine = await this.myTenancies(ctx);
    const live = mine.filter((x) => x.status !== 'ENDED').map((x) => x.t.unit.propertyId);
    return {
      workspaceId: ctx.workspaceId,
      sharedWithTenant: true,
      ready: true,
      OR: [{ tenancyId: { in: mine.map((x) => x.t.id) } }, { tenantId: ctx.tenantId }, { propertyId: { in: live } }],
    };
  }

  async documentsList(ctx: TenantContext) {
    const rows = await this.prisma.document.findMany({ where: { ...(await this.documentWhere(ctx)), type: { not: 'PHOTO' } }, orderBy: { createdAt: 'desc' } });
    return rows.map(toItem);
  }

  async download(ctx: TenantContext, id: string) {
    const d = await this.prisma.document.findFirst({ where: { ...(await this.documentWhere(ctx)), id } });
    if (!d) throw notFound('Document');
    return this.documents.stream(d, ctx, false);
  }

  // ---------- Messages ----------

  async messagesFor(ctx: TenantContext, tenancyId?: string) {
    const { t } = await this.pick(ctx, tenancyId);
    return { tenancyId: t.id, messages: await this.messages.forTenant(ctx, t.id) };
  }

  async sendMessage(ctx: TenantContext, body: string, tenancyId?: string) {
    const { t } = await this.pick(ctx, tenancyId);
    return { tenancyId: t.id, messages: await this.messages.sendAsTenant(ctx, t.id, body) };
  }

  // ---------- Own details ----------

  async details(ctx: TenantContext): Promise<PortalDetails> {
    const t = await this.prisma.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId } });
    return { firstName: t.firstName, lastName: t.lastName, email: t.email, phone: t.phone, emergencyName: t.emergencyName, emergencyPhone: t.emergencyPhone };
  }

  async updateContact(ctx: TenantContext, input: z.infer<typeof portalContactSchema>) {
    await this.prisma.tenant.update({ where: { id: ctx.tenantId }, data: { phone: input.phone, emergencyName: input.emergencyName, emergencyPhone: input.emergencyPhone } });
    await this.activity.record({ workspaceId: ctx.workspaceId, actor: actorOf(ctx), action: 'tenant.contact.updated', summary: 'Updated their contact details', tenantId: ctx.tenantId });
    return this.details(ctx);
  }
}

import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import type { z } from 'zod';
import {
  OPEN_REPAIR_STATUSES,
  REPAIR_PRIORITY_LABELS,
  REPAIR_STATUS_LABELS,
  formatDateTime,
  formatPence,
  londonDate,
  tenancyStatus,
  type RepairDetail,
  type RepairListItem,
  type RepairPriority,
  type RepairStatus,
  type repairListQuery,
  type repairUpdateSchema,
  type reportRepairSchema,
  type staffRepairSchema,
} from '@openlet/shared';
import { config } from '../config.js';
import { PrismaService } from '../prisma.service.js';
import { ActivityService } from '../common/activity.service.js';
import { actorOf, type Actor, type StaffContext } from '../common/auth-context.js';
import { tenancyDates } from '../common/dates.js';
import { notFound } from '../common/not-found.js';
import { readSettings } from '../common/settings.js';
import { MailService } from '../mail/mail.service.js';
import { email } from '../mail/templates.js';
import { RedisService } from '../redis.service.js';
import { formatAddress } from '../properties/properties.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { ContractorLinksService } from './contractor-links.service.js';
import { demoLinkToken, sha256 } from '../common/crypto.js';

export const repairInclude = {
  property: true,
  unit: true,
  contractor: true,
  tenancy: { include: { tenants: { include: { tenant: true } } } },
  events: { orderBy: { createdAt: 'asc' } },
  documents: { where: { type: 'PHOTO' }, orderBy: { createdAt: 'asc' } },
  links: { where: { revokedAt: null }, orderBy: { createdAt: 'desc' }, take: 1 },
} satisfies Prisma.RepairInclude;
export type LoadedRepair = Prisma.RepairGetPayload<{ include: typeof repairInclude }>;

const isOpen = (s: RepairStatus) => OPEN_REPAIR_STATUSES.includes(s);
const PAGE = 50;

@Injectable()
export class RepairsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly links: ContractorLinksService,
    private readonly mail: MailService,
    private readonly redis: RedisService,
  ) {}

  item(r: Prisma.RepairGetPayload<{ include: { property: true; unit: true; contractor: true } }>, now = new Date()): RepairListItem {
    return {
      id: r.id,
      reference: r.reference,
      title: r.title,
      category: r.category,
      priority: r.priority,
      status: r.status,
      propertyId: r.propertyId,
      address: formatAddress(r.property),
      unitName: r.unit && r.unit.name !== 'Whole property' ? r.unit.name : null,
      tenancyId: r.tenancyId,
      contractorName: r.contractor ? (r.contractor.company ? `${r.contractor.name}, ${r.contractor.company}` : r.contractor.name) : null,
      reportedBy: r.reportedByTenantId ? 'TENANT' : 'STAFF',
      targetAt: r.targetAt.toISOString(),
      overdue: isOpen(r.status) && r.targetAt < now,
      visitAt: r.visitAt?.toISOString() ?? null,
      costPence: r.costPence,
      createdAt: r.createdAt.toISOString(),
    };
  }

  detail(r: LoadedRepair): RepairDetail {
    const link = r.links[0];
    return {
      ...this.item(r),
      description: r.description,
      accessNotes: r.accessNotes,
      availability: r.availability,
      contractorId: r.contractorId,
      tenants: (r.tenancy?.tenants ?? []).map(({ tenant }) => ({ name: `${tenant.firstName} ${tenant.lastName}`, phone: tenant.phone, email: tenant.email })),
      events: r.events.map((e) => ({ id: e.id, type: e.type, visibility: e.visibility, actorType: e.actorType, actorName: e.actorName, fromStatus: e.fromStatus, toStatus: e.toStatus, body: e.body, createdAt: e.createdAt.toISOString() })),
      photos: r.documents.map((d) => ({ id: d.id, uploadedBy: d.uploadedByType, ready: d.ready, createdAt: d.createdAt.toISOString() })),
      link: link ? { active: !link.expiresAt || link.expiresAt > new Date(), expiresAt: link.expiresAt?.toISOString() ?? null, lastUsedAt: link.lastUsedAt?.toISOString() ?? null } : null,
      // Demo site only: the seeded job link, so visitors can see the contractor's page.
      demoUrl: config().DEMO_MODE && link && link.tokenHash === sha256(demoLinkToken(r.id)) ? `${config().APP_URL}/job/${demoLinkToken(r.id)}` : null,
      completedAt: r.completedAt?.toISOString() ?? null,
      closedAt: r.closedAt?.toISOString() ?? null,
    };
  }

  async targetFor(workspaceId: string, priority: RepairPriority, from: Date) {
    const ws = await this.prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { settings: true } });
    return new Date(from.getTime() + readSettings(ws.settings).targetHours[priority] * 3600_000);
  }

  /** Repairs get a short number per workspace (#12) that tenants and contractors can quote. */
  private async nextReference(tx: Prisma.TransactionClient, workspaceId: string) {
    const last = await tx.repair.findFirst({ where: { workspaceId }, orderBy: { reference: 'desc' }, select: { reference: true } });
    return (last?.reference ?? 0) + 1;
  }

  /** Shared by staff logging a repair and a tenant reporting one. */
  async createRepair(
    workspaceId: string,
    data: z.infer<typeof reportRepairSchema> & { propertyId: string; unitId: string | null; tenancyId: string | null; priority: RepairPriority; reportedByTenantId: string | null },
    actor: Actor,
  ) {
    const now = new Date();
    const targetAt = await this.targetFor(workspaceId, data.priority, now);
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const repair = await tx.repair.create({ data: { ...data, workspaceId, reference: await this.nextReference(tx, workspaceId), targetAt } });
          await tx.repairEvent.create({ data: { repairId: repair.id, type: 'CREATED', actorType: actor.type, actorId: actor.id, actorName: actor.name, toStatus: 'REPORTED', body: null } });
          await this.activity.record({ workspaceId, actor, action: 'repair.created', summary: `${actor.type === 'TENANT' ? 'Reported' : 'Logged'} repair #${repair.reference}: ${repair.title}`, propertyId: repair.propertyId, tenancyId: repair.tenancyId, repairId: repair.id }, tx);
          return repair;
        });
      } catch (e) {
        // Two repairs at the same moment can pick the same number: try again.
        if ((e as { code?: string }).code === 'P2002' && attempt < 3) continue;
        throw e;
      }
    }
  }

  async create(ctx: StaffContext, input: z.infer<typeof staffRepairSchema>) {
    const property = await this.prisma.property.findFirst({ where: { id: input.propertyId, workspaceId: ctx.workspaceId }, include: { units: { include: { tenancies: true } } } });
    if (!property) throw notFound('Property');
    let unitId = input.unitId ?? null;
    if (unitId && !property.units.some((u) => u.id === unitId)) throw notFound('Unit');
    if (!unitId && property.units.length === 1) unitId = property.units[0]!.id;
    let tenancyId = input.tenancyId ?? null;
    if (tenancyId) {
      const t = property.units.flatMap((u) => u.tenancies).find((x) => x.id === tenancyId);
      if (!t) throw notFound('Tenancy');
      unitId ??= t.unitId;
    } else if (unitId) {
      // Link the current tenancy, so its tenants see the repair and get updates.
      const today = londonDate();
      const current = property.units.find((u) => u.id === unitId)!.tenancies.find((t) => ['ACTIVE', 'ENDING'].includes(tenancyStatus(tenancyDates(t), today)));
      tenancyId = current?.id ?? null;
    }
    const { propertyId: _p, unitId: _u, tenancyId: _t, ...rest } = input;
    const repair = await this.createRepair(ctx.workspaceId, { ...rest, propertyId: property.id, unitId, tenancyId, reportedByTenantId: null }, actorOf(ctx));
    await this.redis.invalidate(ctx.workspaceId);
    return this.get(ctx, repair.id);
  }

  async list(ctx: StaffContext, q: z.infer<typeof repairListQuery>) {
    const where: Prisma.RepairWhereInput = { workspaceId: ctx.workspaceId };
    if (q.status === 'OPEN') where.status = { in: [...OPEN_REPAIR_STATUSES] };
    else if (q.status) where.status = q.status;
    if (q.propertyId) where.propertyId = q.propertyId;
    if (q.q) {
      const n = Number(q.q.replace('#', ''));
      where.OR = [{ title: { contains: q.q, mode: 'insensitive' } }, { property: { addressLine1: { contains: q.q, mode: 'insensitive' } } }, ...(Number.isInteger(n) && n > 0 ? [{ reference: n }] : [])];
    }
    const rows = await this.prisma.repair.findMany({ where, include: { property: true, unit: true, contractor: true }, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * PAGE, take: PAGE + 1 });
    const now = new Date();
    const items = rows.slice(0, PAGE).map((r) => this.item(r, now));
    const rank = { EMERGENCY: 0, URGENT: 1, ROUTINE: 2 } as const;
    // Open repairs: overdue first, then by priority, then newest.
    items.sort((a, b) => Number(isOpen(b.status)) - Number(isOpen(a.status)) || Number(b.overdue) - Number(a.overdue) || rank[a.priority] - rank[b.priority]);
    return { items, hasMore: rows.length > PAGE };
  }

  async load(workspaceId: string, id: string) {
    const r = await this.prisma.repair.findFirst({ where: { id, workspaceId }, include: repairInclude });
    if (!r) throw notFound('Repair');
    return r;
  }

  async get(ctx: StaffContext, id: string) {
    return this.detail(await this.load(ctx.workspaceId, id));
  }

  async update(ctx: StaffContext, id: string, input: z.infer<typeof repairUpdateSchema>) {
    const r = await this.load(ctx.workspaceId, id);
    const data: Prisma.RepairUpdateInput = {};
    const events: Prisma.RepairEventCreateManyInput[] = [];
    if (input.title) data.title = input.title;
    if (input.description) data.description = input.description;
    if ('accessNotes' in input) data.accessNotes = input.accessNotes;
    if (input.priority && input.priority !== r.priority) {
      data.priority = input.priority;
      data.targetAt = await this.targetFor(ctx.workspaceId, input.priority, r.createdAt);
      events.push({ repairId: id, type: 'COMMENT', visibility: 'TENANT', actorType: 'STAFF', actorId: ctx.userId, actorName: ctx.name, body: `Priority set to ${REPAIR_PRIORITY_LABELS[input.priority].toLowerCase()}.` });
    }
    if (input.costPence !== undefined && input.costPence !== r.costPence) {
      data.costPence = input.costPence;
      events.push({ repairId: id, type: 'COST', visibility: 'INTERNAL', actorType: 'STAFF', actorId: ctx.userId, actorName: ctx.name, body: input.costPence === null ? 'Cost cleared.' : `Cost recorded: ${formatPence(input.costPence)}.` });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.repair.update({ where: { id }, data });
      if (events.length) await tx.repairEvent.createMany({ data: events });
    });
    await this.redis.invalidate(ctx.workspaceId);
    return this.get(ctx, id);
  }

  /**
   * Moves a repair to a new status (staff can choose any; contractors are limited by the job page).
   * Closing or cancelling starts the contractor link's grace period; re-opening lifts it.
   */
  async changeStatus(workspaceId: string, id: string, to: RepairStatus, actor: Actor, note: string | null) {
    const r = await this.load(workspaceId, id);
    if (r.status === to) throw new ConflictException({ message: `This repair is already ${REPAIR_STATUS_LABELS[to].toLowerCase()}.` });
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.repair.update({
        where: { id },
        data: {
          status: to,
          ...(to === 'COMPLETED' ? { completedAt: now } : {}),
          ...(to === 'CLOSED' || to === 'CANCELLED' ? { closedAt: now } : { closedAt: null }),
        },
      });
      await tx.repairEvent.create({ data: { repairId: id, type: 'STATUS', visibility: 'TENANT', actorType: actor.type, actorId: actor.id, actorName: actor.name, fromStatus: r.status, toStatus: to, body: note } });
      if (to === 'CLOSED' || to === 'CANCELLED') await this.links.expireForRepair(id, now, tx);
      else if (r.status === 'CLOSED' || r.status === 'CANCELLED') await this.links.reopen(id, tx);
      await this.activity.record({ workspaceId, actor, action: 'repair.status', summary: `Moved repair #${r.reference} to ${REPAIR_STATUS_LABELS[to].toLowerCase()}`, propertyId: r.propertyId, tenancyId: r.tenancyId, repairId: id }, tx);
    });
    await this.notifyTenants(r, `Your repair is now ${REPAIR_STATUS_LABELS[to].toLowerCase()}`, [
      `Repair #${r.reference}: ${r.title}`,
      `Status: ${REPAIR_STATUS_LABELS[to]}.`,
      ...(note ? [note] : []),
      ...(to === 'SCHEDULED' && r.visitAt ? [`Visit: ${formatDateTime(r.visitAt)}.`] : []),
    ]);
    await this.redis.invalidate(workspaceId);
  }

  async setStatus(ctx: StaffContext, id: string, to: RepairStatus, note: string | null) {
    await this.changeStatus(ctx.workspaceId, id, to, actorOf(ctx), note);
    return this.get(ctx, id);
  }

  /** Emails every tenant on the repair's tenancy who has an email address. */
  async notifyTenants(r: { workspaceId: string; id: string; reference: number; title: string; tenancy: LoadedRepair['tenancy'] }, heading: string, paragraphs: string[]) {
    if (!r.tenancy) return;
    const ws = await this.prisma.workspace.findUniqueOrThrow({ where: { id: r.workspaceId }, select: { name: true } });
    for (const { tenant } of r.tenancy.tenants) {
      if (!tenant.email || tenant.anonymisedAt) continue;
      await this.mail.send({
        to: tenant.email,
        workspaceId: r.workspaceId,
        ...email({
          subject: `${heading} (repair #${r.reference})`,
          from: ws.name,
          heading,
          paragraphs: [`Hello ${tenant.firstName},`, ...paragraphs],
          button: tenant.userId ? { label: 'See the repair', url: `${config().APP_URL}/portal/repairs/${r.id}` } : undefined,
        }),
      });
    }
  }

  async comment(ctx: StaffContext, id: string, body: string, visibility: 'TENANT' | 'INTERNAL') {
    const r = await this.load(ctx.workspaceId, id);
    await this.prisma.repairEvent.create({ data: { repairId: id, type: 'COMMENT', visibility, actorType: 'STAFF', actorId: ctx.userId, actorName: ctx.name, body } });
    if (visibility === 'TENANT') await this.notifyTenants(r, 'New update on your repair', [`Repair #${r.reference}: ${r.title}`, `${ctx.name} wrote: ${body}`]);
    return this.get(ctx, id);
  }

  /** Assigns a contractor and emails them a new job link (any older link stops working). */
  async assign(ctx: StaffContext, id: string, contractorId: string) {
    const r = await this.load(ctx.workspaceId, id);
    if (!isOpen(r.status) && r.status !== 'COMPLETED') throw new BadRequestException({ message: 'Re-open the repair before assigning a contractor.' });
    const c = await this.prisma.contractor.findFirst({ where: { id: contractorId, workspaceId: ctx.workspaceId, archivedAt: null } });
    if (!c) throw notFound('Contractor');
    const ws = await this.prisma.workspace.findUniqueOrThrow({ where: { id: ctx.workspaceId }, select: { name: true } });
    const token = await this.prisma.$transaction(async (tx) => {
      await tx.repair.update({ where: { id }, data: { contractorId: c.id, ...(r.status === 'REPORTED' ? { status: 'ACKNOWLEDGED' } : {}) } });
      if (r.status === 'REPORTED') {
        await tx.repairEvent.create({ data: { repairId: id, type: 'STATUS', visibility: 'TENANT', actorType: 'STAFF', actorId: ctx.userId, actorName: ctx.name, fromStatus: 'REPORTED', toStatus: 'ACKNOWLEDGED' } });
      }
      await tx.repairEvent.create({ data: { repairId: id, type: 'ASSIGNED', visibility: 'TENANT', actorType: 'STAFF', actorId: ctx.userId, actorName: ctx.name, body: `Assigned to ${c.company ?? c.name} (${c.trade}).` } });
      await this.activity.record({ workspaceId: ctx.workspaceId, actor: actorOf(ctx), action: 'repair.assigned', summary: `Assigned repair #${r.reference} to ${c.name}`, propertyId: r.propertyId, tenancyId: r.tenancyId, repairId: id }, tx);
      return this.links.issue(id, c.id, tx);
    });
    await this.mail.send({
      to: c.email,
      workspaceId: ctx.workspaceId,
      ...email({
        subject: `New job from ${ws.name}: ${r.title} (#${r.reference})`,
        from: ws.name,
        heading: `New job: ${r.title}`,
        paragraphs: [
          `Hello ${c.name},`,
          `${ws.name} has sent you a ${REPAIR_PRIORITY_LABELS[r.priority].toLowerCase()} job at ${r.property.addressLine1}, ${r.property.town}.`,
          'Open the link to see the details, book a visit, add photos and mark it done. You don’t need an account. Please don’t share the link.',
        ],
        button: { label: 'Open the job', url: `${config().APP_URL}/job/${token}` },
      }),
    });
    if (r.status === 'REPORTED') await this.notifyTenants(r, 'Your repair has been acknowledged', [`Repair #${r.reference}: ${r.title}`, 'A contractor has been asked to help. We’ll let you know when a visit is booked.']);
    await this.redis.invalidate(ctx.workspaceId);
    return this.get(ctx, id);
  }

  async revokeLink(ctx: StaffContext, id: string) {
    const r = await this.load(ctx.workspaceId, id);
    await this.links.revokeAll(id);
    await this.prisma.repairEvent.create({ data: { repairId: id, type: 'COMMENT', visibility: 'INTERNAL', actorType: 'STAFF', actorId: ctx.userId, actorName: ctx.name, body: 'Withdrew the contractor’s job link.' } });
    await this.activity.record({ workspaceId: ctx.workspaceId, actor: actorOf(ctx), action: 'repair.link.revoked', summary: `Withdrew the job link for repair #${r.reference}`, repairId: id, propertyId: r.propertyId });
    return this.get(ctx, id);
  }
}

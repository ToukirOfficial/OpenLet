import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import type { z } from 'zod';
import {
  addDays,
  effectiveEnd,
  formatDate,
  formatPence,
  londonDate,
  tenancyStatus,
  type TenancyDetail,
  type TenancyListItem,
  type depositReturnSchema,
  type depositSchema,
  type guarantorSchema,
  type noticeSchema,
  type rentChangeSchema,
  type tenancyListQuery,
  type tenancySchema,
  type tenancyUpdateSchema,
} from '@openlet/shared';
import { PrismaService } from '../prisma.service.js';
import { ActivityService } from '../common/activity.service.js';
import { actorOf, type StaffContext } from '../common/auth-context.js';
import { fromDb, fromDbReq, tenancyDates, toDb } from '../common/dates.js';
import { notFound } from '../common/not-found.js';
import { readSettings } from '../common/settings.js';
import { formatAddress } from '../properties/properties.service.js';
import { LedgerService } from '../ledger/ledger.service.js';
import { QueueService } from '../jobs/queue.service.js';
import { RedisService } from '../redis.service.js';
import type { Prisma } from '../generated/prisma/client.js';

const include = {
  unit: { include: { property: true } },
  tenants: { include: { tenant: { include: { invites: { where: { acceptedAt: null, revokedAt: null }, select: { expiresAt: true } } } } }, orderBy: { createdAt: 'asc' } },
  rentChanges: { orderBy: { effectiveFrom: 'asc' } },
  deposit: { include: { deductions: { orderBy: { createdAt: 'asc' } } } },
  guarantors: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.TenancyInclude;
type Loaded = Prisma.TenancyGetPayload<{ include: typeof include }>;

const PAGE = 50;
export const unitLabel = (unitName: string) => (unitName === 'Whole property' ? '' : `${unitName}, `);

@Injectable()
export class TenanciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly ledger: LedgerService,
    private readonly queue: QueueService,
    private readonly redis: RedisService,
  ) {}

  private summary(t: Loaded, balance: number, today: string): TenancyListItem {
    const current = [...t.rentChanges].reverse().find((r) => fromDbReq(r.effectiveFrom) <= today) ?? t.rentChanges[0];
    return {
      id: t.id,
      status: tenancyStatus(tenancyDates(t), today),
      propertyId: t.unit.propertyId,
      address: unitLabel(t.unit.name) + formatAddress(t.unit.property),
      unitName: t.unit.name,
      tenantNames: t.tenants.map((x) => `${x.tenant.firstName} ${x.tenant.lastName}`).join(' and '),
      startDate: fromDbReq(t.startDate),
      endDate: effectiveEnd(tenancyDates(t)),
      rentPence: current?.amountPence ?? 0,
      frequency: t.frequency,
      balancePence: balance,
    };
  }

  async list(ctx: StaffContext, q: z.infer<typeof tenancyListQuery>) {
    const where: Prisma.TenancyWhereInput = { workspaceId: ctx.workspaceId, archivedAt: null };
    if (q.q) {
      const term = q.q.trim();
      where.OR = [
        { unit: { property: { addressLine1: { contains: term, mode: 'insensitive' } } } },
        { unit: { property: { postcode: { contains: term, mode: 'insensitive' } } } },
        { unit: { property: { town: { contains: term, mode: 'insensitive' } } } },
        { tenants: { some: { tenant: { OR: [{ firstName: { contains: term, mode: 'insensitive' } }, { lastName: { contains: term, mode: 'insensitive' } }] } } } },
      ];
    }
    const rows = await this.prisma.tenancy.findMany({ where, include, orderBy: { startDate: 'desc' } });
    const today = londonDate();
    const balances = await this.ledger.balances(rows.map((r) => r.id), today);
    const all = rows.map((t) => this.summary(t, balances.get(t.id)?.balancePence ?? 0, today)).filter((t) => !q.status || t.status === q.status);
    const order = { ACTIVE: 0, ENDING: 1, UPCOMING: 2, ENDED: 3 } as const;
    all.sort((a, b) => order[a.status] - order[b.status]);
    const start = (q.page - 1) * PAGE;
    return { items: all.slice(start, start + PAGE), hasMore: all.length > start + PAGE, total: all.length };
  }

  async load(ctx: { workspaceId: string }, id: string) {
    const t = await this.prisma.tenancy.findFirst({ where: { id, workspaceId: ctx.workspaceId }, include });
    if (!t) throw notFound('Tenancy');
    return t;
  }

  async detail(t: Loaded): Promise<TenancyDetail> {
    const today = londonDate();
    const alloc = (await this.ledger.balances([t.id], today)).get(t.id)!;
    const ws = await this.prisma.workspace.findUniqueOrThrow({ where: { id: t.workspaceId }, select: { settings: true } });
    const protectDays = readSettings(ws.settings).reminders.depositProtectDays;
    const d = t.deposit;
    const receivedOn = fromDb(d?.receivedOn);
    const protectBy = receivedOn && !d?.protectedOn ? addDays(receivedOn, protectDays) : null;
    const now = new Date();
    return {
      ...this.summary(t, alloc.balancePence, today),
      unitId: t.unitId,
      dueDay: t.dueDay,
      remindersEnabled: t.remindersEnabled,
      noticeBy: t.noticeBy,
      noticeGivenOn: fromDb(t.noticeGivenOn),
      noticeEndDate: fromDb(t.noticeEndDate),
      endedOn: fromDb(t.endedOn),
      tenants: t.tenants.map(({ tenant }) => ({
        id: tenant.id,
        name: `${tenant.firstName} ${tenant.lastName}`,
        email: tenant.email,
        phone: tenant.phone,
        portal: tenant.userId ? 'ACTIVE' : tenant.invites.some((i) => i.expiresAt > now) ? 'INVITED' : 'NONE',
      })),
      rentChanges: t.rentChanges.map((r) => ({ id: r.id, amountPence: r.amountPence, effectiveFrom: fromDbReq(r.effectiveFrom), createdAt: r.createdAt.toISOString() })),
      deposit: d
        ? {
            amountPence: d.amountPence,
            receivedOn,
            scheme: d.scheme,
            schemeReference: d.schemeReference,
            protectedOn: fromDb(d.protectedOn),
            prescribedInfoOn: fromDb(d.prescribedInfoOn),
            returnedOn: fromDb(d.returnedOn),
            returnedPence: d.returnedPence,
            deductions: d.deductions.map((x) => ({ id: x.id, reason: x.reason, amountPence: x.amountPence })),
            protectionOverdue: !!protectBy && protectBy < today,
            protectBy,
          }
        : null,
      guarantors: t.guarantors.map((g) => ({ id: g.id, name: g.name, email: g.email, phone: g.phone, address: g.address, notes: g.notes })),
      nextDueDate: this.ledger.next(t, today),
      arrearsPence: alloc.arrearsPence,
      daysOverdue: alloc.daysOverdue,
    };
  }

  async get(ctx: StaffContext, id: string) {
    return this.detail(await this.load(ctx, id));
  }

  private async afterWrite(ctx: { workspaceId: string }, tenancyId: string) {
    // Charges are generated on the queue; the daily job catches anything this misses.
    await this.queue.add('work', 'charges', { tenancyId });
    await this.redis.invalidate(ctx.workspaceId);
  }

  async create(ctx: StaffContext, input: z.infer<typeof tenancySchema>) {
    const unit = await this.prisma.unit.findFirst({ where: { id: input.unitId, property: { workspaceId: ctx.workspaceId, archivedAt: null } }, include: { property: true } });
    if (!unit) throw notFound('Unit');
    const tenantIds = [...new Set(input.tenantIds)];
    const tenants = await this.prisma.tenant.findMany({ where: { id: { in: tenantIds }, workspaceId: ctx.workspaceId, anonymisedAt: null } });
    if (tenants.length !== tenantIds.length) throw notFound('Tenant');
    if (input.frequency === 'MONTHLY' && !input.dueDay) throw new BadRequestException({ message: 'Choose the day rent is due.', field: 'dueDay' });

    // One unit can't have two tenancies at the same time.
    const others = await this.prisma.tenancy.findMany({ where: { unitId: unit.id, archivedAt: null } });
    for (const o of others) {
      const end = effectiveEnd(tenancyDates(o));
      const overlaps = (!end || end >= input.startDate) && (!input.endDate || fromDbReq(o.startDate) <= input.endDate);
      if (overlaps) {
        throw new ConflictException({ code: 'OVERLAP', message: `${unit.name === 'Whole property' ? 'This property' : unit.name} already has a tenancy for those dates.`, field: 'startDate' });
      }
    }

    const t = await this.prisma.$transaction(async (tx) => {
      const created = await tx.tenancy.create({
        data: {
          workspaceId: ctx.workspaceId,
          unitId: unit.id,
          startDate: toDb(input.startDate)!,
          endDate: toDb(input.endDate),
          frequency: input.frequency,
          dueDay: input.frequency === 'MONTHLY' ? input.dueDay : Number(input.startDate.slice(8, 10)),
          remindersEnabled: input.remindersEnabled,
          tenants: { create: tenantIds.map((tenantId) => ({ tenantId })) },
          rentChanges: { create: { amountPence: input.rentPence, effectiveFrom: toDb(input.startDate)!, createdById: ctx.userId } },
          ...(input.deposit ? { deposit: { create: { amountPence: input.deposit.amountPence, receivedOn: toDb(input.deposit.receivedOn) } } } : {}),
        },
      });
      await this.activity.record(
        {
          workspaceId: ctx.workspaceId,
          actor: actorOf(ctx),
          action: 'tenancy.created',
          summary: `Created a tenancy from ${formatDate(input.startDate)} at ${formatPence(input.rentPence)}`,
          propertyId: unit.propertyId,
          tenancyId: created.id,
        },
        tx,
      );
      for (const tenant of tenants) {
        await this.activity.record({ workspaceId: ctx.workspaceId, actor: actorOf(ctx), action: 'tenancy.created', summary: `Added to a tenancy at ${unit.property.addressLine1}`, tenantId: tenant.id, tenancyId: created.id }, tx);
      }
      return created;
    });
    await this.afterWrite(ctx, t.id);
    return this.get(ctx, t.id);
  }

  async update(ctx: StaffContext, id: string, input: z.infer<typeof tenancyUpdateSchema>) {
    const t = await this.load(ctx, id);
    if (input.endDate && input.endDate <= fromDbReq(t.startDate)) throw new BadRequestException({ message: 'End date must be after the start.', field: 'endDate' });
    const remindersChanged = input.remindersEnabled !== undefined && input.remindersEnabled !== t.remindersEnabled;
    await this.prisma.$transaction(async (tx) => {
      await tx.tenancy.update({
        where: { id },
        data: { ...(input.endDate !== undefined ? { endDate: toDb(input.endDate) } : {}), ...(input.remindersEnabled !== undefined ? { remindersEnabled: input.remindersEnabled } : {}) },
      });
      if (input.endDate) await this.ledger.reverseChargesAfter(id, input.endDate, ctx.userId, tx);
      const summary = remindersChanged ? (input.remindersEnabled ? 'Turned rent reminders on' : 'Turned rent reminders off') : input.endDate ? `Set the end date to ${formatDate(input.endDate)}` : 'Made the tenancy rolling';
      await this.activity.record({ workspaceId: ctx.workspaceId, actor: actorOf(ctx), action: 'tenancy.updated', summary, tenancyId: id, propertyId: t.unit.propertyId }, tx);
    });
    await this.afterWrite(ctx, id);
    return this.get(ctx, id);
  }

  // ---------- Rent changes ----------

  async addRentChange(ctx: StaffContext, id: string, input: z.infer<typeof rentChangeSchema>) {
    const t = await this.load(ctx, id);
    if (input.effectiveFrom <= fromDbReq(t.startDate)) throw new BadRequestException({ message: 'A rent change must start after the tenancy starts.', field: 'effectiveFrom' });
    if (t.rentChanges.some((r) => fromDbReq(r.effectiveFrom) === input.effectiveFrom)) throw new ConflictException({ message: 'There’s already a rent change on that date.', field: 'effectiveFrom' });
    const charged = t.chargedThrough ? fromDbReq(t.chargedThrough) : null;
    if (charged && input.effectiveFrom <= charged) {
      throw new BadRequestException({ message: `Rent has already been charged up to ${formatDate(charged)}. Choose a later date, or add a one-off charge or credit for the difference.`, field: 'effectiveFrom' });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.rentChange.create({ data: { tenancyId: id, amountPence: input.amountPence, effectiveFrom: toDb(input.effectiveFrom)!, createdById: ctx.userId } });
      await this.activity.record({ workspaceId: ctx.workspaceId, actor: actorOf(ctx), action: 'rent.changed', summary: `Changed the rent to ${formatPence(input.amountPence)} from ${formatDate(input.effectiveFrom)}`, tenancyId: id, propertyId: t.unit.propertyId }, tx);
    });
    await this.afterWrite(ctx, id);
    return this.get(ctx, id);
  }

  async removeRentChange(ctx: StaffContext, id: string, changeId: string) {
    const t = await this.load(ctx, id);
    const change = t.rentChanges.find((r) => r.id === changeId);
    if (!change) throw notFound('Rent change');
    if (change === t.rentChanges[0]) throw new BadRequestException({ message: 'The starting rent can’t be removed.' });
    const charged = t.chargedThrough ? fromDbReq(t.chargedThrough) : null;
    if (charged && fromDbReq(change.effectiveFrom) <= charged) throw new BadRequestException({ message: 'Rent has already been charged at this amount, so it can’t be removed.' });
    await this.prisma.rentChange.delete({ where: { id: changeId } });
    return this.get(ctx, id);
  }

  // ---------- Notice and ending ----------

  async giveNotice(ctx: StaffContext, id: string, input: z.infer<typeof noticeSchema>) {
    const t = await this.load(ctx, id);
    if (input.endDate < input.givenOn) throw new BadRequestException({ message: 'The end date can’t be before the notice date.', field: 'endDate' });
    if (input.endDate < fromDbReq(t.startDate)) throw new BadRequestException({ message: 'The end date can’t be before the tenancy starts.', field: 'endDate' });
    if (t.endedOn) throw new ConflictException({ message: 'This tenancy has already ended.' });
    await this.prisma.$transaction(async (tx) => {
      await tx.tenancy.update({ where: { id }, data: { noticeBy: input.givenBy, noticeGivenOn: toDb(input.givenOn), noticeEndDate: toDb(input.endDate) } });
      await this.ledger.reverseChargesAfter(id, input.endDate, ctx.userId, tx);
      await this.activity.record({ workspaceId: ctx.workspaceId, actor: actorOf(ctx), action: 'tenancy.notice', summary: `Recorded notice from the ${input.givenBy === 'TENANT' ? 'tenant' : 'landlord'}: the tenancy ends on ${formatDate(input.endDate)}`, tenancyId: id, propertyId: t.unit.propertyId }, tx);
    });
    await this.afterWrite(ctx, id);
    return this.get(ctx, id);
  }

  async withdrawNotice(ctx: StaffContext, id: string) {
    const t = await this.load(ctx, id);
    if (t.endedOn) throw new ConflictException({ message: 'This tenancy has already ended.' });
    await this.prisma.$transaction(async (tx) => {
      await tx.tenancy.update({ where: { id }, data: { noticeBy: null, noticeGivenOn: null, noticeEndDate: null } });
      await this.activity.record({ workspaceId: ctx.workspaceId, actor: actorOf(ctx), action: 'tenancy.notice.withdrawn', summary: 'Withdrew the notice', tenancyId: id, propertyId: t.unit.propertyId }, tx);
    });
    await this.afterWrite(ctx, id);
    return this.get(ctx, id);
  }

  async end(ctx: StaffContext, id: string, endedOn: string) {
    const t = await this.load(ctx, id);
    if (endedOn < fromDbReq(t.startDate)) throw new BadRequestException({ message: 'The tenancy can’t end before it starts.', field: 'endedOn' });
    await this.prisma.$transaction(async (tx) => {
      await tx.tenancy.update({ where: { id }, data: { endedOn: toDb(endedOn) } });
      await this.ledger.reverseChargesAfter(id, endedOn, ctx.userId, tx);
      await this.activity.record({ workspaceId: ctx.workspaceId, actor: actorOf(ctx), action: 'tenancy.ended', summary: `Ended the tenancy on ${formatDate(endedOn)}`, tenancyId: id, propertyId: t.unit.propertyId }, tx);
    });
    await this.redis.invalidate(ctx.workspaceId);
    return this.get(ctx, id);
  }

  // ---------- Guarantors ----------

  async addGuarantor(ctx: StaffContext, id: string, input: z.infer<typeof guarantorSchema>) {
    const t = await this.load(ctx, id);
    await this.prisma.guarantor.create({ data: { tenancyId: id, ...input } });
    await this.activity.record({ workspaceId: ctx.workspaceId, actor: actorOf(ctx), action: 'guarantor.added', summary: `Added ${input.name} as a guarantor`, tenancyId: id, propertyId: t.unit.propertyId });
    return this.get(ctx, id);
  }

  async updateGuarantor(ctx: StaffContext, id: string, guarantorId: string, input: z.infer<typeof guarantorSchema>) {
    await this.load(ctx, id);
    const res = await this.prisma.guarantor.updateMany({ where: { id: guarantorId, tenancyId: id }, data: input });
    if (!res.count) throw notFound('Guarantor');
    return this.get(ctx, id);
  }

  async removeGuarantor(ctx: StaffContext, id: string, guarantorId: string) {
    await this.load(ctx, id);
    const res = await this.prisma.guarantor.deleteMany({ where: { id: guarantorId, tenancyId: id } });
    if (!res.count) throw notFound('Guarantor');
    return this.get(ctx, id);
  }

  // ---------- Deposit ----------

  async saveDeposit(ctx: StaffContext, id: string, input: z.infer<typeof depositSchema>) {
    const t = await this.load(ctx, id);
    const data = {
      amountPence: input.amountPence,
      receivedOn: toDb(input.receivedOn),
      scheme: input.scheme ?? null,
      schemeReference: input.schemeReference,
      protectedOn: toDb(input.protectedOn),
      prescribedInfoOn: toDb(input.prescribedInfoOn),
    };
    await this.prisma.$transaction(async (tx) => {
      await tx.deposit.upsert({ where: { tenancyId: id }, create: { tenancyId: id, ...data }, update: data });
      const justProtected = input.protectedOn && !t.deposit?.protectedOn;
      await this.activity.record({ workspaceId: ctx.workspaceId, actor: actorOf(ctx), action: justProtected ? 'deposit.protected' : 'deposit.updated', summary: justProtected ? `Marked the deposit as protected on ${formatDate(input.protectedOn!)}` : `Updated the deposit (${formatPence(input.amountPence)})`, tenancyId: id, propertyId: t.unit.propertyId }, tx);
    });
    await this.redis.invalidate(ctx.workspaceId);
    return this.get(ctx, id);
  }

  async returnDeposit(ctx: StaffContext, id: string, input: z.infer<typeof depositReturnSchema>) {
    const t = await this.load(ctx, id);
    if (!t.deposit) throw new BadRequestException({ message: 'Record the deposit first.' });
    const deducted = input.deductions.reduce((s, d) => s + d.amountPence, 0);
    if (deducted > t.deposit.amountPence) throw new BadRequestException({ message: `Deductions can’t be more than the deposit (${formatPence(t.deposit.amountPence)}).` });
    const depositId = t.deposit.id;
    const returned = t.deposit.amountPence - deducted;
    await this.prisma.$transaction(async (tx) => {
      await tx.depositDeduction.deleteMany({ where: { depositId } });
      if (input.deductions.length) await tx.depositDeduction.createMany({ data: input.deductions.map((d) => ({ depositId, reason: d.reason, amountPence: d.amountPence })) });
      await tx.deposit.update({ where: { id: depositId }, data: { returnedOn: toDb(input.returnedOn), returnedPence: returned } });
      await this.activity.record({ workspaceId: ctx.workspaceId, actor: actorOf(ctx), action: 'deposit.returned', summary: `Recorded the deposit return: ${formatPence(returned)} returned${deducted ? `, ${formatPence(deducted)} deducted` : ''}`, tenancyId: id, propertyId: t.unit.propertyId }, tx);
    });
    return this.get(ctx, id);
  }
}

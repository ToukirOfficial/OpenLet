import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { PAYMENT_METHOD_LABELS, addDays, effectiveEnd, formatDateShort, formatDate, formatPence, londonDate, type IsoDate, type Ledger, type LedgerRow } from '@openlet/shared';
import { ActivityService } from '../common/activity.service.js';
import { actorOf, type StaffContext } from '../common/auth-context.js';
import { fromDb } from '../common/dates.js';
import { notFound } from '../common/not-found.js';
import { PrismaService } from '../prisma.service.js';
import { fromDbReq, tenancyDates, toDb } from '../common/dates.js';
import { RedisService } from '../redis.service.js';
import type { LedgerEntry, Prisma } from '../generated/prisma/client.js';
import { allocate, type Entry } from './allocation.js';
import { nextDueDate, rentPeriods, type ScheduleInput } from './schedule.js';

/** Charges appear this many days before they're due, so tenants see what's coming. */
export const CHARGE_AHEAD_DAYS = 14;

type TenancyForSchedule = Prisma.TenancyGetPayload<{ include: { rentChanges: true } }>;

export const toEntry = (e: LedgerEntry): Entry => ({ id: e.id, type: e.type, amountPence: e.amountPence, date: fromDbReq(e.date), createdAt: e.createdAt, reversesId: e.reversesId });

/** Plain description of a ledger entry, for screens and statements. */
export function describe(e: Pick<LedgerEntry, 'type' | 'description' | 'periodStart' | 'periodEnd' | 'method'>): string {
  if (e.type === 'RENT_CHARGE' && e.periodStart && e.periodEnd) {
    return `Rent ${formatDateShort(fromDbReq(e.periodStart))} – ${formatDate(fromDbReq(e.periodEnd))}`;
  }
  if (e.type === 'PAYMENT') return `Payment${e.method ? ` (${PAYMENT_METHOD_LABELS[e.method].toLowerCase()})` : ''}`;
  return e.description ?? (e.type === 'CREDIT' ? 'Credit' : e.type === 'REVERSAL' ? 'Reversal' : 'Charge');
}

export function scheduleOf(t: TenancyForSchedule): ScheduleInput {
  const dates = tenancyDates(t);
  return {
    startDate: dates.startDate,
    endDate: effectiveEnd(dates),
    frequency: t.frequency,
    dueDay: t.dueDay,
    rentChanges: t.rentChanges.map((r) => ({ amountPence: r.amountPence, effectiveFrom: fromDbReq(r.effectiveFrom) })),
  };
}

@Injectable()
export class LedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly activity: ActivityService,
  ) {}

  /** The full ledger for one tenancy, oldest first, with a running balance. Shared by staff and the tenant portal. */
  async ledger(tenancyId: string, today: IsoDate = londonDate()): Promise<Ledger> {
    const t = await this.prisma.tenancy.findUniqueOrThrow({ where: { id: tenancyId }, include: { rentChanges: true } });
    const entries = (await this.entriesFor([tenancyId])).get(tenancyId) ?? [];
    const alloc = allocate(entries.map(toEntry), today);
    const states = new Map(alloc.charges.map((c) => [c.id, c]));
    const creators = [...new Set(entries.map((e) => e.createdById).filter(Boolean))] as string[];
    const names = new Map((await this.prisma.user.findMany({ where: { id: { in: creators } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));
    let running = 0;
    const rows: LedgerRow[] = entries.map((e) => {
      const isCharge = e.type === 'RENT_CHARGE' || e.type === 'OTHER_CHARGE';
      const reversal = e.type === 'REVERSAL';
      const original = reversal ? entries.find((x) => x.id === e.reversesId) : undefined;
      // A reversal moves the balance the opposite way to the entry it cancels.
      const originalIsCharge = original && (original.type === 'RENT_CHARGE' || original.type === 'OTHER_CHARGE');
      const signed = isCharge ? e.amountPence : reversal ? (originalIsCharge ? -e.amountPence : e.amountPence) : -e.amountPence;
      running += signed;
      const state = states.get(e.id);
      return {
        id: e.id,
        type: e.type,
        date: fromDbReq(e.date),
        description: describe(e),
        periodStart: fromDb(e.periodStart),
        periodEnd: fromDb(e.periodEnd),
        method: e.method,
        reference: e.reference,
        signedPence: signed,
        amountPence: e.amountPence,
        runningBalancePence: running,
        status: isCharge && !alloc.reversed.has(e.id) ? (state?.status ?? null) : null,
        outstandingPence: isCharge && !alloc.reversed.has(e.id) ? (state?.outstandingPence ?? 0) : null,
        reversed: alloc.reversed.has(e.id),
        reversesId: e.reversesId,
        createdBy: e.createdById ? (names.get(e.createdById) ?? null) : null,
      };
    });
    return { tenancyId, rows, balancePence: alloc.balancePence, arrearsPence: alloc.arrearsPence, daysOverdue: alloc.daysOverdue, creditPence: alloc.creditPence, nextDueDate: nextDueDate(scheduleOf(t), today) };
  }

  private async tenancyFor(ctx: StaffContext, tenancyId: string) {
    const t = await this.prisma.tenancy.findFirst({ where: { id: tenancyId, workspaceId: ctx.workspaceId }, include: { unit: { select: { propertyId: true } } } });
    if (!t) throw notFound('Tenancy');
    return t;
  }

  async ledgerFor(ctx: StaffContext, tenancyId: string) {
    await this.tenancyFor(ctx, tenancyId);
    return this.ledger(tenancyId);
  }

  /** Payments, one-off charges and credits. Append-only: mistakes are reversed, never edited. */
  async record(
    ctx: StaffContext,
    kind: 'PAYMENT' | 'OTHER_CHARGE' | 'CREDIT',
    input: { tenancyId: string; date: IsoDate; amountPence: number; method?: LedgerRow['method']; reference?: string | null; description?: string },
  ) {
    const t = await this.tenancyFor(ctx, input.tenancyId);
    if (kind === 'PAYMENT' && input.date > londonDate()) throw new BadRequestException({ message: 'A payment can’t be dated in the future.', field: 'date' });
    await this.prisma.$transaction(async (tx) => {
      await tx.ledgerEntry.create({
        data: {
          workspaceId: ctx.workspaceId,
          tenancyId: t.id,
          type: kind,
          amountPence: input.amountPence,
          date: toDb(input.date)!,
          method: kind === 'PAYMENT' ? (input.method ?? 'OTHER') : null,
          reference: input.reference ?? null,
          description: input.description ?? (kind === 'PAYMENT' ? 'Payment' : null),
          createdById: ctx.userId,
        },
      });
      const what = kind === 'PAYMENT' ? `Recorded a payment of ${formatPence(input.amountPence)} (${PAYMENT_METHOD_LABELS[input.method ?? 'OTHER'].toLowerCase()})` : kind === 'CREDIT' ? `Added a credit of ${formatPence(input.amountPence)}: ${input.description}` : `Added a charge of ${formatPence(input.amountPence)}: ${input.description}`;
      await this.activity.record({ workspaceId: ctx.workspaceId, actor: actorOf(ctx), action: `ledger.${kind.toLowerCase()}`, summary: what, tenancyId: t.id, propertyId: t.unit.propertyId }, tx);
    });
    await this.redis.invalidate(ctx.workspaceId);
    return this.ledger(t.id);
  }

  async reverse(ctx: StaffContext, entryId: string, reason: string) {
    const e = await this.prisma.ledgerEntry.findFirst({ where: { id: entryId, workspaceId: ctx.workspaceId }, include: { reversedBy: true, tenancy: { include: { unit: { select: { propertyId: true } } } } } });
    if (!e) throw notFound('Ledger entry');
    if (e.type === 'REVERSAL') throw new BadRequestException({ message: 'A reversal can’t be reversed. Add a new entry instead.' });
    if (e.reversedBy) throw new ConflictException({ message: 'This entry has already been reversed.' });
    await this.prisma.$transaction(async (tx) => {
      await tx.ledgerEntry.create({
        data: { workspaceId: e.workspaceId, tenancyId: e.tenancyId, type: 'REVERSAL', amountPence: e.amountPence, date: toDb(londonDate())!, reversesId: e.id, description: `Reversed: ${reason}`, createdById: ctx.userId },
      });
      await this.activity.record({ workspaceId: ctx.workspaceId, actor: actorOf(ctx), action: 'ledger.reversal', summary: `Reversed ${describe(e).toLowerCase()} (${formatPence(e.amountPence)}): ${reason}`, tenancyId: e.tenancyId, propertyId: e.tenancy.unit.propertyId }, tx);
    });
    await this.redis.invalidate(ctx.workspaceId);
    return this.ledger(e.tenancyId);
  }

  /** Every tenancy with overdue rent, biggest and oldest first. */
  async arrears(ctx: StaffContext, sort: 'amount' | 'age' = 'amount') {
    const tenancies = await this.prisma.tenancy.findMany({
      where: { workspaceId: ctx.workspaceId, archivedAt: null },
      include: { unit: { include: { property: true } }, tenants: { include: { tenant: { select: { firstName: true, lastName: true } } } } },
    });
    const entries = await this.entriesFor(tenancies.map((t) => t.id));
    const today = londonDate();
    const items = tenancies
      .map((t) => {
        const list = entries.get(t.id) ?? [];
        const a = allocate(list.map(toEntry), today);
        const lastPayment = [...list].reverse().find((e) => e.type === 'PAYMENT');
        return {
          tenancyId: t.id,
          tenantNames: t.tenants.map((x) => `${x.tenant.firstName} ${x.tenant.lastName}`).join(' and '),
          address: `${t.unit.name === 'Whole property' ? '' : `${t.unit.name}, `}${t.unit.property.addressLine1}, ${t.unit.property.town}`,
          arrearsPence: a.arrearsPence,
          daysOverdue: a.daysOverdue,
          oldestUnpaidDue: a.oldestUnpaidDue!,
          lastPayment: lastPayment ? fromDbReq(lastPayment.date) : null,
          remindersEnabled: t.remindersEnabled,
        };
      })
      .filter((x) => x.arrearsPence > 0);
    items.sort((a, b) => (sort === 'age' ? b.daysOverdue - a.daysOverdue || b.arrearsPence - a.arrearsPence : b.arrearsPence - a.arrearsPence || b.daysOverdue - a.daysOverdue));
    return { items, totalPence: items.reduce((s, i) => s + i.arrearsPence, 0) };
  }

  /** Ledger entries for several tenancies at once, grouped by tenancy. */
  async entriesFor(tenancyIds: string[]) {
    const rows = tenancyIds.length ? await this.prisma.ledgerEntry.findMany({ where: { tenancyId: { in: tenancyIds } }, orderBy: [{ date: 'asc' }, { createdAt: 'asc' }] }) : [];
    const map = new Map<string, LedgerEntry[]>();
    for (const r of rows) map.set(r.tenancyId, [...(map.get(r.tenancyId) ?? []), r]);
    return map;
  }

  async balances(tenancyIds: string[], today: IsoDate = londonDate()) {
    const entries = await this.entriesFor(tenancyIds);
    return new Map(tenancyIds.map((id) => [id, allocate((entries.get(id) ?? []).map(toEntry), today)]));
  }

  next(t: TenancyForSchedule, today: IsoDate = londonDate()) {
    return nextDueDate(scheduleOf(t), today);
  }

  /**
   * Creates any missing rent charges for one tenancy up to `today + 14 days`. Idempotent: the unique key
   * (tenancy, RENT_CHARGE, periodStart) means a period is never charged twice, however often this runs.
   * Never charges after the tenancy's last day.
   */
  async generateFor(tenancyId: string, today: IsoDate = londonDate()): Promise<number> {
    const t = await this.prisma.tenancy.findUnique({ where: { id: tenancyId }, include: { rentChanges: true } });
    if (!t || t.archivedAt) return 0;
    const through = addDays(today, CHARGE_AHEAD_DAYS);
    const periods = rentPeriods(scheduleOf(t), through);
    if (!periods.length) return 0;
    const res = await this.prisma.ledgerEntry.createMany({
      data: periods.map((p) => ({
        workspaceId: t.workspaceId,
        tenancyId: t.id,
        type: 'RENT_CHARGE' as const,
        amountPence: p.amountPence,
        date: toDb(p.dueDate)!,
        periodStart: toDb(p.periodStart),
        periodEnd: toDb(p.periodEnd),
        description: 'Rent',
      })),
      skipDuplicates: true,
    });
    await this.prisma.tenancy.update({ where: { id: t.id }, data: { chargedThrough: toDb(periods.at(-1)!.periodStart) } });
    if (res.count) await this.redis.invalidate(t.workspaceId);
    return res.count;
  }

  /** The daily job: every tenancy that may need charges (not archived, not ended long ago). */
  async generateAll(today: IsoDate = londonDate()) {
    const tenancies = await this.prisma.tenancy.findMany({
      where: { archivedAt: null, OR: [{ endedOn: null }, { endedOn: { gte: toDb(addDays(today, -60))! } }] },
      select: { id: true },
    });
    let created = 0;
    for (const t of tenancies) created += await this.generateFor(t.id, today);
    return created;
  }

  /**
   * When a tenancy ends early, rent charges for periods starting after its last day are reversed
   * (append-only: a REVERSAL entry, never a delete).
   */
  async reverseChargesAfter(tenancyId: string, lastDay: IsoDate, actorId: string | null, tx: Prisma.TransactionClient) {
    const late = await tx.ledgerEntry.findMany({ where: { tenancyId, type: 'RENT_CHARGE', periodStart: { gt: toDb(lastDay)! }, reversedBy: null } });
    for (const c of late) {
      await tx.ledgerEntry.create({
        data: { workspaceId: c.workspaceId, tenancyId, type: 'REVERSAL', amountPence: c.amountPence, date: c.date, reversesId: c.id, description: 'Rent charge reversed: the tenancy ended before this period', createdById: actorId },
      });
    }
    return late.length;
  }
}

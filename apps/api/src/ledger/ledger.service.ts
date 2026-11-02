import { Injectable } from '@nestjs/common';
import { addDays, effectiveEnd, londonDate, type IsoDate } from '@openlet/shared';
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
  ) {}

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

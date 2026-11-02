import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { rentPeriods, type ScheduleInput } from '../src/ledger/schedule.js';
import { LedgerService } from '../src/ledger/ledger.service.js';
import { createProperty, startApp, workspaceWithTeam, type TestContext } from './helpers.js';

const monthly = (startDate: string, dueDay: number, extra: Partial<ScheduleInput> = {}): ScheduleInput => ({
  startDate,
  endDate: null,
  frequency: 'MONTHLY',
  dueDay,
  rentChanges: [{ amountPence: 100000, effectiveFrom: startDate }],
  ...extra,
});
const dues = (input: ScheduleInput, through: string) => rentPeriods(input, through).map((p) => p.dueDate);

describe('rent schedule: monthly', () => {
  it('charges on the due day every month, first charge on the start date', () => {
    expect(dues(monthly('2026-01-15', 15), '2026-04-30')).toEqual(['2026-01-15', '2026-02-15', '2026-03-15', '2026-04-15']);
  });

  it('a due day of 31 falls back to the last day of shorter months, and returns to the 31st', () => {
    expect(dues(monthly('2026-01-31', 31), '2026-05-31')).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31']);
  });

  it('29 and 30 in February, including a leap year', () => {
    expect(dues(monthly('2027-12-29', 29), '2028-03-31')).toEqual(['2027-12-29', '2028-01-29', '2028-02-29', '2028-03-29']);
    expect(dues(monthly('2026-01-30', 30), '2026-03-31')).toEqual(['2026-01-30', '2026-02-28', '2026-03-30']);
  });

  it('a start part-way through the month is charged on the start date, then on the due day', () => {
    const periods = rentPeriods(monthly('2026-03-20', 1), '2026-05-31');
    expect(periods.map((p) => [p.periodStart, p.periodEnd])).toEqual([
      ['2026-03-20', '2026-03-31'],
      ['2026-04-01', '2026-04-30'],
      ['2026-05-01', '2026-05-31'],
    ]);
  });

  it('periods run to the day before the next due date', () => {
    const [first] = rentPeriods(monthly('2026-01-31', 31), '2026-01-31');
    expect(first).toMatchObject({ periodStart: '2026-01-31', periodEnd: '2026-02-27' });
  });
});

describe('rent schedule: weekly and four-weekly', () => {
  it('weekly counts seven days from the start date, whatever the due day', () => {
    const input: ScheduleInput = { ...monthly('2026-02-25', 3), frequency: 'WEEKLY' };
    expect(dues(input, '2026-03-19')).toEqual(['2026-02-25', '2026-03-04', '2026-03-11', '2026-03-18']);
  });

  it('four-weekly counts 28 days from the start date', () => {
    const input: ScheduleInput = { ...monthly('2026-01-05', 1), frequency: 'FOUR_WEEKLY' };
    const periods = rentPeriods(input, '2026-04-30');
    expect(periods.map((p) => p.dueDate)).toEqual(['2026-01-05', '2026-02-02', '2026-03-02', '2026-03-30', '2026-04-27']);
    expect(periods[0]).toMatchObject({ periodEnd: '2026-02-01' });
  });
});

describe('rent schedule: rent changes and end dates', () => {
  it('uses the new rent for periods starting on or after the change', () => {
    const input = monthly('2026-01-01', 1, {
      rentChanges: [
        { amountPence: 100000, effectiveFrom: '2026-01-01' },
        { amountPence: 105000, effectiveFrom: '2026-03-01' },
        { amountPence: 110000, effectiveFrom: '2026-04-15' },
      ],
    });
    expect(rentPeriods(input, '2026-05-31').map((p) => p.amountPence)).toEqual([100000, 100000, 105000, 105000, 110000]);
  });

  it('never charges after the end date, and the last period stops on it', () => {
    const periods = rentPeriods(monthly('2026-01-10', 10, { endDate: '2026-03-20' }), '2026-12-31');
    expect(periods.map((p) => p.dueDate)).toEqual(['2026-01-10', '2026-02-10', '2026-03-10']);
    expect(periods.at(-1)!.periodEnd).toBe('2026-03-20');
  });

  it('a weekly tenancy ending mid-week gets no charge after the end', () => {
    const input: ScheduleInput = { ...monthly('2026-01-01', 1), frequency: 'WEEKLY', endDate: '2026-01-20' };
    expect(dues(input, '2026-12-31')).toEqual(['2026-01-01', '2026-01-08', '2026-01-15']);
  });

  it('nothing before the start date', () => {
    expect(dues(monthly('2026-06-01', 1), '2026-05-31')).toEqual([]);
  });
});

describe('charge generation in the database', () => {
  let ctx: TestContext;
  let ledger: LedgerService;
  beforeAll(async () => {
    ctx = await startApp();
    ledger = ctx.app.get(LedgerService);
  });
  afterAll(async () => ctx.app.close());

  async function tenancy(start: string, end: string | null, dueDay: number) {
    const { ws } = await workspaceWithTeam(ctx.prisma);
    const p = await createProperty(ctx.prisma, ws.id);
    return ctx.prisma.tenancy.create({
      data: { workspaceId: ws.id, unitId: p.units[0]!.id, startDate: new Date(`${start}T00:00:00Z`), endDate: end ? new Date(`${end}T00:00:00Z`) : null, frequency: 'MONTHLY', dueDay, rentChanges: { create: { amountPence: 90000, effectiveFrom: new Date(`${start}T00:00:00Z`) } } },
    });
  }

  it('is idempotent: running it again never creates a charge twice', async () => {
    const t = await tenancy('2026-01-31', null, 31);
    expect(await ledger.generateFor(t.id, '2026-05-01')).toBe(4); // 31 Jan, 28 Feb, 31 Mar, 30 Apr (through 15 May)
    expect(await ledger.generateFor(t.id, '2026-05-01')).toBe(0);
    await Promise.all([ledger.generateFor(t.id, '2026-05-20'), ledger.generateFor(t.id, '2026-05-20')]);
    const rows = await ctx.prisma.ledgerEntry.findMany({ where: { tenancyId: t.id, type: 'RENT_CHARGE' }, orderBy: { date: 'asc' } });
    expect(rows.map((r) => r.date.toISOString().slice(0, 10))).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31']);
  });

  it('charges up to 14 days ahead and stops at the end date', async () => {
    const t = await tenancy('2026-01-01', '2026-03-31', 1);
    await ledger.generateFor(t.id, '2026-02-10');
    expect(await ctx.prisma.ledgerEntry.count({ where: { tenancyId: t.id } })).toBe(2);
    await ledger.generateFor(t.id, '2026-02-20');
    expect(await ctx.prisma.ledgerEntry.count({ where: { tenancyId: t.id } })).toBe(3);
    await ledger.generateFor(t.id, '2026-09-01');
    expect(await ctx.prisma.ledgerEntry.count({ where: { tenancyId: t.id } })).toBe(3);
  });
});

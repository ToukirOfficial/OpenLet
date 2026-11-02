import { addDays, addMonthsClamped, parseIsoDate, type IsoDate, type RentFrequency } from '@openlet/shared';

export interface ScheduleInput {
  startDate: IsoDate;
  /** Last day of the tenancy (ended date, notice end date or fixed end), or null when rolling. */
  endDate: IsoDate | null;
  frequency: RentFrequency;
  /** Monthly only: day of the month (29–31 fall back to the month's last day). */
  dueDay: number;
  /** Rent history: each amount applies to periods starting on or after its date. */
  rentChanges: { amountPence: number; effectiveFrom: IsoDate }[];
}

export interface RentPeriod {
  periodStart: IsoDate;
  periodEnd: IsoDate;
  dueDate: IsoDate;
  amountPence: number;
}

/** The rent in force on a date: the latest change that started on or before it (the first change if none). */
export function rentOn(changes: ScheduleInput['rentChanges'], date: IsoDate): number {
  const sorted = [...changes].sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? -1 : 1));
  let amount = sorted[0]?.amountPence ?? 0;
  for (const c of sorted) if (c.effectiveFrom <= date) amount = c.amountPence;
  return amount;
}

/** Due dates from the start, in order, as a lazy sequence. */
function* dueDates(input: ScheduleInput): Generator<IsoDate> {
  if (input.frequency === 'WEEKLY' || input.frequency === 'FOUR_WEEKLY') {
    const step = input.frequency === 'WEEKLY' ? 7 : 28;
    for (let d = input.startDate; ; d = addDays(d, step)) yield d;
  }
  // Monthly: the first charge is due on the start date; after that on the due day of each month,
  // clamped to the month's last day (so the 31st becomes 30 April, 28 or 29 February).
  yield input.startDate;
  const { y, m } = parseIsoDate(input.startDate);
  for (let n = 0; ; n++) {
    const d = addMonthsClamped(y, m, n, input.dueDay);
    if (d > input.startDate) yield d;
  }
}

/**
 * Every rent period that starts on or before `through`, and never after the tenancy's last day. A period
 * runs from its due date to the day before the next one (or the tenancy's last day). Pure and deterministic:
 * the same tenancy always gives the same periods, which is what makes charge generation idempotent.
 */
export function rentPeriods(input: ScheduleInput, through: IsoDate): RentPeriod[] {
  const out: RentPeriod[] = [];
  const it = dueDates(input);
  let current = it.next().value as IsoDate;
  while (current <= through && (!input.endDate || current <= input.endDate)) {
    const next = it.next().value as IsoDate;
    let periodEnd = addDays(next, -1);
    if (input.endDate && periodEnd > input.endDate) periodEnd = input.endDate;
    out.push({ periodStart: current, periodEnd, dueDate: current, amountPence: rentOn(input.rentChanges, current) });
    current = next;
  }
  return out;
}

/** The next due date on or after `from`, or null when the tenancy has ended by then. */
export function nextDueDate(input: ScheduleInput, from: IsoDate): IsoDate | null {
  for (const d of dueDates(input)) {
    if (input.endDate && d > input.endDate) return null;
    if (d >= from) return d;
  }
  return null;
}

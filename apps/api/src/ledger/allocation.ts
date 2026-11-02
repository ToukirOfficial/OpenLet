import { daysBetween, type IsoDate, type LedgerType } from '@openlet/shared';

export interface Entry {
  id: string;
  type: LedgerType;
  amountPence: number;
  date: IsoDate;
  createdAt: Date;
  reversesId: string | null;
}

export interface ChargeState {
  id: string;
  date: IsoDate;
  amountPence: number;
  paidPence: number;
  outstandingPence: number;
  status: 'PAID' | 'PART_PAID' | 'UNPAID' | 'UPCOMING';
}

export interface Allocation {
  /** Charges due up to today minus all payments and credits. Negative = in credit. */
  balancePence: number;
  /** Unpaid amount of charges whose due date has passed (London day). */
  arrearsPence: number;
  /** Days since the oldest unpaid overdue charge was due; 0 when nothing is overdue. */
  daysOverdue: number;
  oldestUnpaidDue: IsoDate | null;
  /** Money paid beyond every charge so far (shown as a credit). */
  creditPence: number;
  charges: ChargeState[];
  reversed: Set<string>;
}

const isCharge = (t: LedgerType) => t === 'RENT_CHARGE' || t === 'OTHER_CHARGE';
const isMoneyIn = (t: LedgerType) => t === 'PAYMENT' || t === 'CREDIT';

/**
 * Payments and credits go to the oldest unpaid charges first; anything left over is a credit on the
 * balance. A reversal cancels its original entry entirely (the ledger itself is never edited). Charges
 * due after today are allocated last, so money paid in advance shows as credit until the charge is due.
 */
export function allocate(entries: Entry[], today: IsoDate): Allocation {
  const reversed = new Set(entries.filter((e) => e.type === 'REVERSAL' && e.reversesId).map((e) => e.reversesId!));
  const live = entries.filter((e) => e.type !== 'REVERSAL' && !reversed.has(e.id));
  const charges = live
    .filter((e) => isCharge(e.type))
    .sort((a, b) => (a.date === b.date ? a.createdAt.getTime() - b.createdAt.getTime() : a.date < b.date ? -1 : 1));
  let pool = live.filter((e) => isMoneyIn(e.type)).reduce((s, e) => s + e.amountPence, 0);

  const states: ChargeState[] = charges.map((c) => {
    const paid = Math.min(pool, c.amountPence);
    pool -= paid;
    const outstanding = c.amountPence - paid;
    const status: ChargeState['status'] = outstanding === 0 ? 'PAID' : c.date > today ? 'UPCOMING' : paid > 0 ? 'PART_PAID' : 'UNPAID';
    return { id: c.id, date: c.date, amountPence: c.amountPence, paidPence: paid, outstandingPence: outstanding, status };
  });

  const dueCharges = charges.filter((c) => c.date <= today).reduce((s, c) => s + c.amountPence, 0);
  const moneyIn = live.filter((e) => isMoneyIn(e.type)).reduce((s, e) => s + e.amountPence, 0);
  const overdue = states.filter((s) => s.outstandingPence > 0 && s.date < today);
  const oldest = overdue[0]?.date ?? null;
  return {
    balancePence: dueCharges - moneyIn,
    arrearsPence: overdue.reduce((s, c) => s + c.outstandingPence, 0),
    daysOverdue: oldest ? daysBetween(oldest, today) : 0,
    oldestUnpaidDue: oldest,
    creditPence: pool,
    charges: states,
    reversed,
  };
}

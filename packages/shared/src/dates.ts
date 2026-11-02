/**
 * Calendar dates are plain "YYYY-MM-DD" strings (London calendar days). Timestamps are UTC ISO strings,
 * shown in Europe/London. Pure functions, no time-zone library: Intl does the London conversion.
 */
export const LONDON = 'Europe/London';
export type IsoDate = string;

const pad = (n: number) => String(n).padStart(2, '0');

/** The London calendar day for an instant. */
export function londonDate(at: Date = new Date()): IsoDate {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: LONDON, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(at)
    .reduce<Record<string, string>>((acc, p) => ((acc[p.type] = p.value), acc), {});
  return `${parts['year']}-${parts['month']}-${parts['day']}`;
}

export function parseIsoDate(d: IsoDate): { y: number; m: number; day: number } {
  const [y, m, day] = d.split('-').map(Number);
  return { y: y!, m: m!, day: day! };
}

export function toIsoDate(y: number, m: number, day: number): IsoDate {
  return `${y}-${pad(m)}-${pad(day)}`;
}

/** Midnight UTC for a calendar date (how Prisma stores @db.Date). */
export const dateToUtc = (d: IsoDate) => new Date(`${d}T00:00:00.000Z`);
export const utcToDate = (d: Date): IsoDate => d.toISOString().slice(0, 10);

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function addDays(d: IsoDate, n: number): IsoDate {
  const t = dateToUtc(d);
  t.setUTCDate(t.getUTCDate() + n);
  return utcToDate(t);
}

/** Adds months, clamping to the last day when the month is shorter (31 Jan + 1 month = 28/29 Feb). */
export function addMonthsClamped(y: number, m: number, n: number, dueDay: number): IsoDate {
  const idx = y * 12 + (m - 1) + n;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  return toIsoDate(ny, nm, Math.min(dueDay, daysInMonth(ny, nm)));
}

export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((dateToUtc(to).getTime() - dateToUtc(from).getTime()) / 86_400_000);
}

export const minDate = (a: IsoDate, b: IsoDate) => (a < b ? a : b);
export const maxDate = (a: IsoDate, b: IsoDate) => (a > b ? a : b);

const LONG = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const SHORT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** "2 November 2026" */
export function formatDate(d: IsoDate | null | undefined): string {
  return d ? LONG.format(dateToUtc(d)) : '—';
}
/** "2 Nov" */
export function formatDateShort(d: IsoDate | null | undefined): string {
  return d ? SHORT.format(dateToUtc(d)) : '—';
}
/** "2 November 2026, 14:05" in London time. */
export function formatDateTime(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: LONDON,
  }).format(typeof iso === 'string' ? new Date(iso) : iso);
}

import { addDays, londonDate, type IsoDate } from './dates.js';
import type { PropertyStatus, TenancyStatus } from './enums.js';

export interface TenancyDates {
  startDate: IsoDate;
  endDate: IsoDate | null;
  noticeEndDate: IsoDate | null;
  endedOn: IsoDate | null;
}

/** The last day of the tenancy as things stand: ended date, else the notice end date, else the fixed end date. */
export const effectiveEnd = (t: TenancyDates): IsoDate | null => t.endedOn ?? t.noticeEndDate ?? t.endDate;

/**
 * Upcoming before the start date; ended after the last day; ending once notice is given; otherwise active.
 * Uses the London calendar day.
 */
export function tenancyStatus(t: TenancyDates, today: IsoDate = londonDate()): TenancyStatus {
  const end = effectiveEnd(t);
  if (t.endedOn && t.endedOn < today) return 'ENDED';
  if (end && end < today) return 'ENDED';
  if (t.startDate > today) return 'UPCOMING';
  if (t.noticeEndDate) return 'ENDING';
  return 'ACTIVE';
}

/** "Ending soon" window for properties and the dashboard. */
export const ENDING_SOON_DAYS = 60;

/**
 * A property is vacant when any of its units has no current tenancy, ending soon when a current tenancy
 * has notice or ends within 60 days, otherwise occupied.
 */
export function propertyStatus(units: { tenancies: TenancyDates[] }[], today: IsoDate = londonDate()): PropertyStatus {
  let endingSoon = false;
  for (const u of units) {
    const current = u.tenancies.filter((t) => ['ACTIVE', 'ENDING'].includes(tenancyStatus(t, today)));
    if (!current.length) return 'VACANT';
    for (const t of current) {
      const end = effectiveEnd(t);
      if (tenancyStatus(t, today) === 'ENDING' || (end && end <= addDays(today, ENDING_SOON_DAYS))) endingSoon = true;
    }
  }
  if (!units.length) return 'VACANT';
  return endingSoon ? 'ENDING_SOON' : 'OCCUPIED';
}

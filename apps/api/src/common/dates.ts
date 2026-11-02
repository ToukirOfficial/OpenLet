import { dateToUtc, utcToDate, type IsoDate } from '@openlet/shared';

/** Prisma @db.Date values <-> "YYYY-MM-DD" London calendar days. */
export const toDb = (d: IsoDate | null | undefined) => (d ? dateToUtc(d) : null);
export const fromDb = (d: Date | null | undefined): IsoDate | null => (d ? utcToDate(d) : null);
export const fromDbReq = (d: Date): IsoDate => utcToDate(d);
export const tenancyDates = (t: { startDate: Date; endDate: Date | null; noticeEndDate: Date | null; endedOn: Date | null }) => ({
  startDate: fromDbReq(t.startDate),
  endDate: fromDb(t.endDate),
  noticeEndDate: fromDb(t.noticeEndDate),
  endedOn: fromDb(t.endedOn),
});

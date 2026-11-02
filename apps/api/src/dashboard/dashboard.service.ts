import { BadRequestException, Injectable } from '@nestjs/common';
import {
  CERTIFICATE_TYPES,
  DOCUMENT_TYPE_LABELS,
  ENDING_SOON_DAYS,
  OPEN_REPAIR_STATUSES,
  addDays,
  daysBetween,
  effectiveEnd,
  formatDate,
  formatPence,
  londonDate,
  tenancyStatus,
  utcToDate,
  type AttentionItem,
  type CalendarEvent,
  type Dashboard,
  type IsoDate,
} from '@openlet/shared';
import { PrismaService } from '../prisma.service.js';
import type { StaffContext } from '../common/auth-context.js';
import { fromDb, fromDbReq, tenancyDates, toDb } from '../common/dates.js';
import { readSettings } from '../common/settings.js';
import { ComplianceService, currentCertificate } from '../compliance/compliance.service.js';
import { allocate } from '../ledger/allocation.js';
import { LedgerService, scheduleOf, toEntry } from '../ledger/ledger.service.js';
import { rentPeriods } from '../ledger/schedule.js';
import { RedisService } from '../redis.service.js';
import { unitLabel } from '../tenancies/tenancies.service.js';

const monthKey = (d: IsoDate) => d.slice(0, 7);

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly compliance: ComplianceService,
    private readonly redis: RedisService,
  ) {}

  /** Cached for a minute; any write that changes these numbers clears the cache (RedisService.invalidate). */
  dashboard(ctx: StaffContext): Promise<Dashboard> {
    return this.redis.cached(`dashboard:${ctx.workspaceId}`, 60, () => this.build(ctx.workspaceId));
  }

  private async build(workspaceId: string): Promise<Dashboard> {
    const today = londonDate();
    const weekEnd = addDays(today, 6);
    const [tenancies, units, repairs, board, ws] = await Promise.all([
      this.prisma.tenancy.findMany({
        where: { workspaceId, archivedAt: null },
        include: { unit: { include: { property: true } }, tenants: { include: { tenant: { select: { firstName: true, lastName: true } } } }, deposit: true },
      }),
      this.prisma.unit.findMany({ where: { property: { workspaceId, archivedAt: null } }, include: { tenancies: { where: { archivedAt: null } } } }),
      this.prisma.repair.findMany({ where: { workspaceId, status: { in: [...OPEN_REPAIR_STATUSES] } }, include: { property: true } }),
      this.compliance.board(workspaceId),
      this.prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { settings: true } }),
    ]);
    const settings = readSettings(ws.settings);
    const entries = await this.ledger.entriesFor(tenancies.map((t) => t.id));
    const attention: AttentionItem[] = [];
    let dueWeekPence = 0;
    let dueWeekCount = 0;
    let overduePence = 0;
    let overdueCount = 0;
    let endingSoon = 0;

    for (const t of tenancies) {
      const names = t.tenants.map((x) => `${x.tenant.firstName} ${x.tenant.lastName}`).join(' and ');
      const where = `${unitLabel(t.unit.name)}${t.unit.property.addressLine1}`;
      const list = entries.get(t.id) ?? [];
      const a = allocate(list.map(toEntry), today);
      for (const c of a.charges) {
        if (c.date >= today && c.date <= weekEnd && c.outstandingPence > 0) {
          dueWeekPence += c.outstandingPence;
          dueWeekCount++;
        }
      }
      if (a.arrearsPence > 0) {
        overduePence += a.arrearsPence;
        overdueCount++;
        attention.push({ kind: 'ARREARS', severity: a.daysOverdue > 14 ? 'bad' : 'warn', title: `${formatPence(a.arrearsPence)} rent overdue`, detail: `${names}, ${where}: ${a.daysOverdue} days late`, href: `/app/tenancies/${t.id}?tab=rent` });
      }
      const status = tenancyStatus(tenancyDates(t), today);
      const end = effectiveEnd(tenancyDates(t));
      if ((status === 'ACTIVE' || status === 'ENDING') && end && end <= addDays(today, ENDING_SOON_DAYS)) {
        endingSoon++;
        if (end <= addDays(today, 30)) attention.push({ kind: 'ENDING', severity: 'warn', title: `Tenancy ends ${formatDate(end)}`, detail: `${names}, ${where}`, href: `/app/tenancies/${t.id}` });
      }
      const d = t.deposit;
      const received = fromDb(d?.receivedOn);
      if (d && received && !d.protectedOn && !d.returnedOn && status !== 'ENDED' && today >= addDays(received, settings.reminders.depositProtectDays)) {
        attention.push({ kind: 'DEPOSIT', severity: 'bad', title: 'Deposit not marked as protected', detail: `${formatPence(d.amountPence)} from ${names}, received ${formatDate(received)}`, href: `/app/tenancies/${t.id}?tab=deposit` });
      }
    }

    const now = new Date();
    const overdueRepairs = repairs.filter((r) => r.targetAt < now);
    for (const r of overdueRepairs) attention.push({ kind: 'REPAIR_OVERDUE', severity: 'bad', title: `Repair past its target: ${r.title}`, detail: `#${r.reference}, ${r.property.addressLine1}`, href: `/app/repairs/${r.id}` });
    for (const r of repairs.filter((x) => x.status === 'REPORTED' && x.targetAt >= now)) attention.push({ kind: 'REPAIR_NEW', severity: 'warn', title: `New repair: ${r.title}`, detail: `#${r.reference}, ${r.property.addressLine1}`, href: `/app/repairs/${r.id}` });

    for (const row of board.rows) {
      for (const c of row.cells) {
        const label = DOCUMENT_TYPE_LABELS[c.type];
        if (c.status === 'EXPIRED') attention.push({ kind: 'CERT_EXPIRED', severity: 'bad', title: `${label} expired`, detail: `${row.address}, since ${formatDate(c.expiresOn)}`, href: `/app/properties/${row.propertyId}?tab=documents` });
        else if (c.status === 'MISSING') attention.push({ kind: 'CERT_MISSING', severity: 'warn', title: `${label} missing`, detail: row.address, href: `/app/properties/${row.propertyId}?tab=documents` });
        else if (c.status === 'EXPIRING' && (c.daysLeft ?? 99) <= 30) attention.push({ kind: 'CERT_EXPIRING', severity: 'warn', title: `${label} expires in ${c.daysLeft} days`, detail: row.address, href: `/app/properties/${row.propertyId}?tab=documents` });
      }
    }

    const rtr = await this.prisma.tenant.findMany({ where: { workspaceId, anonymisedAt: null, rightToRent: { some: { expiresOn: { lte: toDb(addDays(today, settings.reminders.rightToRentDaysBefore))! } } } }, include: { rightToRent: { orderBy: { checkedOn: 'desc' }, take: 1 } } });
    for (const t of rtr) {
      const ends = fromDb(t.rightToRent[0]?.expiresOn);
      if (ends && ends <= addDays(today, settings.reminders.rightToRentDaysBefore)) attention.push({ kind: 'RIGHT_TO_RENT', severity: ends < today ? 'bad' : 'warn', title: 'Right to Rent follow-up due', detail: `${t.firstName} ${t.lastName}: permission ends ${formatDate(ends)}`, href: `/app/tenants/${t.id}` });
    }

    const vacant = units.filter((u) => !u.tenancies.some((t) => ['ACTIVE', 'ENDING'].includes(tenancyStatus(tenancyDates(t), today)))).length;

    // Money received per month for the last six months (payments, less reversed ones).
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
      d.setUTCMonth(d.getUTCMonth() - (5 - i));
      return utcToDate(d).slice(0, 7);
    });
    const income = new Map(months.map((m) => [m, 0]));
    for (const list of entries.values()) {
      const reversed = new Set(list.filter((e) => e.type === 'REVERSAL').map((e) => e.reversesId));
      for (const e of list) if (e.type === 'PAYMENT' && !reversed.has(e.id)) {
        const k = monthKey(fromDbReq(e.date));
        if (income.has(k)) income.set(k, income.get(k)! + e.amountPence);
      }
    }

    const sev = { bad: 0, warn: 1 } as const;
    attention.sort((a, b) => sev[a.severity] - sev[b.severity]);
    return {
      stats: {
        rentDueThisWeekPence: dueWeekPence,
        rentDueThisWeekCount: dueWeekCount,
        overduePence,
        overdueCount,
        openRepairs: repairs.length,
        overdueRepairs: overdueRepairs.length,
        certificatesExpiring: board.counts.EXPIRING,
        certificatesExpired: board.counts.EXPIRED,
        certificatesMissing: board.counts.MISSING,
        endingSoon,
        vacantUnits: vacant,
        totalUnits: units.length,
      },
      attention: attention.slice(0, 12),
      income: months.map((m) => ({ month: m, pence: income.get(m)! })),
    };
  }

  /** Everything with a date between `from` and `to` (at most about three months). */
  async calendar(ctx: StaffContext, from: IsoDate, to: IsoDate): Promise<CalendarEvent[]> {
    if (to < from || daysBetween(from, to) > 100) throw new BadRequestException({ message: 'Choose a range of up to three months.' });
    const workspaceId = ctx.workspaceId;
    const events: CalendarEvent[] = [];
    const tenancies = await this.prisma.tenancy.findMany({
      where: { workspaceId, archivedAt: null },
      include: { unit: { include: { property: true } }, tenants: { include: { tenant: { select: { firstName: true, lastName: true } } } }, rentChanges: true },
    });
    const today = londonDate();
    for (const t of tenancies) {
      const names = t.tenants.map((x) => `${x.tenant.firstName} ${x.tenant.lastName}`).join(' and ');
      const where = `${unitLabel(t.unit.name)}${t.unit.property.addressLine1}`;
      const dates = tenancyDates(t);
      const end = effectiveEnd(dates);
      if (dates.startDate >= from && dates.startDate <= to) events.push({ date: dates.startDate, kind: 'TENANCY_START', title: 'Tenancy starts', detail: `${names}, ${where}`, href: `/app/tenancies/${t.id}` });
      if (end && end >= from && end <= to) events.push({ date: end, kind: 'TENANCY_END', title: 'Tenancy ends', detail: `${names}, ${where}`, href: `/app/tenancies/${t.id}` });
      if (tenancyStatus(dates, today) === 'ENDED') continue;
      for (const p of rentPeriods(scheduleOf(t), to)) {
        if (p.dueDate >= from) events.push({ date: p.dueDate, kind: 'RENT_DUE', title: `Rent ${formatPence(p.amountPence)}`, detail: `${names}, ${where}`, href: `/app/tenancies/${t.id}?tab=rent` });
      }
    }
    const visits = await this.prisma.repair.findMany({
      where: { workspaceId, visitAt: { gte: new Date(`${from}T00:00:00Z`), lte: new Date(`${addDays(to, 1)}T00:00:00Z`) }, status: { notIn: ['CANCELLED'] } },
      include: { property: true, contractor: true },
    });
    for (const r of visits) {
      const date = londonDate(r.visitAt!);
      if (date >= from && date <= to) events.push({ date, kind: 'REPAIR_VISIT', title: `Visit: ${r.title}`, detail: `${r.property.addressLine1}${r.contractor ? `, ${r.contractor.name}` : ''}`, href: `/app/repairs/${r.id}`, at: r.visitAt!.toISOString() });
    }
    const props = await this.prisma.property.findMany({ where: { workspaceId, archivedAt: null }, include: { documents: { where: { type: { in: [...CERTIFICATE_TYPES] }, ready: true } } } });
    for (const p of props) {
      for (const type of CERTIFICATE_TYPES) {
        const doc = currentCertificate(p.documents.filter((d) => d.type === type));
        const exp = fromDb(doc?.expiresOn);
        if (doc && exp && exp >= from && exp <= to) events.push({ date: exp, kind: 'CERT_EXPIRY', title: `${DOCUMENT_TYPE_LABELS[type]} expires`, detail: p.addressLine1, href: `/app/properties/${p.id}?tab=documents` });
      }
    }
    const order = { REPAIR_VISIT: 0, RENT_DUE: 1, CERT_EXPIRY: 2, TENANCY_START: 3, TENANCY_END: 4 } as const;
    return events.sort((a, b) => a.date.localeCompare(b.date) || order[a.kind] - order[b.kind]);
  }
}

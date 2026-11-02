import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { stringify } from 'csv-stringify/sync';
import {
  FREQUENCY_LABELS,
  TENANCY_STATUS_LABELS,
  daysBetween,
  effectiveEnd,
  londonDate,
  tenancyStatus,
  type IncomeReport,
  type IsoDate,
  type MaintenanceRow,
  type RentRollRow,
} from '@openlet/shared';
import { PrismaService } from '../prisma.service.js';
import { ActivityService } from '../common/activity.service.js';
import type { StaffContext } from '../common/auth-context.js';
import { fromDbReq, tenancyDates, toDb } from '../common/dates.js';
import { ExportsService } from '../exports/exports.service.js';
import { LedgerService } from '../ledger/ledger.service.js';
import { formatAddress } from '../properties/properties.service.js';
import { unitLabel } from '../tenancies/tenancies.service.js';
import type { ExportJob } from '../generated/prisma/client.js';
import { WorkspaceExportService } from './workspace-export.service.js';

export type ReportKind = 'rent-roll' | 'income' | 'arrears' | 'maintenance';
const pounds = (p: number) => (p / 100).toFixed(2);

function monthsBetween(from: IsoDate, to: IsoDate) {
  const out: string[] = [];
  let [y, m] = from.slice(0, 7).split('-').map(Number) as [number, number];
  const end = to.slice(0, 7);
  while (`${y}-${String(m).padStart(2, '0')}` <= end && out.length < 36) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

@Injectable()
export class ReportsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly exports: ExportsService,
    private readonly activity: ActivityService,
    private readonly fullExport: WorkspaceExportService,
  ) {}

  onModuleInit() {
    this.exports.register('report-csv', (job) => this.buildCsv(job));
    this.exports.register('workspace-export', (job) => this.fullExport.build(job));
  }

  async rentRoll(workspaceId: string): Promise<RentRollRow[]> {
    const today = londonDate();
    const rows = await this.prisma.tenancy.findMany({
      where: { workspaceId, archivedAt: null },
      include: { unit: { include: { property: true } }, tenants: { include: { tenant: { select: { firstName: true, lastName: true } } } }, rentChanges: { orderBy: { effectiveFrom: 'asc' } } },
      orderBy: { startDate: 'asc' },
    });
    const live = rows.filter((t) => tenancyStatus(tenancyDates(t), today) !== 'ENDED');
    const balances = await this.ledger.balances(live.map((t) => t.id), today);
    return live.map((t) => {
      const rent = [...t.rentChanges].reverse().find((r) => fromDbReq(r.effectiveFrom) <= today) ?? t.rentChanges[0];
      return {
        tenancyId: t.id,
        address: unitLabel(t.unit.name) + formatAddress(t.unit.property),
        tenantNames: t.tenants.map((x) => `${x.tenant.firstName} ${x.tenant.lastName}`).join(' and '),
        status: tenancyStatus(tenancyDates(t), today),
        rentPence: rent?.amountPence ?? 0,
        frequency: t.frequency,
        startDate: fromDbReq(t.startDate),
        endDate: effectiveEnd(tenancyDates(t)),
        balancePence: balances.get(t.id)?.balancePence ?? 0,
      };
    });
  }

  /** Money received (payments, less reversed payments) per month and property. */
  async income(workspaceId: string, from: IsoDate, to: IsoDate): Promise<IncomeReport> {
    if (to < from || daysBetween(from, to) > 3 * 366) throw new BadRequestException({ message: 'Choose a range of up to three years.' });
    const months = monthsBetween(from, to);
    const entries = await this.prisma.ledgerEntry.findMany({
      where: { workspaceId, type: { in: ['PAYMENT', 'REVERSAL'] }, date: { gte: toDb(from)!, lte: toDb(to)! } },
      include: { reverses: true, tenancy: { include: { unit: { include: { property: true } } } } },
    });
    const byProperty = new Map<string, { address: string; byMonth: number[] }>();
    for (const e of entries) {
      const isPayment = e.type === 'PAYMENT';
      if (!isPayment && e.reverses?.type !== 'PAYMENT') continue;
      const p = e.tenancy.unit.property;
      const row = byProperty.get(p.id) ?? { address: formatAddress(p), byMonth: months.map(() => 0) };
      const i = months.indexOf(fromDbReq(e.date).slice(0, 7));
      if (i >= 0) row.byMonth[i]! += isPayment ? e.amountPence : -e.amountPence;
      byProperty.set(p.id, row);
    }
    const rows = [...byProperty.entries()].map(([propertyId, r]) => ({ propertyId, ...r, totalPence: r.byMonth.reduce((s, x) => s + x, 0) })).sort((a, b) => a.address.localeCompare(b.address));
    const totals = months.map((_, i) => rows.reduce((s, r) => s + r.byMonth[i]!, 0));
    return { months, rows, totals, totalPence: totals.reduce((s, x) => s + x, 0) };
  }

  /** Repair costs per property, for repairs reported in the range. */
  async maintenance(workspaceId: string, from: IsoDate, to: IsoDate): Promise<MaintenanceRow[]> {
    const repairs = await this.prisma.repair.findMany({
      where: { workspaceId, costPence: { not: null }, createdAt: { gte: new Date(`${from}T00:00:00Z`), lte: new Date(`${to}T23:59:59Z`) } },
      include: { property: true, contractor: true },
      orderBy: { createdAt: 'asc' },
    });
    const map = new Map<string, MaintenanceRow>();
    for (const r of repairs) {
      const row = map.get(r.propertyId) ?? { propertyId: r.propertyId, address: formatAddress(r.property), repairs: 0, costPence: 0, items: [] };
      row.repairs++;
      row.costPence += r.costPence ?? 0;
      row.items.push({ reference: r.reference, title: r.title, date: londonDate(r.createdAt), costPence: r.costPence ?? 0, contractor: r.contractor?.name ?? null });
      map.set(r.propertyId, row);
    }
    return [...map.values()].sort((a, b) => b.costPence - a.costPence);
  }

  /** CSVs are made on the queue; Owners and Managers only. */
  async requestCsv(ctx: StaffContext, kind: ReportKind, params: { from?: string; to?: string }) {
    await this.activity.audit({ workspaceId: ctx.workspaceId, userId: ctx.userId, action: 'report.exported', targetType: kind, ip: ctx.ip });
    return this.exports.request(ctx, 'report-csv', { kind, ...params });
  }

  async requestFullExport(ctx: StaffContext) {
    await this.activity.audit({ workspaceId: ctx.workspaceId, userId: ctx.userId, action: 'export.requested', targetType: 'workspace', ip: ctx.ip });
    return this.exports.request(ctx, 'workspace-export', {});
  }

  private async buildCsv(job: ExportJob) {
    const p = job.params as { kind: ReportKind; from?: string; to?: string };
    const ws = job.workspaceId;
    let records: (string | number)[][];
    if (p.kind === 'rent-roll') {
      records = [['Property', 'Tenants', 'Status', 'Rent (£)', 'Frequency', 'Start', 'End', 'Balance (£)'], ...(await this.rentRoll(ws)).map((r) => [r.address, r.tenantNames, TENANCY_STATUS_LABELS[r.status as 'ACTIVE'], pounds(r.rentPence), FREQUENCY_LABELS[r.frequency as 'MONTHLY'], r.startDate, r.endDate ?? 'Rolling', pounds(r.balancePence)])];
    } else if (p.kind === 'income') {
      const rep = await this.income(ws, p.from!, p.to!);
      records = [['Property', ...rep.months, 'Total (£)'], ...rep.rows.map((r) => [r.address, ...r.byMonth.map(pounds), pounds(r.totalPence)]), ['Total', ...rep.totals.map(pounds), pounds(rep.totalPence)]];
    } else if (p.kind === 'arrears') {
      const rep = await this.ledger.arrears({ workspaceId: ws } as StaffContext);
      records = [['Tenants', 'Property', 'Overdue (£)', 'Days late', 'Oldest unpaid due', 'Last payment'], ...rep.items.map((a) => [a.tenantNames, a.address, pounds(a.arrearsPence), a.daysOverdue, a.oldestUnpaidDue, a.lastPayment ?? ''])];
    } else {
      const rep = await this.maintenance(ws, p.from!, p.to!);
      records = [['Property', 'Repair', 'Title', 'Reported', 'Contractor', 'Cost (£)'], ...rep.flatMap((r) => r.items.map((i) => [r.address, `#${i.reference}`, i.title, i.date, i.contractor ?? '', pounds(i.costPence)]))];
    }
    const csv = stringify(records);
    const suffix = p.from && p.to ? `-${p.from}-to-${p.to}` : `-${londonDate()}`;
    return { buffer: Buffer.from(String.fromCharCode(0xfeff) + csv, 'utf8'), fileName: `${p.kind}${suffix}.csv`, mime: 'text/csv' as const };
  }
}

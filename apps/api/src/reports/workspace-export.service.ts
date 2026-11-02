import { Injectable } from '@nestjs/common';
import { PassThrough } from 'node:stream';
import { ZipArchive } from 'archiver';
import { stringify } from 'csv-stringify/sync';
import { londonDate } from '@openlet/shared';
import { PrismaService } from '../prisma.service.js';
import { StorageService } from '../files/storage.service.js';
import { downloadName } from '../documents/documents.service.js';
import type { ExportJob } from '../generated/prisma/client.js';

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v);

/** Turns rows into a CSV with a header from the first row's keys (dates as ISO text). */
function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]!);
  return stringify([cols, ...rows.map((r) => cols.map((c) => iso(r[c]) ?? ''))]);
}

/**
 * Full data export for portability: every record as CSV, plus every document, in one zip. Passwords,
 * tokens and internal ids of other workspaces are never included.
 */
@Injectable()
export class WorkspaceExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async build(job: ExportJob) {
    const workspaceId = job.workspaceId;
    const w = { workspaceId };
    const [properties, units, tenants, rtr, tenancies, tenancyTenants, rentChanges, guarantors, deposits, deductions, ledger, contractors, repairs, repairEvents, documents, messages, notes] = await Promise.all([
      this.prisma.property.findMany({ where: w, omit: { workspaceId: true } }),
      this.prisma.unit.findMany({ where: { property: w } }),
      this.prisma.tenant.findMany({ where: w, omit: { workspaceId: true, userId: true } }),
      this.prisma.rightToRentCheck.findMany({ where: { tenant: w } }),
      this.prisma.tenancy.findMany({ where: w, omit: { workspaceId: true } }),
      this.prisma.tenancyTenant.findMany({ where: { tenancy: w } }),
      this.prisma.rentChange.findMany({ where: { tenancy: w }, omit: { createdById: true } }),
      this.prisma.guarantor.findMany({ where: { tenancy: w } }),
      this.prisma.deposit.findMany({ where: { tenancy: w } }),
      this.prisma.depositDeduction.findMany({ where: { deposit: { tenancy: w } } }),
      this.prisma.ledgerEntry.findMany({ where: w, omit: { workspaceId: true, createdById: true }, orderBy: [{ tenancyId: 'asc' }, { date: 'asc' }] }),
      this.prisma.contractor.findMany({ where: w, omit: { workspaceId: true } }),
      this.prisma.repair.findMany({ where: w, omit: { workspaceId: true } }),
      this.prisma.repairEvent.findMany({ where: { repair: w }, omit: { actorId: true } }),
      this.prisma.document.findMany({ where: w }),
      this.prisma.message.findMany({ where: w, omit: { workspaceId: true, authorUserId: true } }),
      this.prisma.note.findMany({ where: w, omit: { workspaceId: true, authorId: true } }),
    ]);

    const zip = new ZipArchive({ zlib: { level: 6 } });
    const out = new PassThrough();
    const chunks: Buffer[] = [];
    out.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<void>((resolve, reject) => {
      out.on('end', () => resolve());
      zip.on('error', reject);
    });
    zip.pipe(out);
    const tables: Record<string, Record<string, unknown>[]> = {
      properties, units, tenants, right_to_rent_checks: rtr, tenancies, tenancy_tenants: tenancyTenants, rent_changes: rentChanges, guarantors, deposits, deposit_deductions: deductions,
      ledger, contractors, repairs, repair_events: repairEvents, messages, notes,
      documents: documents.map(({ storageKey: _k, workspaceId: _w, uploadedById: _u, ...d }) => ({ ...d, file: `documents/${d.id}-${downloadName(d)}` })),
    };
    for (const [name, rows] of Object.entries(tables)) zip.append(toCsv(rows), { name: `${name}.csv` });
    for (const d of documents) {
      const file = await this.storage.read(d.storageKey).catch(() => null);
      if (file) zip.append(file, { name: `documents/${d.id}-${downloadName(d)}` });
    }
    zip.append('OpenLet data export. Amounts are in pence (GBP). Dates are UTC; calendar dates are London days.\n', { name: 'README.txt' });
    await zip.finalize();
    await done;
    return { buffer: Buffer.concat(chunks), fileName: `openlet-export-${londonDate()}.zip`, mime: 'application/zip' as const };
  }
}

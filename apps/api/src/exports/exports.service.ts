import { ForbiddenException, Injectable, Logger, NotFoundException, StreamableFile } from '@nestjs/common';
import { londonDate, type JobInfo } from '@openlet/shared';
import { PrismaService } from '../prisma.service.js';
import { ActivityService } from '../common/activity.service.js';
import { StorageService } from '../files/storage.service.js';
import { QueueService } from '../jobs/queue.service.js';
import { LedgerService } from '../ledger/ledger.service.js';
import { formatAddress } from '../properties/properties.service.js';
import type { ExportJob, Prisma } from '../generated/prisma/client.js';
import { statementPdf } from './statement-pdf.js';

/** Finished files are kept this long, then the hourly clean-up removes them. */
const KEEP_MS = 24 * 3600 * 1000;

export type JobKind = 'statement' | 'report-csv' | 'workspace-export';
type Who = { workspaceId: string; userId: string; ip: string | null };

const info = (j: ExportJob): JobInfo => ({ id: j.id, status: j.status, fileName: j.fileName, error: j.error });

/**
 * PDFs, CSVs and the full data export are made on the queue (never inside a request). The person who
 * asked for a file is the only one who can download it.
 */
@Injectable()
export class ExportsService {
  private readonly logger = new Logger('Exports');
  /** Extra kinds registered by other modules (reports, the full export). */
  private readonly builders = new Map<string, (job: ExportJob) => Promise<{ buffer: Buffer; fileName: string; mime: 'application/pdf' | 'text/csv' | 'application/zip' }>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly queue: QueueService,
    private readonly ledger: LedgerService,
    private readonly activity: ActivityService,
  ) {
    this.builders.set('statement', (job) => this.buildStatement(job));
  }

  register(kind: JobKind, build: (job: ExportJob) => Promise<{ buffer: Buffer; fileName: string; mime: 'application/pdf' | 'text/csv' | 'application/zip' }>) {
    this.builders.set(kind, build);
  }

  async request(who: Who, kind: JobKind, params: Record<string, unknown>) {
    const job = await this.prisma.exportJob.create({ data: { workspaceId: who.workspaceId, requestedById: who.userId, kind, params: params as Prisma.InputJsonValue } });
    await this.queue.add('work', 'export', { jobId: job.id });
    return info(job);
  }

  private async mine(who: Who, id: string) {
    const job = await this.prisma.exportJob.findFirst({ where: { id, workspaceId: who.workspaceId } });
    if (!job) throw new NotFoundException({ message: 'Not found.' });
    if (job.requestedById !== who.userId) throw new ForbiddenException({ message: 'Only the person who asked for this file can download it.' });
    return job;
  }

  async status(who: Who, id: string) {
    return info(await this.mine(who, id));
  }

  async download(who: Who, id: string) {
    const job = await this.mine(who, id);
    if (job.status !== 'READY' || !job.storageKey) throw new NotFoundException({ message: 'This file isn’t ready yet.' });
    if (job.kind !== 'statement') await this.activity.audit({ workspaceId: who.workspaceId, userId: who.userId, action: 'export.downloaded', targetType: job.kind, targetId: job.id, ip: who.ip });
    return new StreamableFile(await this.storage.stream(job.storageKey), { type: job.mime ?? 'application/octet-stream', disposition: `attachment; filename="${job.fileName}"` });
  }

  /** Worker. */
  async run(jobId: string) {
    const job = await this.prisma.exportJob.findUnique({ where: { id: jobId } });
    if (!job || job.status !== 'PENDING') return;
    try {
      const build = this.builders.get(job.kind);
      if (!build) throw new Error(`Unknown export kind ${job.kind}`);
      const out = await build(job);
      const { key } = await this.storage.write(out.buffer, 'exports');
      await this.prisma.exportJob.update({ where: { id: job.id }, data: { status: 'READY', storageKey: key, fileName: out.fileName, mime: out.mime, expiresAt: new Date(Date.now() + KEEP_MS) } });
    } catch (e) {
      this.logger.error(`Export ${job.kind} failed: ${e instanceof Error ? e.message : 'unknown error'}`);
      await this.prisma.exportJob.update({ where: { id: job.id }, data: { status: 'FAILED', error: 'This file couldn’t be made. Please try again.' } });
    }
  }

  /** Hourly: remove expired files. */
  async purgeExpired() {
    const old = await this.prisma.exportJob.findMany({ where: { OR: [{ expiresAt: { lt: new Date() } }, { createdAt: { lt: new Date(Date.now() - 3 * KEEP_MS) } }] } });
    for (const j of old) if (j.storageKey) await this.storage.remove(j.storageKey);
    await this.prisma.exportJob.deleteMany({ where: { id: { in: old.map((j) => j.id) } } });
    return old.length;
  }

  private async buildStatement(job: ExportJob) {
    const p = job.params as { tenancyId: string; from: string; to: string };
    const t = await this.prisma.tenancy.findFirstOrThrow({
      where: { id: p.tenancyId, workspaceId: job.workspaceId },
      include: { unit: { include: { property: true } }, tenants: { include: { tenant: true } }, workspace: true },
    });
    const ledger = await this.ledger.ledger(t.id);
    const live = ledger.rows.filter((r) => !r.reversed && r.type !== 'REVERSAL');
    const opening = live.filter((r) => r.date < p.from).reduce((s, r) => s + r.signedPence, 0);
    const rows = live.filter((r) => r.date >= p.from && r.date <= p.to);
    const closing = opening + rows.reduce((s, r) => s + r.signedPence, 0);
    const ws = t.workspace;
    const buffer = await statementPdf({
      workspace: { name: ws.name, address: ws.address, contactEmail: ws.contactEmail, contactPhone: ws.contactPhone },
      logo: ws.logoKey ? await this.storage.read(ws.logoKey).catch(() => null) : null,
      tenantNames: t.tenants.map((x) => `${x.tenant.firstName} ${x.tenant.lastName}`).join(' and '),
      address: `${t.unit.name === 'Whole property' ? '' : `${t.unit.name}, `}${formatAddress(t.unit.property)}`,
      from: p.from,
      to: p.to,
      openingPence: opening,
      rows,
      closingPence: closing,
      generatedOn: londonDate(),
    });
    return { buffer, fileName: `rent-statement-${p.from}-to-${p.to}.pdf`, mime: 'application/pdf' as const };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { addDays, effectiveEnd, londonDate, type IsoDate } from '@openlet/shared';
import { PrismaService } from '../prisma.service.js';
import { ActivityService } from '../common/activity.service.js';
import { tenancyDates } from '../common/dates.js';
import { readSettings } from '../common/settings.js';
import { StorageService } from '../files/storage.service.js';

/** Ended tenancies are archived (hidden from lists) this long after their last day. */
export const ARCHIVE_AFTER_DAYS = 90;

export interface RetentionResult {
  archived: number;
  anonymised: number;
}

/**
 * Data retention (FEATURES 14). Runs daily. A tenant's personal details are anonymised once every one of
 * their tenancies ended more than the workspace's retention period ago (default 6 years). Rent amounts and
 * dates stay, so financial totals are unchanged; the person can no longer be identified.
 */
@Injectable()
export class RetentionService {
  private readonly logger = new Logger('Retention');

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly activity: ActivityService,
  ) {}

  async run(today: IsoDate = londonDate()): Promise<RetentionResult> {
    const result: RetentionResult = { archived: 0, anonymised: 0 };
    const workspaces = await this.prisma.workspace.findMany({ select: { id: true, settings: true } });
    for (const ws of workspaces) {
      const years = readSettings(ws.settings).retentionYears;
      try {
        result.archived += await this.archive(ws.id, today);
        result.anonymised += await this.anonymise(ws.id, years, today);
      } catch (e) {
        this.logger.error(`Retention run failed for a workspace: ${e instanceof Error ? e.message : 'unknown error'}`);
      }
    }
    return result;
  }

  private async archive(workspaceId: string, today: IsoDate) {
    const tenancies = await this.prisma.tenancy.findMany({ where: { workspaceId, archivedAt: null, OR: [{ endedOn: { not: null } }, { endDate: { not: null } }, { noticeEndDate: { not: null } }] } });
    const cutoff = addDays(today, -ARCHIVE_AFTER_DAYS);
    const ids = tenancies.filter((t) => {
      const end = effectiveEnd(tenancyDates(t));
      return !!end && end < cutoff;
    }).map((t) => t.id);
    if (ids.length) await this.prisma.tenancy.updateMany({ where: { id: { in: ids } }, data: { archivedAt: new Date() } });
    return ids.length;
  }

  /** The date `years` years before `today` (29 February falls back to the 28th). */
  private yearsBefore(today: IsoDate, years: number): IsoDate {
    const [y, m, d] = today.split('-').map(Number) as [number, number, number];
    const target = new Date(Date.UTC(y - years, m - 1, d));
    if (target.getUTCMonth() !== m - 1) target.setUTCDate(0);
    return target.toISOString().slice(0, 10);
  }

  private async anonymise(workspaceId: string, years: number, today: IsoDate) {
    const cutoff = this.yearsBefore(today, years);
    const tenants = await this.prisma.tenant.findMany({
      where: { workspaceId, anonymisedAt: null, tenancies: { some: {} } },
      include: { tenancies: { include: { tenancy: true } }, documents: true, rightToRent: true },
    });
    let n = 0;
    for (const t of tenants) {
      const ends = t.tenancies.map(({ tenancy }) => effectiveEnd(tenancyDates(tenancy)));
      // Every tenancy must have ended, and the latest end must be older than the cut-off.
      if (ends.some((e) => !e || e >= cutoff)) continue;
      const tenancyIds = t.tenancies.map((x) => x.tenancyId);
      const photos = await this.prisma.document.findMany({ where: { repair: { tenancyId: { in: tenancyIds } }, uploadedByType: 'TENANT' } });
      const files = [...t.documents, ...photos];
      await this.prisma.$transaction(async (tx) => {
        await tx.tenant.update({
          where: { id: t.id },
          data: { firstName: 'Former', lastName: 'tenant', email: null, phone: null, dateOfBirth: null, emergencyName: null, emergencyPhone: null, notes: null, userId: null, anonymisedAt: new Date() },
        });
        await tx.rightToRentCheck.deleteMany({ where: { tenantId: t.id } });
        await tx.invite.deleteMany({ where: { tenantId: t.id } });
        await tx.note.deleteMany({ where: { tenantId: t.id } });
        await tx.document.deleteMany({ where: { id: { in: files.map((f) => f.id) } } });
        // Guarantors and messages hold personal details too: only when the whole tenancy is done with.
        for (const tenancyId of tenancyIds) {
          const others = await tx.tenancyTenant.count({ where: { tenancyId, tenant: { anonymisedAt: null, NOT: { id: t.id } } } });
          if (others) continue;
          await tx.guarantor.updateMany({ where: { tenancyId }, data: { name: 'Former guarantor', email: null, phone: null, address: null, notes: null } });
          await tx.message.updateMany({ where: { tenancyId, authorType: 'TENANT' }, data: { authorName: 'Former tenant', authorUserId: null } });
          await tx.repair.updateMany({ where: { tenancyId }, data: { accessNotes: null, availability: null } });
        }
        await tx.repairEvent.updateMany({ where: { actorType: 'TENANT', repair: { tenancyId: { in: tenancyIds } } }, data: { actorName: 'Former tenant', actorId: null } });
        await tx.activity.updateMany({ where: { tenantId: t.id }, data: { summary: 'Tenant details anonymised' } });
      });
      await Promise.all(files.map((f) => this.storage.remove(f.storageKey)));
      await this.activity.audit({ workspaceId, action: 'tenant.anonymised', targetType: 'tenant', targetId: t.id });
      n++;
    }
    return n;
  }
}

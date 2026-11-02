import { Injectable, Logger } from '@nestjs/common';
import {
  CERTIFICATE_TYPES,
  DOCUMENT_TYPE_LABELS,
  LEGAL_NOTE,
  addDays,
  daysBetween,
  formatDate,
  formatPence,
  londonDate,
  tenancyStatus,
  type IsoDate,
} from '@openlet/shared';
import { config } from '../config.js';
import { PrismaService } from '../prisma.service.js';
import { fromDb, fromDbReq, tenancyDates } from '../common/dates.js';
import { readSettings, type WorkspaceSettings } from '../common/settings.js';
import { currentCertificate } from '../compliance/compliance.service.js';
import { allocate } from '../ledger/allocation.js';
import { LedgerService, toEntry } from '../ledger/ledger.service.js';
import { MailService } from '../mail/mail.service.js';
import { email } from '../mail/templates.js';
import { formatAddress } from '../properties/properties.service.js';

type Kind = 'rent-due' | 'rent-overdue' | 'certificate' | 'deposit' | 'right-to-rent';
type Ws = { id: string; name: string; settings: WorkspaceSettings };
export interface ReminderRunResult {
  sent: Record<Kind, number>;
}

/**
 * The daily reminder run. Every reminder is claimed in the ReminderSent table before it is sent; the
 * unique key (kind, item, step) means each item and step goes out at most once, even if the job runs
 * twice. Reminders stop by themselves when the reason is gone: rent paid, certificate renewed (a newer
 * certificate becomes the current one), deposit protected, new Right to Rent check recorded.
 */
@Injectable()
export class RemindersService {
  private readonly logger = new Logger('Reminders');

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly mail: MailService,
  ) {}

  /** True if this reminder hasn't been sent yet (and now never will be again). */
  private async claim(workspaceId: string, kind: Kind, itemId: string, step: string): Promise<boolean> {
    const res = await this.prisma.reminderSent.createMany({ data: [{ workspaceId, kind, itemId, step }], skipDuplicates: true });
    return res.count === 1;
  }

  /**
   * Claims the most recent step reached and marks the earlier ones as done without sending, so a late run
   * never sends a burst of old reminders. `latest` is 'max' for days late, 'min' for days before expiry.
   */
  private async claimLatest(workspaceId: string, kind: Kind, itemId: string, reached: number[], latest: 'max' | 'min'): Promise<number | null> {
    if (!reached.length) return null;
    const sorted = [...reached].sort((a, b) => (latest === 'max' ? b - a : a - b));
    const top = sorted[0]!;
    const fresh = await this.claim(workspaceId, kind, itemId, String(top));
    for (const lower of sorted.slice(1)) await this.claim(workspaceId, kind, itemId, String(lower));
    return fresh ? top : null;
  }

  private async managers(workspaceId: string) {
    const rows = await this.prisma.membership.findMany({ where: { workspaceId, role: { in: ['OWNER', 'MANAGER'] } }, include: { user: { select: { email: true, name: true } } } });
    return rows.map((r) => r.user);
  }

  async runDaily(today: IsoDate = londonDate()): Promise<ReminderRunResult> {
    const sent: Record<Kind, number> = { 'rent-due': 0, 'rent-overdue': 0, certificate: 0, deposit: 0, 'right-to-rent': 0 };
    const workspaces = await this.prisma.workspace.findMany({ select: { id: true, name: true, settings: true } });
    for (const w of workspaces) {
      const ws: Ws = { id: w.id, name: w.name, settings: readSettings(w.settings) };
      try {
        sent['rent-due'] += await this.rentDue(ws, today);
        sent['rent-overdue'] += await this.rentOverdue(ws, today);
        sent.certificate += await this.certificates(ws, today);
        sent.deposit += await this.deposits(ws, today);
        sent['right-to-rent'] += await this.rightToRent(ws, today);
      } catch (e) {
        this.logger.error(`Reminder run failed for a workspace: ${e instanceof Error ? e.message : 'unknown error'}`);
      }
    }
    return { sent };
  }

  private async liveTenancies(ws: Ws, today: IsoDate) {
    const rows = await this.prisma.tenancy.findMany({
      where: { workspaceId: ws.id, archivedAt: null, remindersEnabled: true },
      include: { unit: { include: { property: true } }, tenants: { include: { tenant: true } } },
    });
    return rows.filter((t) => ['ACTIVE', 'ENDING'].includes(tenancyStatus(tenancyDates(t), today)));
  }

  private async emailTenants(ws: Ws, t: Awaited<ReturnType<RemindersService['liveTenancies']>>[number], subject: string, heading: string, paragraphs: string[]) {
    let n = 0;
    for (const { tenant } of t.tenants) {
      if (!tenant.email || tenant.anonymisedAt) continue;
      await this.mail.send({
        to: tenant.email,
        workspaceId: ws.id,
        ...email({
          subject,
          from: ws.name,
          heading,
          paragraphs: [`Hello ${tenant.firstName},`, ...paragraphs],
          button: tenant.userId ? { label: 'See my rent', url: `${config().APP_URL}/portal/rent` } : undefined,
          footnote: 'If you’ve already paid, thank you, and please ignore this email.',
        }),
      });
      n++;
    }
    return n;
  }

  /** A friendly note N days before rent is due (default 3), for charges not already paid. */
  private async rentDue(ws: Ws, today: IsoDate) {
    let sent = 0;
    const before = ws.settings.reminders.rentDueDaysBefore;
    if (!before) return 0;
    for (const t of await this.liveTenancies(ws, today)) {
      const entries = (await this.ledger.entriesFor([t.id])).get(t.id) ?? [];
      const alloc = allocate(entries.map(toEntry), today);
      for (const c of alloc.charges) {
        const entry = entries.find((e) => e.id === c.id)!;
        if (entry.type !== 'RENT_CHARGE' || c.outstandingPence === 0) continue;
        if (c.date < today || c.date > addDays(today, before)) continue;
        if (!(await this.claim(ws.id, 'rent-due', c.id, 'due'))) continue;
        const when = c.date === today ? 'today' : `on ${formatDate(c.date)}`;
        if (await this.emailTenants(ws, t, `Rent of ${formatPence(c.outstandingPence)} is due ${when}`, 'A friendly rent reminder', [`Your rent of ${formatPence(c.outstandingPence)} for ${t.unit.property.addressLine1} is due ${when}.`])) sent++;
      }
    }
    return sent;
  }

  /** Overdue reminders at the configured steps (default 3, 7 and 14 days late) for the oldest unpaid charge. */
  private async rentOverdue(ws: Ws, today: IsoDate) {
    let sent = 0;
    const steps = ws.settings.reminders.overdueDays;
    if (!steps.length) return 0;
    for (const t of await this.liveTenancies(ws, today)) {
      const entries = (await this.ledger.entriesFor([t.id])).get(t.id) ?? [];
      const alloc = allocate(entries.map(toEntry), today);
      const oldest = alloc.charges.find((c) => c.outstandingPence > 0 && c.date < today);
      if (!oldest) continue;
      const late = daysBetween(oldest.date, today);
      const step = await this.claimLatest(ws.id, 'rent-overdue', oldest.id, steps.filter((s) => late >= s), 'max');
      if (step === null) continue;
      if (
        await this.emailTenants(ws, t, `Your rent is ${late} days overdue`, 'Your rent is overdue', [
          `Our records show ${formatPence(alloc.arrearsPence)} of rent for ${t.unit.property.addressLine1} is overdue. The oldest unpaid amount was due on ${formatDate(oldest.date)}.`,
          `Please pay as soon as you can, or contact ${ws.name} if you’re having difficulty. It’s always better to talk early.`,
        ])
      ) {
        sent++;
      }
    }
    return sent;
  }

  /** Certificate expiry reminders to Owners and Managers (default 60, 30 and 7 days before), and once on expiry. */
  private async certificates(ws: Ws, today: IsoDate) {
    const steps = ws.settings.reminders.certificateDays;
    const props = await this.prisma.property.findMany({
      where: { workspaceId: ws.id, archivedAt: null },
      include: { documents: { where: { type: { in: [...CERTIFICATE_TYPES] }, ready: true } } },
    });
    const due: { property: string; label: string; expiresOn: IsoDate; expired: boolean }[] = [];
    for (const p of props) {
      for (const type of CERTIFICATE_TYPES) {
        const docs = p.documents.filter((d) => d.type === type);
        const doc = currentCertificate(docs);
        if (!doc?.expiresOn) continue;
        const expiresOn = fromDbReq(doc.expiresOn);
        const left = daysBetween(today, expiresOn);
        const fire = left < 0 ? await this.claim(ws.id, 'certificate', doc.id, 'expired') : (await this.claimLatest(ws.id, 'certificate', doc.id, steps.filter((s) => left <= s), 'min')) !== null;
        if (fire) due.push({ property: formatAddress(p), label: doc.title || DOCUMENT_TYPE_LABELS[type], expiresOn, expired: left < 0 });
      }
    }
    if (!due.length) return 0;
    // One email per run listing everything, rather than one per certificate.
    for (const m of await this.managers(ws.id)) {
      await this.mail.send({
        to: m.email,
        workspaceId: ws.id,
        ...email({
          subject: `${due.length} certificate${due.length === 1 ? '' : 's'} ${due.some((d) => d.expired) ? 'expired or expiring' : 'expiring soon'}`,
          from: 'OpenLet',
          heading: 'Certificates need renewing',
          paragraphs: [
            `Hello ${m.name},`,
            ...due.map((d) => `${d.label} at ${d.property}: ${d.expired ? `expired on ${formatDate(d.expiresOn)}` : `expires on ${formatDate(d.expiresOn)}`}.`),
            'Upload the new certificate on the property’s Documents tab and the reminders stop.',
          ],
          button: { label: 'Open the compliance board', url: `${config().APP_URL}/app/compliance` },
          legal: true,
        }),
      });
    }
    return due.length;
  }

  /** Deposits received but not marked as protected after the set number of days (default 30). */
  private async deposits(ws: Ws, today: IsoDate) {
    const limit = ws.settings.reminders.depositProtectDays;
    const rows = await this.prisma.deposit.findMany({
      where: { protectedOn: null, receivedOn: { not: null }, returnedOn: null, tenancy: { workspaceId: ws.id, archivedAt: null, endedOn: null } },
      include: { tenancy: { include: { unit: { include: { property: true } }, tenants: { include: { tenant: true } } } } },
    });
    const items: string[] = [];
    for (const d of rows) {
      const received = fromDb(d.receivedOn)!;
      if (today < addDays(received, limit)) continue;
      if (!(await this.claim(ws.id, 'deposit', d.id, 'unprotected'))) continue;
      items.push(`${formatPence(d.amountPence)} from ${d.tenancy.tenants.map((x) => `${x.tenant.firstName} ${x.tenant.lastName}`).join(' and ')} at ${d.tenancy.unit.property.addressLine1}, received ${formatDate(received)}.`);
    }
    if (!items.length) return 0;
    for (const m of await this.managers(ws.id)) {
      await this.mail.send({
        to: m.email,
        workspaceId: ws.id,
        ...email({
          subject: `${items.length} deposit${items.length === 1 ? ' isn’t' : 's aren’t'} marked as protected`,
          from: 'OpenLet',
          heading: 'Deposits not yet protected',
          paragraphs: [`Hello ${m.name},`, `These deposits were received more than ${limit} days ago and aren’t marked as protected in a scheme:`, ...items, 'Record the scheme and protection date on each tenancy’s Deposit tab.'],
          button: { label: 'Open tenancies', url: `${config().APP_URL}/app/tenancies` },
          legal: true,
        }),
      });
    }
    return items.length;
  }

  /** Right to Rent follow-up checks for time-limited permission (default 28 days before it ends). */
  private async rightToRent(ws: Ws, today: IsoDate) {
    const before = ws.settings.reminders.rightToRentDaysBefore;
    const tenants = await this.prisma.tenant.findMany({
      where: { workspaceId: ws.id, anonymisedAt: null, rightToRent: { some: {} } },
      include: { rightToRent: { orderBy: { checkedOn: 'desc' }, take: 1 } },
    });
    const items: string[] = [];
    for (const t of tenants) {
      const latest = t.rightToRent[0];
      const ends = fromDb(latest?.expiresOn);
      if (!latest || !ends || today < addDays(ends, -before)) continue;
      if (!(await this.claim(ws.id, 'right-to-rent', latest.id, 'follow-up'))) continue;
      items.push(`${t.firstName} ${t.lastName}: permission ends ${formatDate(ends)}.`);
    }
    if (!items.length) return 0;
    for (const m of await this.managers(ws.id)) {
      await this.mail.send({
        to: m.email,
        workspaceId: ws.id,
        ...email({
          subject: 'Right to Rent follow-up checks are due',
          from: 'OpenLet',
          heading: 'Right to Rent follow-up checks',
          paragraphs: [`Hello ${m.name},`, 'These tenants have time-limited permission. Do a follow-up check before it ends and record it on their page:', ...items],
          button: { label: 'Open tenants', url: `${config().APP_URL}/app/tenants` },
          footnote: LEGAL_NOTE,
        }),
      });
    }
    return items.length;
  }
}

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { addDays, londonDate } from '@openlet/shared';
import { MailService } from '../src/mail/mail.service.js';
import { RemindersService } from '../src/reminders/reminders.service.js';
import { LedgerService } from '../src/ledger/ledger.service.js';
import { as, clearOutbox, createProperty, startApp, workspaceWithTeam, type TestContext } from './helpers.js';

let ctx: TestContext;
let reminders: RemindersService;
beforeAll(async () => {
  ctx = await startApp();
  reminders = ctx.app.get(RemindersService);
});
afterAll(async () => ctx.app.close());
beforeEach(clearOutbox);

const today = londonDate();
const d = (s: string) => new Date(`${s}T00:00:00Z`);
const to = (addr: string) => MailService.outbox.filter((m) => m.to === addr);

async function tenancy(opts: { start: string; due: number; reminders?: boolean }) {
  const team = await workspaceWithTeam(ctx.prisma);
  const p = await createProperty(ctx.prisma, team.ws.id);
  const tenant = await ctx.prisma.tenant.create({ data: { workspaceId: team.ws.id, firstName: 'Remy', lastName: 'Minder', email: `remy-${Math.random().toString(36).slice(2)}@test.example` } });
  const t = await ctx.prisma.tenancy.create({
    data: {
      workspaceId: team.ws.id,
      unitId: p.units[0]!.id,
      startDate: d(opts.start),
      frequency: 'MONTHLY',
      dueDay: opts.due,
      remindersEnabled: opts.reminders ?? true,
      tenants: { create: { tenantId: tenant.id } },
      rentChanges: { create: { amountPence: 50000, effectiveFrom: d(opts.start) } },
    },
  });
  await ctx.app.get(LedgerService).generateFor(t.id, today);
  return { ...team, p, tenant, t };
}

describe('rent reminders', () => {
  it('sends the due-soon reminder once, and not if already paid', async () => {
    const start = addDays(today, -1);
    const s = await tenancy({ start, due: Number(start.slice(8, 10)) });
    // Next charge is due in about a month; pretend today is 3 days before it.
    const charges = await ctx.prisma.ledgerEntry.findMany({ where: { tenancyId: s.t.id, type: 'RENT_CHARGE' }, orderBy: { date: 'asc' } });
    expect(charges).toHaveLength(1);
    // Run for "3 days before the first due date": the first charge (due yesterday) is overdue, not "due soon".
    const due = addDays(today, 10);
    await ctx.prisma.ledgerEntry.create({ data: { workspaceId: s.ws.id, tenancyId: s.t.id, type: 'OTHER_CHARGE', amountPence: 1000, date: d(due), description: 'Keys' } });
    await ctx.prisma.ledgerEntry.create({ data: { workspaceId: s.ws.id, tenancyId: s.t.id, type: 'PAYMENT', amountPence: 50000, date: d(today) } });
    const r = await ctx.prisma.ledgerEntry.create({ data: { workspaceId: s.ws.id, tenancyId: s.t.id, type: 'RENT_CHARGE', amountPence: 50000, date: d(addDays(today, 3)), periodStart: d(addDays(today, 3)), periodEnd: d(addDays(today, 30)) } });
    await reminders.runDaily(today);
    expect(to(s.tenant.email!).filter((m) => m.subject.includes('is due'))).toHaveLength(1);
    await reminders.runDaily(today);
    await reminders.runDaily(addDays(today, 1));
    expect(to(s.tenant.email!).filter((m) => m.subject.includes('is due'))).toHaveLength(1);
    expect(await ctx.prisma.reminderSent.count({ where: { itemId: r.id } })).toBe(1);
  });

  it('overdue steps 3, 7 and 14 each go once, stop when paid, and a late run sends only the latest step', async () => {
    const start = addDays(today, -20);
    const s = await tenancy({ start, due: Number(start.slice(8, 10)) });
    // 20 days late: steps 3 and 7 are skipped, 14 is sent once.
    await reminders.runDaily(today);
    const overdue = () => to(s.tenant.email!).filter((m) => m.subject.includes('overdue'));
    expect(overdue()).toHaveLength(1);
    expect(overdue()[0]!.subject).toContain('20 days');
    await reminders.runDaily(today);
    expect(overdue()).toHaveLength(1);
    expect(await ctx.prisma.reminderSent.count({ where: { workspaceId: s.ws.id, kind: 'rent-overdue' } })).toBe(3);

    // Paid: nothing more, even later.
    await ctx.prisma.ledgerEntry.create({ data: { workspaceId: s.ws.id, tenancyId: s.t.id, type: 'PAYMENT', amountPence: 50000, date: d(today) } });
    await reminders.runDaily(addDays(today, 5));
    expect(overdue()).toHaveLength(1);
  });

  it('steps fire one at a time on their days', async () => {
    const start = addDays(today, -3);
    const s = await tenancy({ start, due: Number(start.slice(8, 10)) });
    const overdue = () => to(s.tenant.email!).filter((m) => m.subject.includes('overdue'));
    await reminders.runDaily(today); // 3 days late
    expect(overdue()).toHaveLength(1);
    await reminders.runDaily(addDays(today, 2)); // 5 days: nothing new
    expect(overdue()).toHaveLength(1);
    await reminders.runDaily(addDays(today, 4)); // 7 days
    expect(overdue()).toHaveLength(2);
  });

  it('no rent emails when reminders are off for the tenancy', async () => {
    const start = addDays(today, -10);
    const s = await tenancy({ start, due: Number(start.slice(8, 10)), reminders: false });
    await reminders.runDaily(today);
    expect(to(s.tenant.email!)).toHaveLength(0);
  });
});

describe('staff reminders', () => {
  it('certificate reminders go once per step to Owners and Managers, and stop when renewed', async () => {
    const team = await workspaceWithTeam(ctx.prisma);
    const p = await createProperty(ctx.prisma, team.ws.id);
    const c = await as(ctx, team.staff.id, team.ws.id);
    const pdf = Buffer.from('%PDF-1.4\n%%EOF');
    await c.upload('/documents').field('type', 'GAS_SAFETY').field('propertyId', p.id).field('expiresOn', addDays(today, 45)).attach('file', pdf, 'gas.pdf');
    await reminders.runDaily(today);
    expect(to(team.owner.email)).toHaveLength(1);
    expect(to(team.manager.email)).toHaveLength(1);
    expect(to(team.staff.email)).toHaveLength(0);
    expect(to(team.owner.email)[0]!.text).toContain('not legal advice');
    await reminders.runDaily(today);
    expect(to(team.owner.email)).toHaveLength(1);
    await reminders.runDaily(addDays(today, 15)); // 30 days left
    expect(to(team.owner.email)).toHaveLength(2);
    // Renewed: the new certificate runs a year, so the old one's 7-day step never fires.
    await c.upload('/documents').field('type', 'GAS_SAFETY').field('propertyId', p.id).field('expiresOn', addDays(today, 400)).attach('file', pdf, 'gas2.pdf');
    await reminders.runDaily(addDays(today, 40));
    expect(to(team.owner.email)).toHaveLength(2);
  });

  it('deposit protection reminder once after 30 days, never once protected', async () => {
    const start = addDays(today, -40);
    const s = await tenancy({ start, due: Number(start.slice(8, 10)) });
    const dep = await ctx.prisma.deposit.create({ data: { tenancyId: s.t.id, amountPence: 60000, receivedOn: d(addDays(today, -31)) } });
    clearOutbox();
    await reminders.runDaily(today);
    expect(to(s.owner.email).filter((m) => m.subject.includes('deposit'))).toHaveLength(1);
    await reminders.runDaily(addDays(today, 1));
    expect(to(s.owner.email).filter((m) => m.subject.includes('deposit'))).toHaveLength(1);

    const other = await tenancy({ start, due: Number(start.slice(8, 10)) });
    await ctx.prisma.deposit.create({ data: { tenancyId: other.t.id, amountPence: 60000, receivedOn: d(addDays(today, -31)), protectedOn: d(addDays(today, -20)) } });
    await reminders.runDaily(today);
    expect(to(other.owner.email).filter((m) => m.subject.includes('deposit'))).toHaveLength(0);
    void dep;
  });

  it('Right to Rent follow-up once, and not after a new check', async () => {
    const team = await workspaceWithTeam(ctx.prisma);
    const tenant = await ctx.prisma.tenant.create({ data: { workspaceId: team.ws.id, firstName: 'Tim', lastName: 'Limited' } });
    await ctx.prisma.rightToRentCheck.create({ data: { tenantId: tenant.id, checkedOn: d(addDays(today, -300)), method: 'ONLINE_SHARE_CODE', expiresOn: d(addDays(today, 20)) } });
    await reminders.runDaily(today);
    await reminders.runDaily(today);
    expect(to(team.owner.email).filter((m) => m.subject.includes('Right to Rent'))).toHaveLength(1);

    const other = await workspaceWithTeam(ctx.prisma);
    const t2 = await ctx.prisma.tenant.create({ data: { workspaceId: other.ws.id, firstName: 'Nat', lastName: 'Rechecked' } });
    await ctx.prisma.rightToRentCheck.create({ data: { tenantId: t2.id, checkedOn: d(addDays(today, -300)), method: 'ONLINE_SHARE_CODE', expiresOn: d(addDays(today, 20)) } });
    await ctx.prisma.rightToRentCheck.create({ data: { tenantId: t2.id, checkedOn: d(today), method: 'ONLINE_SHARE_CODE', expiresOn: d(addDays(today, 700)) } });
    await reminders.runDaily(today);
    expect(to(other.owner.email).filter((m) => m.subject.includes('Right to Rent'))).toHaveLength(0);
  });
});

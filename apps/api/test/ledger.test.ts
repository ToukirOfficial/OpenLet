import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addDays, londonDate } from '@openlet/shared';
import { allocate, type Entry } from '../src/ledger/allocation.js';
import { LedgerService } from '../src/ledger/ledger.service.js';
import { ExportsService } from '../src/exports/exports.service.js';
import { QueueService } from '../src/jobs/queue.service.js';
import { as, clearOutbox, createProperty, startApp, workspaceWithTeam, type TestContext } from './helpers.js';

let n = 0;
const e = (type: Entry['type'], amountPence: number, date: string, reversesId: string | null = null): Entry => ({ id: `e${++n}`, type, amountPence, date, createdAt: new Date(2026, 0, 1, 0, 0, n), reversesId });

describe('allocation (pure)', () => {
  it('pays the oldest charges first and reports arrears with days overdue', () => {
    const entries = [e('RENT_CHARGE', 50000, '2026-01-01'), e('RENT_CHARGE', 50000, '2026-02-01'), e('RENT_CHARGE', 50000, '2026-03-01'), e('PAYMENT', 70000, '2026-03-05')];
    const a = allocate(entries, '2026-03-10');
    expect(a.charges.map((c) => c.status)).toEqual(['PAID', 'PART_PAID', 'UNPAID']);
    expect(a.balancePence).toBe(80000);
    expect(a.arrearsPence).toBe(80000);
    expect(a.oldestUnpaidDue).toBe('2026-02-01');
    expect(a.daysOverdue).toBe(37);
  });

  it('turns an overpayment into credit', () => {
    const a = allocate([e('RENT_CHARGE', 50000, '2026-01-01'), e('PAYMENT', 65000, '2026-01-01')], '2026-01-10');
    expect(a.balancePence).toBe(-15000);
    expect(a.creditPence).toBe(15000);
    expect(a.arrearsPence).toBe(0);
  });

  it('a charge due today is not overdue yet; a future charge shows as upcoming', () => {
    const a = allocate([e('RENT_CHARGE', 50000, '2026-01-10'), e('RENT_CHARGE', 50000, '2026-02-10')], '2026-01-10');
    expect(a.arrearsPence).toBe(0);
    expect(a.balancePence).toBe(50000);
    expect(a.charges.map((c) => c.status)).toEqual(['UNPAID', 'UPCOMING']);
  });

  it('a reversal cancels its original entry; credits and other charges count', () => {
    const pay = e('PAYMENT', 50000, '2026-01-02');
    const entries = [e('RENT_CHARGE', 50000, '2026-01-01'), pay, e('REVERSAL', 50000, '2026-01-05', pay.id), e('OTHER_CHARGE', 2500, '2026-01-06'), e('CREDIT', 2500, '2026-01-07')];
    const a = allocate(entries, '2026-01-10');
    expect(a.balancePence).toBe(50000);
    expect(a.arrearsPence).toBe(50000);
  });
});

describe('ledger API', () => {
  let ctx: TestContext;
  beforeAll(async () => {
    ctx = await startApp();
  });
  afterAll(async () => ctx.app.close());

  async function setup() {
    clearOutbox();
    const team = await workspaceWithTeam(ctx.prisma);
    const p = await createProperty(ctx.prisma, team.ws.id);
    const tenant = await ctx.prisma.tenant.create({ data: { workspaceId: team.ws.id, firstName: 'Pay', lastName: 'Test' } });
    const c = await as(ctx, team.staff.id, team.ws.id);
    const today = londonDate();
    const t = (await c.post('/tenancies', { unitId: p.units[0]!.id, tenantIds: [tenant.id], startDate: addDays(today, -65), rentPence: 60000, frequency: 'MONTHLY', dueDay: Number(addDays(today, -65).slice(8, 10)) })).body;
    await ctx.app.get(LedgerService).generateFor(t.id);
    return { ...team, c, t, today };
  }

  it('records part and over payments; balance and running balance update; entries are append-only', async () => {
    const s = await setup();
    const before = await s.c.get(`/tenancies/${s.t.id}/ledger`);
    const dueCharges = before.body.rows.filter((r: { type: string; date: string }) => r.type === 'RENT_CHARGE' && r.date <= s.today).length;
    expect(dueCharges).toBeGreaterThanOrEqual(2);
    expect(before.body.balancePence).toBe(dueCharges * 60000);

    const part = await s.c.post('/payments', { tenancyId: s.t.id, date: s.today, amountPence: 30000, method: 'BANK_TRANSFER', reference: 'TEST1' });
    expect(part.status).toBe(201);
    expect(part.body.balancePence).toBe(dueCharges * 60000 - 30000);
    expect(part.body.rows.at(-1).runningBalancePence).toBeDefined();

    const over = await s.c.post('/payments', { tenancyId: s.t.id, date: s.today, amountPence: dueCharges * 60000 + 10000, method: 'CASH' });
    expect(over.body.balancePence).toBe(-40000);
    expect(over.body.creditPence).toBe(40000);
    expect(over.body.arrearsPence).toBe(0);

    const future = await s.c.post('/payments', { tenancyId: s.t.id, date: addDays(s.today, 3), amountPence: 1000, method: 'CASH' });
    expect(future.status).toBe(400);

    // Reverse the cash payment: a new entry, the original stays.
    const cash = over.body.rows.find((r: { method: string; type: string }) => r.type === 'PAYMENT' && r.method === 'CASH');
    const rev = await s.c.post(`/ledger/${cash.id}/reverse`, { reason: 'Recorded twice' });
    expect(rev.status).toBe(200);
    expect(rev.body.balancePence).toBe(dueCharges * 60000 - 30000);
    expect(await ctx.prisma.ledgerEntry.count({ where: { id: cash.id } })).toBe(1);
    expect((await s.c.post(`/ledger/${cash.id}/reverse`, { reason: 'again' })).status).toBe(409);
  });

  it('one-off charges and credits move the balance', async () => {
    const s = await setup();
    const base = (await s.c.get(`/tenancies/${s.t.id}/ledger`)).body.balancePence;
    await s.c.post('/charges', { tenancyId: s.t.id, date: s.today, amountPence: 2500, description: 'Replacement keys' });
    const after = await s.c.post('/credits', { tenancyId: s.t.id, date: s.today, amountPence: 1000, description: 'Goodwill' });
    expect(after.body.balancePence).toBe(base + 1500);
  });

  it('lists arrears across the portfolio and keeps other workspaces out', async () => {
    const s = await setup();
    const res = await s.c.get('/arrears');
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].tenancyId).toBe(s.t.id);
    const other = await workspaceWithTeam(ctx.prisma);
    const oc = await as(ctx, other.owner.id, other.ws.id);
    expect((await oc.get('/arrears')).body.items).toHaveLength(0);
    expect((await oc.get(`/tenancies/${s.t.id}/ledger`)).status).toBe(404);
    expect((await oc.post('/payments', { tenancyId: s.t.id, date: s.today, amountPence: 100, method: 'CASH' })).status).toBe(404);
  });

  it('makes a statement PDF on the queue that only the requester can download', async () => {
    const s = await setup();
    const job = await s.c.post(`/tenancies/${s.t.id}/statements`, { from: addDays(s.today, -90), to: s.today });
    expect(job.body.status).toBe('PENDING');
    const queued = QueueService.testJobs.find((j) => j.name === 'export');
    expect(queued).toBeTruthy();
    await ctx.app.get(ExportsService).run((queued!.data as { jobId: string }).jobId);
    expect((await s.c.get(`/jobs/${job.body.id}`)).body.status).toBe('READY');
    const dl = await s.c.get(`/jobs/${job.body.id}/download`);
    expect(dl.status).toBe(200);
    expect(dl.headers['content-type']).toContain('application/pdf');
    const manager = await as(ctx, s.manager.id, s.ws.id);
    expect((await manager.get(`/jobs/${job.body.id}/download`)).status).toBe(403);
  });
});

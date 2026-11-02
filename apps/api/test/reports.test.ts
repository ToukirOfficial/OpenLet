import type request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { addDays, londonDate } from '@openlet/shared';
import { ExportsService } from '../src/exports/exports.service.js';
import { QueueService } from '../src/jobs/queue.service.js';
import { LedgerService } from '../src/ledger/ledger.service.js';
import { RedisService } from '../src/redis.service.js';
import { as, clearOutbox, createProperty, startApp, workspaceWithTeam, type TestContext } from './helpers.js';

let ctx: TestContext;
beforeAll(async () => {
  ctx = await startApp();
});
afterAll(async () => ctx.app.close());
beforeEach(clearOutbox);

const today = londonDate();
const binary = (res: { body: unknown }) => res.body as Buffer;
type Parser = Extract<Parameters<request.Test['parse']>[0], (res: never, cb: never) => void>;
const parseBuffer: Parser = (res, cb) => {
  const chunks: Buffer[] = [];
  res.on('data', (d: Buffer) => chunks.push(d));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
};

async function setup() {
  const team = await workspaceWithTeam(ctx.prisma);
  const c = await as(ctx, team.owner.id, team.ws.id);
  const p = await createProperty(ctx.prisma, team.ws.id);
  const empty = await createProperty(ctx.prisma, team.ws.id);
  const tenant = (await c.post('/tenants', { firstName: 'Dash', lastName: 'Board' })).body;
  const start = addDays(today, -45);
  const t = (await c.post('/tenancies', { unitId: p.units[0]!.id, tenantIds: [tenant.id], startDate: start, rentPence: 70000, frequency: 'MONTHLY', dueDay: Number(start.slice(8, 10)) })).body;
  await ctx.app.get(LedgerService).generateFor(t.id);
  await c.post('/payments', { tenancyId: t.id, date: today, amountPence: 70000, method: 'BANK_TRANSFER' });
  const r = (await c.post('/repairs', { propertyId: p.id, category: 'OTHER', title: 'Gate hinge', description: 'Loose', priority: 'ROUTINE' })).body;
  await c.patch(`/repairs/${r.id}`, { costPence: 4500 });
  await ctx.app.get(RedisService).invalidate(team.ws.id);
  return { ...team, c, p, empty, t, r };
}

describe('dashboard and calendar', () => {
  it('counts overdue rent, open repairs, vacant units and missing certificates', async () => {
    const s = await setup();
    const d = (await s.c.get('/dashboard')).body;
    expect(d.stats.overdueCount).toBe(1);
    expect(d.stats.overduePence).toBe(70000);
    expect(d.stats.openRepairs).toBe(1);
    expect(d.stats.vacantUnits).toBe(1);
    expect(d.stats.totalUnits).toBe(2);
    expect(d.stats.certificatesMissing).toBeGreaterThan(0);
    expect(d.attention.some((a: { kind: string }) => a.kind === 'ARREARS')).toBe(true);
    expect(d.income.at(-1).pence).toBe(70000);
  });

  it('is cached, and a write clears the cache', async () => {
    const s = await setup();
    expect((await s.c.get('/dashboard')).body.stats.openRepairs).toBe(1);
    await s.c.post(`/repairs/${s.r.id}/status`, { status: 'CLOSED' });
    expect((await s.c.get('/dashboard')).body.stats.openRepairs).toBe(0);
  });

  it('the calendar shows rent due dates and tenancy starts, and limits the range', async () => {
    const s = await setup();
    const cal = (await s.c.get(`/calendar?from=${addDays(today, -50)}&to=${addDays(today, 40)}`)).body;
    expect(cal.some((e: { kind: string }) => e.kind === 'TENANCY_START')).toBe(true);
    expect(cal.filter((e: { kind: string }) => e.kind === 'RENT_DUE').length).toBeGreaterThanOrEqual(3);
    expect((await s.c.get(`/calendar?from=${today}&to=${addDays(today, 200)}`)).status).toBe(400);
  });
});

describe('reports', () => {
  it('rent roll, income and maintenance', async () => {
    const s = await setup();
    const roll = (await s.c.get('/reports/rent-roll')).body;
    expect(roll).toHaveLength(1);
    expect(roll[0].balancePence).toBe(70000);
    const income = (await s.c.get(`/reports/income?from=${addDays(today, -60)}&to=${today}`)).body;
    expect(income.totalPence).toBe(70000);
    const maint = (await s.c.get(`/reports/maintenance?from=${addDays(today, -1)}&to=${today}`)).body;
    expect(maint[0].costPence).toBe(4500);
  });

  it('CSV for Owners and Managers only, made on the queue and audited', async () => {
    const s = await setup();
    const staff = await as(ctx, s.staff.id, s.ws.id);
    expect((await staff.get('/reports/rent-roll')).status).toBe(200);
    expect((await staff.post('/reports/rent-roll/csv')).status).toBe(403);
    const manager = await as(ctx, s.manager.id, s.ws.id);
    const job = (await manager.post('/reports/rent-roll/csv')).body;
    await ctx.app.get(ExportsService).run((QueueService.testJobs.at(-1)!.data as { jobId: string }).jobId);
    const dl = await manager.get(`/jobs/${job.id}/download`).buffer(true).parse(parseBuffer);
    expect(dl.status).toBe(200);
    const csv = binary(dl).toString('utf8');
    expect(csv).toContain('Dash Board');
    expect(csv).toContain('700.00');
    expect(await ctx.prisma.auditLog.count({ where: { workspaceId: s.ws.id, action: 'report.exported' } })).toBe(1);
  });

  it('the full export is Owner-only and contains CSVs and documents, never secrets', async () => {
    const s = await setup();
    await s.c.upload('/documents').field('type', 'EPC').field('propertyId', s.p.id).attach('file', Buffer.from('%PDF-1.4\n%%EOF'), 'epc.pdf');
    expect((await (await as(ctx, s.manager.id, s.ws.id)).post('/exports')).status).toBe(403);
    const job = (await s.c.post('/exports')).body;
    await ctx.app.get(ExportsService).run((QueueService.testJobs.at(-1)!.data as { jobId: string }).jobId);
    const dl = await s.c.get(`/jobs/${job.id}/download`).buffer(true).parse(parseBuffer);
    expect(dl.status).toBe(200);
    expect(dl.headers['content-type']).toContain('zip');
    const zip = binary(dl).toString('latin1');
    for (const name of ['properties.csv', 'tenants.csv', 'tenancies.csv', 'ledger.csv', 'repairs.csv', 'documents.csv', 'documents/']) expect(zip).toContain(name);
    expect(zip).not.toContain('passwordHash');
    expect(zip).not.toContain('tokenHash');
    expect(zip).not.toContain('storageKey');
    expect(await ctx.prisma.auditLog.count({ where: { workspaceId: s.ws.id, action: { in: ['export.requested', 'export.downloaded'] } } })).toBe(2);
  });
});

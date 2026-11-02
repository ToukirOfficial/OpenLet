import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { addDays, londonDate } from '@openlet/shared';
import { PASSWORD, anon, as, clearOutbox, createProperty, lastEmail, startApp, workspaceWithTeam, type TestContext } from './helpers.js';

let ctx: TestContext;
beforeAll(async () => {
  ctx = await startApp();
});
afterAll(async () => ctx.app.close());
beforeEach(clearOutbox);

async function setup() {
  const team = await workspaceWithTeam(ctx.prisma);
  const property = await createProperty(ctx.prisma, team.ws.id);
  const [a, b] = await Promise.all([
    ctx.prisma.tenant.create({ data: { workspaceId: team.ws.id, firstName: 'Anna', lastName: 'One', email: `anna-${Date.now()}@test.example` } }),
    ctx.prisma.tenant.create({ data: { workspaceId: team.ws.id, firstName: 'Ben', lastName: 'Two' } }),
  ]);
  const c = await as(ctx, team.staff.id, team.ws.id);
  return { ...team, property, unitId: property.units[0]!.id, a, b, c };
}

const today = londonDate();

describe('tenancies', () => {
  it('creates a joint tenancy with rent and deposit, and the property becomes occupied', async () => {
    const s = await setup();
    const res = await s.c.post('/tenancies', {
      unitId: s.unitId,
      tenantIds: [s.a.id, s.b.id],
      startDate: addDays(today, -40),
      endDate: addDays(today, 300),
      rentPence: 85000,
      frequency: 'MONTHLY',
      dueDay: 1,
      deposit: { amountPence: 98000, receivedOn: addDays(today, -40) },
    });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('ACTIVE');
    expect(res.body.tenants).toHaveLength(2);
    expect(res.body.tenantNames).toBe('Anna One and Ben Two');
    expect(res.body.deposit.amountPence).toBe(98000);
    // Received 40 days ago, not protected, 30-day limit: overdue.
    expect(res.body.deposit.protectionOverdue).toBe(true);
    const p = await s.c.get(`/properties/${s.property.id}`);
    expect(p.body.status).toBe('OCCUPIED');
  });

  it('refuses a second tenancy on the same unit for overlapping dates', async () => {
    const s = await setup();
    const base = { unitId: s.unitId, tenantIds: [s.a.id], rentPence: 50000, frequency: 'MONTHLY', dueDay: 1 };
    expect((await s.c.post('/tenancies', { ...base, startDate: addDays(today, -10), endDate: addDays(today, 100) })).status).toBe(201);
    expect((await s.c.post('/tenancies', { ...base, startDate: addDays(today, 50) })).status).toBe(409);
    expect((await s.c.post('/tenancies', { ...base, startDate: addDays(today, 101) })).status).toBe(201);
  });

  it('refuses tenants and units from another workspace', async () => {
    const s = await setup();
    const other = await workspaceWithTeam(ctx.prisma);
    const foreign = await ctx.prisma.tenant.create({ data: { workspaceId: other.ws.id, firstName: 'X', lastName: 'Y' } });
    const foreignProperty = await createProperty(ctx.prisma, other.ws.id);
    const base = { startDate: today, rentPence: 50000, frequency: 'WEEKLY', dueDay: 1 };
    expect((await s.c.post('/tenancies', { ...base, unitId: s.unitId, tenantIds: [foreign.id] })).status).toBe(404);
    expect((await s.c.post('/tenancies', { ...base, unitId: foreignProperty.units[0]!.id, tenantIds: [s.a.id] })).status).toBe(404);
  });

  it('notice makes the tenancy "ending", then it ends; a rent change is kept in the history', async () => {
    const s = await setup();
    const t = (await s.c.post('/tenancies', { unitId: s.unitId, tenantIds: [s.a.id], startDate: addDays(today, -100), rentPence: 70000, frequency: 'MONTHLY', dueDay: 15 })).body;
    const rent = await s.c.post(`/tenancies/${t.id}/rent-changes`, { amountPence: 72500, effectiveFrom: addDays(today, 60) });
    expect(rent.status).toBe(201);
    expect(rent.body.rentChanges.map((r: { amountPence: number }) => r.amountPence)).toEqual([70000, 72500]);

    const n = await s.c.post(`/tenancies/${t.id}/notice`, { givenBy: 'TENANT', givenOn: today, endDate: addDays(today, 30) });
    expect(n.status).toBe(200);
    expect(n.body.status).toBe('ENDING');
    expect((await s.c.get(`/properties/${s.property.id}`)).body.status).toBe('ENDING_SOON');

    const ended = await s.c.post(`/tenancies/${t.id}/end`, { endedOn: addDays(today, -1) });
    expect(ended.body.status).toBe('ENDED');
    expect((await s.c.get(`/properties/${s.property.id}`)).body.status).toBe('VACANT');
  });

  it('records the deposit return with deductions', async () => {
    const s = await setup();
    const t = (await s.c.post('/tenancies', { unitId: s.unitId, tenantIds: [s.a.id], startDate: today, rentPence: 60000, frequency: 'MONTHLY', dueDay: 1, deposit: { amountPence: 69000 } })).body;
    expect((await s.c.post(`/tenancies/${t.id}/deposit/return`, { returnedOn: today, deductions: [{ reason: 'Too much', amountPence: 70000 }] })).status).toBe(400);
    const r = await s.c.post(`/tenancies/${t.id}/deposit/return`, { returnedOn: today, deductions: [{ reason: 'Replacement keys', amountPence: 4500 }, { reason: 'Cleaning', amountPence: 12000 }] });
    expect(r.body.deposit.returnedPence).toBe(52500);
    expect(r.body.deposit.deductions).toHaveLength(2);
  });

  it('invites a tenant to the portal; accepting links their login to the tenant record', async () => {
    const s = await setup();
    expect((await s.c.post(`/tenants/${s.b.id}/invite`)).status).toBe(400);
    const inv = await s.c.post(`/tenants/${s.a.id}/invite`);
    expect(inv.status).toBe(201);
    expect(inv.body.portal).toBe('INVITED');
    const token = /invite\/([\w-]+)/.exec(lastEmail(s.a.email!)!.text)?.[1];
    const info = await anon(ctx).get(`/invites/${token}`);
    expect(info.body.kind).toBe('TENANT');
    const accepted = await anon(ctx).post('/invites/accept', { token, name: 'Anna One', password: PASSWORD });
    expect(accepted.status).toBe(200);
    const tenant = await ctx.prisma.tenant.findUniqueOrThrow({ where: { id: s.a.id } });
    expect(tenant.userId).toBeTruthy();
    const me = await (await as(ctx, tenant.userId!)).get('/me');
    expect(me.body.tenancies[0].tenantId).toBe(s.a.id);
    expect(me.body.workspaces).toHaveLength(0);
  });
});

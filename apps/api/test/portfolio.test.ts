import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PROPERTY, as, createProperty, startApp, workspaceWithTeam, type TestContext } from './helpers.js';

let ctx: TestContext;
beforeAll(async () => {
  ctx = await startApp();
});
afterAll(async () => ctx.app.close());

describe('properties', () => {
  it('creates a property with units, normalises the postcode and finds it by postcode', async () => {
    const { ws, staff } = await workspaceWithTeam(ctx.prisma);
    const c = await as(ctx, staff.id, ws.id);
    const res = await c.post('/properties', { ...PROPERTY, type: 'HMO', units: ['Room 1', 'Room 2'] });
    expect(res.status).toBe(201);
    expect(res.body.postcode).toBe('HX1 1AA');
    expect(res.body.units).toHaveLength(2);
    expect(res.body.status).toBe('VACANT');
    expect(res.body.workspaceId).toBeUndefined();
    const found = await c.get('/properties?q=hx11aa');
    expect(found.body.items.map((p: { id: string }) => p.id)).toContain(res.body.id);
    const filtered = await c.get('/properties?status=OCCUPIED');
    expect(filtered.body.items.map((p: { id: string }) => p.id)).not.toContain(res.body.id);
  });

  it('rejects an invalid postcode and strips unknown fields', async () => {
    const { ws, staff } = await workspaceWithTeam(ctx.prisma);
    const c = await as(ctx, staff.id, ws.id);
    const bad = await c.post('/properties', { ...PROPERTY, postcode: 'NOT A CODE' });
    expect(bad.status).toBe(400);
    expect(bad.body.fields.postcode).toBeTruthy();
    const other = await workspaceWithTeam(ctx.prisma);
    const res = await c.post('/properties', { ...PROPERTY, workspaceId: other.ws.id });
    expect(res.status).toBe(201);
    const row = await ctx.prisma.property.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(row.workspaceId).toBe(ws.id);
  });

  it('Staff cannot delete properties; Managers can', async () => {
    const { ws, staff, manager } = await workspaceWithTeam(ctx.prisma);
    const p = await createProperty(ctx.prisma, ws.id);
    expect((await (await as(ctx, staff.id, ws.id)).delete(`/properties/${p.id}`)).status).toBe(403);
    expect((await (await as(ctx, manager.id, ws.id)).delete(`/properties/${p.id}`)).status).toBe(200);
  });
});

describe('workspace isolation for portfolio records', () => {
  it('records from another workspace look like they do not exist', async () => {
    const a = await workspaceWithTeam(ctx.prisma);
    const b = await workspaceWithTeam(ctx.prisma);
    const property = await createProperty(ctx.prisma, b.ws.id);
    const tenant = await ctx.prisma.tenant.create({ data: { workspaceId: b.ws.id, firstName: 'Bea', lastName: 'Other' } });
    const contractor = await ctx.prisma.contractor.create({ data: { workspaceId: b.ws.id, name: 'B Co', trade: 'Gas', email: 'b@test.example' } });
    const c = await as(ctx, a.owner.id, a.ws.id);

    expect((await c.get(`/properties/${property.id}`)).status).toBe(404);
    expect((await c.patch(`/properties/${property.id}`, { ...PROPERTY })).status).toBe(404);
    expect((await c.delete(`/properties/${property.id}`)).status).toBe(404);
    expect((await c.post(`/properties/${property.id}/units`, { name: 'Sneaky' })).status).toBe(404);
    expect((await c.get(`/tenants/${tenant.id}`)).status).toBe(404);
    expect((await c.patch(`/tenants/${tenant.id}`, { firstName: 'X', lastName: 'Y' })).status).toBe(404);
    expect((await c.post(`/tenants/${tenant.id}/right-to-rent`, { checkedOn: '2026-01-01', method: 'MANUAL_DOCUMENT' })).status).toBe(404);
    expect((await c.patch(`/contractors/${contractor.id}`, { name: 'x', trade: 'y', email: 'x@test.example' })).status).toBe(404);
    expect((await c.post('/notes', { body: 'peek', propertyId: property.id })).status).toBe(404);

    const lists = await Promise.all([c.get('/properties'), c.get('/tenants'), c.get('/contractors')]);
    expect(JSON.stringify(lists.map((l) => l.body))).not.toContain(property.id);
    expect(JSON.stringify(lists.map((l) => l.body))).not.toContain(tenant.id);
    expect(JSON.stringify(lists.map((l) => l.body))).not.toContain(contractor.id);
  });
});

describe('tenants and notes', () => {
  it('records a tenant with a Right to Rent check, and notes stay internal', async () => {
    const { ws, staff } = await workspaceWithTeam(ctx.prisma);
    const c = await as(ctx, staff.id, ws.id);
    const t = await c.post('/tenants', { firstName: 'Ada', lastName: 'Example', email: 'ADA@test.example', phone: '07700 900000' });
    expect(t.status).toBe(201);
    expect(t.body.email).toBe('ada@test.example');
    const r = await c.post(`/tenants/${t.body.id}/right-to-rent`, { checkedOn: '2026-10-01', method: 'ONLINE_SHARE_CODE', expiresOn: '2027-04-01' });
    expect(r.body.rightToRent).toHaveLength(1);
    expect(r.body.rightToRentDue).toBe('2027-04-01');
    const n = await c.post('/notes', { body: 'Prefers calls after 5pm', tenantId: t.body.id });
    expect(n.status).toBe(201);
    const timeline = await c.get(`/activity?tenantId=${t.body.id}`);
    expect(timeline.body.map((a: { action: string }) => a.action)).toEqual(expect.arrayContaining(['tenant.created', 'rtr.recorded']));
  });

  it('a tenant with tenancies cannot be deleted', async () => {
    const { ws, owner } = await workspaceWithTeam(ctx.prisma);
    const p = await createProperty(ctx.prisma, ws.id);
    const tenant = await ctx.prisma.tenant.create({ data: { workspaceId: ws.id, firstName: 'Kept', lastName: 'Record' } });
    await ctx.prisma.tenancy.create({
      data: { workspaceId: ws.id, unitId: p.units[0]!.id, startDate: new Date('2026-01-01'), frequency: 'MONTHLY', dueDay: 1, tenants: { create: { tenantId: tenant.id } } },
    });
    expect((await (await as(ctx, owner.id, ws.id)).delete(`/tenants/${tenant.id}`)).status).toBe(409);
  });
});

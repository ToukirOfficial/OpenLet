import sharp from 'sharp';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { addDays, londonDate } from '@openlet/shared';
import { as, clearOutbox, createProperty, lastEmail, startApp, workspaceWithTeam, type TestContext } from './helpers.js';
import { MailService } from '../src/mail/mail.service.js';

let ctx: TestContext;
beforeAll(async () => {
  ctx = await startApp();
});
afterAll(async () => ctx.app.close());
beforeEach(clearOutbox);

const job = (token: string) => ({
  get: () => request(ctx.http).get(`/api/v1/job/${token}`),
  post: (body: object) => request(ctx.http).post(`/api/v1/job/${token}`).send(body),
});

async function setup() {
  const team = await workspaceWithTeam(ctx.prisma);
  const property = await createProperty(ctx.prisma, team.ws.id);
  const tenant = await ctx.prisma.tenant.create({ data: { workspaceId: team.ws.id, firstName: 'Rita', lastName: 'Renter', email: `rita-${Date.now()}@test.example`, phone: '07700 900999' } });
  const c = await as(ctx, team.staff.id, team.ws.id);
  const t = (await c.post('/tenancies', { unitId: property.units[0]!.id, tenantIds: [tenant.id], startDate: addDays(londonDate(), -30), rentPence: 50000, frequency: 'MONTHLY', dueDay: 1 })).body;
  const contractor = (await c.post('/contractors', { name: 'Gail Gas', trade: 'Gas engineer', email: `gail-${Date.now()}@test.example` })).body;
  const repair = (await c.post('/repairs', { propertyId: property.id, category: 'HEATING', title: 'Boiler not working', description: 'No hot water since Monday.', priority: 'URGENT', accessNotes: 'Key safe 1234' })).body;
  return { ...team, property, tenant, c, t, contractor, repair };
}

async function assign(s: Awaited<ReturnType<typeof setup>>) {
  const res = await s.c.post(`/repairs/${s.repair.id}/assign`, { contractorId: s.contractor.id });
  expect(res.status).toBe(200);
  const mail = [...MailService.outbox].reverse().find((m) => m.subject.includes('New job'))!;
  return { res, token: /job\/([\w-]+)/.exec(mail.text)![1]! };
}

describe('repairs', () => {
  it('logs a repair against the current tenancy with a target time from the priority', async () => {
    const s = await setup();
    expect(s.repair.reference).toBe(1);
    expect(s.repair.tenancyId).toBe(s.t.id);
    expect(s.repair.status).toBe('REPORTED');
    const hours = (Date.parse(s.repair.targetAt) - Date.parse(s.repair.createdAt)) / 3600_000;
    expect(Math.round(hours)).toBe(72);
    const second = await s.c.post('/repairs', { propertyId: s.property.id, category: 'OTHER', title: 'Loose handle', description: 'Kitchen door', priority: 'ROUTINE' });
    expect(second.body.reference).toBe(2);
  });

  it('emails the tenant on each status change; internal comments stay internal', async () => {
    const s = await setup();
    await s.c.post(`/repairs/${s.repair.id}/status`, { status: 'ACKNOWLEDGED' });
    expect(lastEmail(s.tenant.email!)?.subject).toContain('acknowledged');
    clearOutbox();
    await s.c.post(`/repairs/${s.repair.id}/comments`, { body: 'Landlord approved up to £300', visibility: 'INTERNAL' });
    expect(lastEmail(s.tenant.email!)).toBeUndefined();
    const d = await s.c.get(`/repairs/${s.repair.id}`);
    expect(d.body.events.some((e: { visibility: string; body: string }) => e.visibility === 'INTERNAL' && e.body.includes('£300'))).toBe(true);
  });

  it('lists open repairs, overdue first', async () => {
    const s = await setup();
    await ctx.prisma.repair.update({ where: { id: s.repair.id }, data: { targetAt: new Date(Date.now() - 3600_000) } });
    const list = await s.c.get('/repairs?status=OPEN');
    expect(list.body.items[0].id).toBe(s.repair.id);
    expect(list.body.items[0].overdue).toBe(true);
  });
});

describe('contractor job links', () => {
  it('shows only this job, hides tenant contact unless allowed, and never exposes internal notes or costs', async () => {
    const s = await setup();
    await s.c.post(`/repairs/${s.repair.id}/comments`, { body: 'SECRET internal note', visibility: 'INTERNAL' });
    const { token } = await assign(s);
    const view = await job(token).get();
    expect(view.status).toBe(200);
    expect(view.body.title).toBe('Boiler not working');
    expect(view.body.accessNotes).toBe('Key safe 1234');
    expect(view.body.tenant).toBeNull();
    const text = JSON.stringify(view.body);
    expect(text).not.toContain('SECRET');
    expect(text).not.toContain(s.tenant.email!);
    expect(text).not.toContain(s.repair.id);
    expect(text).not.toContain(s.ws.id);

    // Turn on "contractors see tenant contact".
    const settings = (await (await as(ctx, s.owner.id, s.ws.id)).get('/workspace')).body.settings;
    await (await as(ctx, s.owner.id, s.ws.id)).patch('/workspace/settings', { name: s.ws.name, contactEmail: null, contactPhone: null, address: null, ...settings, contractorSeesTenantContact: true });
    const again = await job(token).get();
    expect(again.body.tenant).toEqual({ names: 'Rita Renter', phone: '07700 900999' });
  });

  it('lets the contractor book a visit, add a cost, upload a photo and complete; the tenant is told', async () => {
    const s = await setup();
    const { token } = await assign(s);
    clearOutbox();
    const visit = new Date(Date.now() + 2 * 86_400_000).toISOString();
    const r1 = await job(token).post({ status: 'SCHEDULED', visitAt: visit, note: 'Bringing a new pump' });
    expect(r1.status).toBe(200);
    expect(r1.body.status).toBe('SCHEDULED');
    expect(lastEmail(s.tenant.email!)?.subject).toContain('scheduled');

    const photo = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#fff' } }).jpeg().toBuffer();
    const up = await request(ctx.http).post(`/api/v1/job/${token}/photos`).attach('file', photo, 'p.jpg');
    expect(up.status).toBe(200);
    expect(up.body.photos).toHaveLength(1);
    expect((await request(ctx.http).get(`/api/v1/job/${token}/photos/${up.body.photos[0].id}`)).status).toBe(200);

    const done = await job(token).post({ status: 'COMPLETED', costPence: 18500 });
    expect(done.body.status).toBe('COMPLETED');
    const staffView = await s.c.get(`/repairs/${s.repair.id}`);
    expect(staffView.body.costPence).toBe(18500);
    // Contractors can't close or cancel.
    expect((await job(token).post({ status: 'CLOSED' })).status).toBe(400);
  });

  it('a link opens one repair only: other repairs’ photos are refused', async () => {
    const s = await setup();
    const other = (await s.c.post('/repairs', { propertyId: s.property.id, category: 'OTHER', title: 'Other job', description: 'x', priority: 'ROUTINE' })).body;
    const pdf = Buffer.from('%PDF-1.4\n%%EOF');
    const doc = await s.c.upload('/documents').field('type', 'OTHER').field('repairId', other.id).attach('file', pdf, 'x.pdf');
    const { token } = await assign(s);
    expect((await request(ctx.http).get(`/api/v1/job/${token}/photos/${doc.body.id}`)).status).toBe(404);
  });

  it('expires after closing plus the grace period, can be revoked, and re-assigning kills the old link', async () => {
    const s = await setup();
    const { token } = await assign(s);
    await s.c.post(`/repairs/${s.repair.id}/status`, { status: 'CLOSED' });
    const grace = await job(token).get();
    expect(grace.status).toBe(200);
    expect(grace.body.canUpdate).toBe(false);
    expect((await job(token).post({ note: 'late note' })).status).toBe(400);
    await ctx.prisma.contractorLink.updateMany({ where: { repairId: s.repair.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await job(token).get()).status).toBe(404);

    await s.c.post(`/repairs/${s.repair.id}/status`, { status: 'ACKNOWLEDGED' });
    expect((await job(token).get()).status).toBe(200);
    await s.c.post(`/repairs/${s.repair.id}/links/revoke`);
    expect((await job(token).get()).status).toBe(404);

    const first = await assign(s);
    const second = await assign(s);
    expect((await job(first.token).get()).status).toBe(404);
    expect((await job(second.token).get()).status).toBe(200);
  });

  it('a made-up token gets nothing', async () => {
    expect((await job('a'.repeat(43)).get()).status).toBe(404);
    expect((await job('short').get()).status).toBe(400);
  });
});

describe('repair isolation', () => {
  it('staff from another workspace cannot see or change a repair', async () => {
    const s = await setup();
    const other = await workspaceWithTeam(ctx.prisma);
    const oc = await as(ctx, other.owner.id, other.ws.id);
    expect((await oc.get(`/repairs/${s.repair.id}`)).status).toBe(404);
    expect((await oc.post(`/repairs/${s.repair.id}/status`, { status: 'CLOSED' })).status).toBe(404);
    expect((await oc.post(`/repairs/${s.repair.id}/assign`, { contractorId: s.contractor.id })).status).toBe(404);
    expect((await oc.get('/repairs')).body.items).toHaveLength(0);
    // Their own contractor can't be put on our repair either.
    const theirs = (await oc.post('/contractors', { name: 'X', trade: 'Y', email: 'x@test.example' })).body;
    expect((await s.c.post(`/repairs/${s.repair.id}/assign`, { contractorId: theirs.id })).status).toBe(404);
  });
});

describe('contractor privacy', () => {
  it('tenant-facing comments between landlord and tenant are not shown to the contractor', async () => {
    const s = await setup();
    await s.c.post(`/repairs/${s.repair.id}/comments`, { body: 'Hi Rita, call me on my mobile', visibility: 'TENANT' });
    const { token } = await assign(s);
    expect(JSON.stringify((await job(token).get()).body)).not.toContain('call me');
  });
});

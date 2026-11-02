import sharp from 'sharp';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { addDays, londonDate } from '@openlet/shared';
import { ExportsService } from '../src/exports/exports.service.js';
import { LedgerService } from '../src/ledger/ledger.service.js';
import { QueueService } from '../src/jobs/queue.service.js';
import { as, clearOutbox, createProperty, createUser, lastEmail, startApp, workspaceWithTeam, type Client, type TestContext } from './helpers.js';

let ctx: TestContext;
beforeAll(async () => {
  ctx = await startApp();
});
afterAll(async () => ctx.app.close());
beforeEach(clearOutbox);

const today = londonDate();
const pdf = Buffer.from('%PDF-1.4\n%%EOF');

/** One workspace, two properties, two tenancies, each with its own tenant login, plus a joint tenant. */
async function world() {
  const team = await workspaceWithTeam(ctx.prisma);
  const sc = await as(ctx, team.staff.id, team.ws.id);
  const homes = await Promise.all([createProperty(ctx.prisma, team.ws.id), createProperty(ctx.prisma, team.ws.id)]);
  const people = await Promise.all(
    ['Alice', 'Bob', 'Carol'].map(async (name) => {
      const user = await createUser(ctx.prisma, { name: `${name} Tenant` });
      const tenant = await ctx.prisma.tenant.create({ data: { workspaceId: team.ws.id, userId: user.id, firstName: name, lastName: 'Tenant', email: user.email } });
      return { user, tenant };
    }),
  );
  const [alice, bob, carol] = people as [(typeof people)[0], (typeof people)[0], (typeof people)[0]];
  const mk = async (unitId: string, tenantIds: string[]) => (await sc.post('/tenancies', { unitId, tenantIds, startDate: addDays(today, -40), rentPence: 50000, frequency: 'MONTHLY', dueDay: Number(addDays(today, -40).slice(8, 10)) })).body;
  const tA = await mk(homes[0].units[0]!.id, [alice.tenant.id, carol.tenant.id]); // Alice and Carol share
  const tB = await mk(homes[1].units[0]!.id, [bob.tenant.id]);
  for (const t of [tA, tB]) await ctx.app.get(LedgerService).generateFor(t.id);
  const repairB = (await sc.post('/repairs', { propertyId: homes[1].id, category: 'PLUMBING', title: 'Bob leak', description: 'x', priority: 'ROUTINE' })).body;
  await sc.post(`/repairs/${repairB.id}/comments`, { body: 'internal for B', visibility: 'INTERNAL' });
  const docB = (await sc.upload('/documents').field('type', 'TENANCY_AGREEMENT').field('tenancyId', tB.id).field('sharedWithTenant', 'true').attach('file', pdf, 'b.pdf')).body;
  const docBUnshared = (await sc.upload('/documents').field('type', 'OTHER').field('tenancyId', tB.id).attach('file', pdf, 'x.pdf')).body;
  await sc.post(`/tenancies/${tB.id}/messages`, { body: 'Hello Bob' });
  await sc.post('/notes', { body: 'SECRET NOTE about B', tenancyId: tB.id });
  return { ...team, sc, homes, alice, bob, carol, tA, tB, repairB, docB, docBUnshared };
}

describe('tenant isolation', () => {
  it('a tenant sees only their own tenancy, ledger, repairs, documents and messages', async () => {
    const w = await world();
    const a = await as(ctx, w.alice.user.id, w.ws.id);
    const home = await a.get('/portal/home');
    expect(home.status).toBe(200);
    expect(home.body.tenancy.id).toBe(w.tA.id);
    expect(home.body.tenancies.map((t: { id: string }) => t.id)).toEqual([w.tA.id]);

    // Ledger: own works, Bob's is "not found".
    expect((await a.get('/portal/ledger')).body.tenancyId).toBe(w.tA.id);
    expect((await a.get(`/portal/ledger?tenancyId=${w.tB.id}`)).status).toBe(404);
    // Repairs, documents, messages of Bob's tenancy are invisible.
    expect((await a.get('/portal/repairs')).body).toHaveLength(0);
    expect((await a.get(`/portal/repairs/${w.repairB.id}`)).status).toBe(404);
    expect((await a.post(`/portal/repairs/${w.repairB.id}/comments`, { body: 'hi' })).status).toBe(404);
    expect((await a.get('/portal/documents')).body).toHaveLength(0);
    expect((await a.get(`/portal/documents/${w.docB.id}/download`)).status).toBe(404);
    expect((await a.get(`/portal/messages?tenancyId=${w.tB.id}`)).status).toBe(404);
    expect((await a.post('/portal/messages', { body: 'sneaky', tenancyId: w.tB.id })).status).toBe(404);
    expect((await a.post('/portal/repairs', { category: 'OTHER', title: 'x', description: 'y', tenancyId: w.tB.id })).status).toBe(404);
    expect((await a.post('/portal/statements', { tenancyId: w.tB.id, from: addDays(today, -60), to: today })).status).toBe(404);
  });

  it('a tenant can’t reach any staff route, even with the workspace header', async () => {
    const w = await world();
    const a = await as(ctx, w.alice.user.id, w.ws.id);
    for (const url of ['/properties', '/tenants', '/tenancies', `/tenancies/${w.tA.id}`, `/tenancies/${w.tA.id}/ledger`, '/repairs', `/notes?tenancyId=${w.tA.id}`, '/activity', '/arrears', '/compliance', '/messages/threads', `/documents/${w.docB.id}/download`]) {
      expect((await a.get(url)).status, url).toBe(403);
    }
    expect((await a.post('/payments', { tenancyId: w.tA.id, date: today, amountPence: 1, method: 'CASH' })).status).toBe(403);
  });

  it('internal notes, internal repair comments, unshared documents and costs never reach the tenant', async () => {
    const w = await world();
    const b = await as(ctx, w.bob.user.id, w.ws.id);
    await w.sc.patch(`/repairs/${w.repairB.id}`, { costPence: 99999 });
    const repair = await b.get(`/portal/repairs/${w.repairB.id}`);
    expect(repair.status).toBe(200);
    const text = JSON.stringify([repair.body, (await b.get('/portal/home')).body, (await b.get('/portal/repairs')).body, (await b.get('/portal/documents')).body]);
    expect(text).not.toContain('internal for B');
    expect(text).not.toContain('SECRET NOTE');
    expect(text).not.toContain('999.99');
    expect(text).not.toContain('99999');
    expect(text).not.toContain(w.docBUnshared.id);
    expect(text).toContain(w.docB.id);
    expect((await b.get(`/portal/documents/${w.docBUnshared.id}/download`)).status).toBe(404);
    expect((await b.get(`/portal/documents/${w.docB.id}/download`)).status).toBe(200);
  });

  it('joint tenants both see the shared tenancy', async () => {
    const w = await world();
    const c = await as(ctx, w.carol.user.id, w.ws.id);
    expect((await c.get('/portal/home')).body.tenancy.id).toBe(w.tA.id);
    expect((await c.get('/portal/ledger')).body.tenancyId).toBe(w.tA.id);
  });

  it('a tenant in another workspace can’t use this workspace’s portal', async () => {
    const w = await world();
    const other = await workspaceWithTeam(ctx.prisma);
    const a = await as(ctx, w.alice.user.id, other.ws.id);
    expect((await a.get('/portal/home')).status).toBe(403);
  });

  it('statements and photos belong to the tenant who made them', async () => {
    const w = await world();
    const a = await as(ctx, w.alice.user.id, w.ws.id);
    const job = (await a.post('/portal/statements', { from: addDays(today, -60), to: today })).body;
    await ctx.app.get(ExportsService).run((QueueService.testJobs.find((j) => j.name === 'export')!.data as { jobId: string }).jobId);
    expect((await a.get(`/portal/jobs/${job.id}/download`)).status).toBe(200);
    const carol = await as(ctx, w.carol.user.id, w.ws.id);
    expect((await carol.get(`/portal/jobs/${job.id}/download`)).status).toBe(403);
    expect((await w.sc.get(`/jobs/${job.id}/download`)).status).toBe(403);
  });
});

describe('tenant portal actions', () => {
  it('reports a repair with a photo; staff are emailed; the repair shows for the tenant and staff', async () => {
    const w = await world();
    const a: Client = await as(ctx, w.alice.user.id, w.ws.id);
    const r = await a.post('/portal/repairs', { category: 'HEATING', title: 'Boiler not working', description: 'No hot water', availability: 'Weekday mornings' });
    expect(r.status).toBe(201);
    expect(lastEmail(w.owner.email)?.subject).toContain('Boiler not working');
    const photo = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#000' } }).jpeg().toBuffer();
    const up = await a.upload(`/portal/repairs/${r.body.id}/photos`).attach('file', photo, 'p.jpg');
    expect(up.status).toBe(200);
    expect(up.body.photos).toHaveLength(1);
    const staffView = await w.sc.get(`/repairs/${r.body.id}`);
    expect(staffView.body.reportedBy).toBe('TENANT');
    expect(staffView.body.tenancyId).toBe(w.tA.id);
    expect(staffView.body.photos).toHaveLength(1);
  });

  it('messages go both ways and email the other side', async () => {
    const w = await world();
    const b = await as(ctx, w.bob.user.id, w.ws.id);
    expect(lastEmail(w.bob.user.email)?.subject).toContain('New message');
    const res = await b.post('/portal/messages', { body: 'Thanks, all good' });
    expect(res.body.messages.map((m: { body: string }) => m.body)).toEqual(['Hello Bob', 'Thanks, all good']);
    expect(lastEmail(w.staff.email)?.subject).toContain('Message from');
    const threads = await w.sc.get('/messages/threads');
    expect(threads.body.find((t: { tenancyId: string }) => t.tenancyId === w.tB.id).unread).toBe(1);
  });

  it('a tenant updates their own phone and emergency contact only', async () => {
    const w = await world();
    const a = await as(ctx, w.alice.user.id, w.ws.id);
    const res = await a.patch('/portal/contact', { phone: '07700 900555', emergencyName: 'Mum', emergencyPhone: '07700 900556', firstName: 'Hacker', email: 'x@evil.example' });
    expect(res.status).toBe(200);
    const t = await ctx.prisma.tenant.findUniqueOrThrow({ where: { id: w.alice.tenant.id } });
    expect(t.phone).toBe('07700 900555');
    expect(t.firstName).toBe('Alice');
    expect(t.email).toBe(w.alice.user.email);
  });
});

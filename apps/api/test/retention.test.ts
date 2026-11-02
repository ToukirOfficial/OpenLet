import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RetentionService } from '../src/retention/retention.service.js';
import { as, createProperty, createUser, startApp, workspaceWithTeam, type TestContext } from './helpers.js';

let ctx: TestContext;
let retention: RetentionService;
beforeAll(async () => {
  ctx = await startApp();
  retention = ctx.app.get(RetentionService);
});
afterAll(async () => ctx.app.close());

const d = (s: string) => new Date(`${s}T00:00:00Z`);

async function endedTenancy(endedOn: string, opts: { joint?: boolean } = {}) {
  const team = await workspaceWithTeam(ctx.prisma);
  const p = await createProperty(ctx.prisma, team.ws.id);
  const user = await createUser(ctx.prisma);
  const tenant = await ctx.prisma.tenant.create({ data: { workspaceId: team.ws.id, userId: user.id, firstName: 'Olga', lastName: 'Oldtenant', email: 'olga@test.example', phone: '07700 900321', dateOfBirth: d('1980-02-03'), emergencyName: 'Mum', emergencyPhone: '07700 900322', notes: 'Has a cat' } });
  const other = opts.joint ? await ctx.prisma.tenant.create({ data: { workspaceId: team.ws.id, firstName: 'Ned', lastName: 'Newer' } }) : null;
  const t = await ctx.prisma.tenancy.create({
    data: {
      workspaceId: team.ws.id,
      unitId: p.units[0]!.id,
      startDate: d('2015-01-01'),
      endDate: d(endedOn),
      endedOn: d(endedOn),
      frequency: 'MONTHLY',
      dueDay: 1,
      tenants: { create: [{ tenantId: tenant.id }, ...(other ? [{ tenantId: other.id }] : [])] },
      rentChanges: { create: { amountPence: 50000, effectiveFrom: d('2015-01-01') } },
      guarantors: { create: { name: 'Gina Guarantor', email: 'gina@test.example', phone: '07700 900400' } },
    },
  });
  await ctx.prisma.ledgerEntry.createMany({
    data: [
      { workspaceId: team.ws.id, tenancyId: t.id, type: 'RENT_CHARGE', amountPence: 50000, date: d('2015-01-01'), periodStart: d('2015-01-01'), periodEnd: d('2015-01-31') },
      { workspaceId: team.ws.id, tenancyId: t.id, type: 'PAYMENT', amountPence: 50000, date: d('2015-01-01') },
    ],
  });
  await ctx.prisma.rightToRentCheck.create({ data: { tenantId: tenant.id, checkedOn: d('2015-01-01'), method: 'MANUAL_DOCUMENT' } });
  await ctx.prisma.message.create({ data: { workspaceId: team.ws.id, tenancyId: t.id, authorType: 'TENANT', authorUserId: user.id, authorName: 'Olga Oldtenant', body: 'Moving out' } });
  const staff = await as(ctx, team.staff.id, team.ws.id);
  const doc = await staff.upload('/documents').field('type', 'RIGHT_TO_RENT_EVIDENCE').field('tenantId', tenant.id).attach('file', Buffer.from('%PDF-1.4\n%%EOF'), 'passport.pdf');
  return { ...team, tenant, other, t, user, docId: doc.body.id as string, staff };
}

describe('retention', () => {
  it('anonymises a tenant 6 years after their tenancy ended, keeping the money', async () => {
    const s = await endedTenancy('2019-06-30');
    const res = await retention.run('2026-11-02');
    expect(res.anonymised).toBeGreaterThanOrEqual(1);
    const t = await ctx.prisma.tenant.findUniqueOrThrow({ where: { id: s.tenant.id } });
    expect(t).toMatchObject({ firstName: 'Former', lastName: 'tenant', email: null, phone: null, dateOfBirth: null, emergencyName: null, emergencyPhone: null, notes: null, userId: null });
    expect(t.anonymisedAt).not.toBeNull();
    expect(await ctx.prisma.rightToRentCheck.count({ where: { tenantId: s.tenant.id } })).toBe(0);
    expect(await ctx.prisma.document.count({ where: { id: s.docId } })).toBe(0);
    const g = await ctx.prisma.guarantor.findFirstOrThrow({ where: { tenancyId: s.t.id } });
    expect(g).toMatchObject({ name: 'Former guarantor', email: null, phone: null });
    const m = await ctx.prisma.message.findFirstOrThrow({ where: { tenancyId: s.t.id } });
    expect(m.authorName).toBe('Former tenant');
    // Financial totals are untouched.
    const sum = await ctx.prisma.ledgerEntry.aggregate({ where: { tenancyId: s.t.id }, _sum: { amountPence: true }, _count: true });
    expect(sum._count).toBe(2);
    expect(sum._sum.amountPence).toBe(100000);
    // The old login can no longer reach the portal.
    expect((await (await as(ctx, s.user.id, s.ws.id)).get('/portal/home')).status).toBe(403);
    expect(await ctx.prisma.auditLog.count({ where: { action: 'tenant.anonymised', targetId: s.tenant.id } })).toBe(1);
  });

  it('keeps tenants within the retention period, and anyone with a later tenancy', async () => {
    const recent = await endedTenancy('2021-06-30');
    await retention.run('2026-11-02');
    expect((await ctx.prisma.tenant.findUniqueOrThrow({ where: { id: recent.tenant.id } })).anonymisedAt).toBeNull();

    const s = await endedTenancy('2018-01-31');
    const p2 = await createProperty(ctx.prisma, s.ws.id);
    await ctx.prisma.tenancy.create({ data: { workspaceId: s.ws.id, unitId: p2.units[0]!.id, startDate: d('2024-01-01'), frequency: 'MONTHLY', dueDay: 1, tenants: { create: { tenantId: s.tenant.id } } } });
    await retention.run('2026-11-02');
    expect((await ctx.prisma.tenant.findUniqueOrThrow({ where: { id: s.tenant.id } })).anonymisedAt).toBeNull();
  });

  it('uses the workspace setting for the number of years', async () => {
    const s = await endedTenancy('2023-06-30');
    const ws = await ctx.prisma.workspace.findUniqueOrThrow({ where: { id: s.ws.id } });
    await ctx.prisma.workspace.update({ where: { id: s.ws.id }, data: { settings: { ...(ws.settings as object), retentionYears: 2 } } });
    await retention.run('2026-11-02');
    expect((await ctx.prisma.tenant.findUniqueOrThrow({ where: { id: s.tenant.id } })).anonymisedAt).not.toBeNull();
  });

  it('a joint tenancy keeps the guarantor until every tenant on it is anonymised', async () => {
    const s = await endedTenancy('2018-06-30', { joint: true });
    await ctx.prisma.tenancy.create({ data: { workspaceId: s.ws.id, unitId: (await createProperty(ctx.prisma, s.ws.id)).units[0]!.id, startDate: d('2025-01-01'), frequency: 'MONTHLY', dueDay: 1, tenants: { create: { tenantId: s.other!.id } } } });
    await retention.run('2026-11-02');
    expect((await ctx.prisma.tenant.findUniqueOrThrow({ where: { id: s.tenant.id } })).anonymisedAt).not.toBeNull();
    expect((await ctx.prisma.guarantor.findFirstOrThrow({ where: { tenancyId: s.t.id } })).name).toBe('Gina Guarantor');
  });

  it('archives tenancies 90 days after they end', async () => {
    const s = await endedTenancy('2026-07-01');
    await retention.run('2026-11-02');
    expect((await ctx.prisma.tenancy.findUniqueOrThrow({ where: { id: s.t.id } })).archivedAt).not.toBeNull();
    expect((await s.staff.get('/tenancies')).body.items).toHaveLength(0);
  });
});

describe('workspace logo', () => {
  it('Owners and Managers upload a PNG or JPEG logo; it is served publicly by workspace id', async () => {
    const { ws, manager, staff } = await workspaceWithTeam(ctx.prisma);
    const png = await sharp({ create: { width: 30, height: 10, channels: 3, background: '#135e4b' } }).png().toBuffer();
    expect((await (await as(ctx, staff.id, ws.id)).upload('/workspace/logo').attach('file', png, 'logo.png')).status).toBe(403);
    expect((await (await as(ctx, manager.id, ws.id)).upload('/workspace/logo').attach('file', png, 'logo.png')).status).toBe(200);
    const res = await (await import('supertest')).default(ctx.http).get(`/api/v1/workspace-logo/${ws.id}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('image/png');
  });
});

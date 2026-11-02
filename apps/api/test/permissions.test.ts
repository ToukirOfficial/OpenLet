import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { as, createTenantUser, createUser, startApp, workspaceWithTeam, type TestContext } from './helpers.js';

let ctx: TestContext;
beforeAll(async () => {
  ctx = await startApp();
});
afterAll(async () => ctx.app.close());

/** Every route the app serves, as [METHOD, path]. */
function routes(): [string, string][] {
  const express = ctx.app.getHttpAdapter().getInstance() as { router?: { stack: unknown[] }; _router?: { stack: unknown[] } };
  const stack = (express.router ?? express._router)!.stack as { route?: { path: string; methods: Record<string, boolean> } }[];
  return stack.filter((l) => l.route).flatMap((l) => Object.keys(l.route!.methods).map((m) => [m.toUpperCase(), l.route!.path] as [string, string]));
}

/** Routes anyone may call, by design (project rule 2). */
const PUBLIC = new Set([
  'GET /api/v1/health',
  'GET /api/v1/setup',
  'POST /api/v1/setup',
  'POST /api/v1/auth/signup',
  'POST /api/v1/auth/login',
  'POST /api/v1/auth/verify-code',
  'POST /api/v1/auth/resend-code',
  'POST /api/v1/auth/refresh',
  'POST /api/v1/auth/logout',
  'POST /api/v1/auth/reset/request',
  'POST /api/v1/auth/reset/confirm',
  'GET /api/v1/invites/:token',
  'POST /api/v1/invites/accept',
  'GET /api/v1/job/:token',
  'POST /api/v1/job/:token',
  'POST /api/v1/job/:token/photos',
  'GET /api/v1/job/:token/photos/:id',
  'GET /api/v1/demo/info',
  'POST /api/v1/demo/login/:as',
  'GET /api/v1/demo/mail',
  'GET /api/v1/workspace-logo/:id',
]);

describe('deny by default', () => {
  it('every non-public route refuses a request with no session', async () => {
    const all = routes();
    expect(all.length).toBeGreaterThan(10);
    for (const [method, path] of all) {
      const key = `${method} ${path}`;
      if (PUBLIC.has(key)) continue;
      const url = path.replace(/:(\w+)/g, '01900000-0000-7000-8000-000000000000');
      const res = await request(ctx.http)[method.toLowerCase() as 'get'](url).send({});
      expect([401, 403], key).toContain(res.status);
    }
  });
});

describe('roles', () => {
  it('only the Owner manages the team and deletes the workspace', async () => {
    const { ws, owner, manager, staff } = await workspaceWithTeam(ctx.prisma);
    for (const u of [manager, staff]) {
      const c = await as(ctx, u.id, ws.id);
      expect((await c.get('/members')).status).toBe(403);
      expect((await c.post('/members/invites', { email: 'x@test.example', role: 'STAFF' })).status).toBe(403);
      expect((await c.post('/workspace/delete', { confirmName: ws.name })).status).toBe(403);
      expect((await c.get('/audit-log')).status).toBe(403);
    }
    expect((await (await as(ctx, owner.id, ws.id)).get('/members')).status).toBe(200);
  });

  it('Owner and Manager change settings; Staff cannot', async () => {
    const { ws, owner, manager, staff } = await workspaceWithTeam(ctx.prisma);
    const current = (await (await as(ctx, owner.id, ws.id)).get('/workspace')).body;
    const body = { name: ws.name, contactEmail: null, contactPhone: null, address: null, ...current.settings };
    expect((await (await as(ctx, manager.id, ws.id)).patch('/workspace/settings', body)).status).toBe(200);
    expect((await (await as(ctx, staff.id, ws.id)).patch('/workspace/settings', body)).status).toBe(403);
  });

  it('the last Owner cannot be demoted or removed', async () => {
    const { ws, owner } = await workspaceWithTeam(ctx.prisma);
    const c = await as(ctx, owner.id, ws.id);
    const m = await ctx.prisma.membership.findFirstOrThrow({ where: { workspaceId: ws.id, userId: owner.id } });
    expect((await c.patch(`/members/${m.id}`, { role: 'STAFF' })).status).toBe(400);
    expect((await c.delete(`/members/${m.id}`)).status).toBe(400);
  });

  it('a role change is written to the audit log', async () => {
    const { ws, owner, staff } = await workspaceWithTeam(ctx.prisma);
    const m = await ctx.prisma.membership.findFirstOrThrow({ where: { workspaceId: ws.id, userId: staff.id } });
    expect((await (await as(ctx, owner.id, ws.id)).patch(`/members/${m.id}`, { role: 'MANAGER' })).status).toBe(200);
    expect(await ctx.prisma.auditLog.count({ where: { workspaceId: ws.id, action: 'member.role.manager' } })).toBe(1);
  });

  it('the workspace delete needs the exact name and is Owner-only', async () => {
    const { ws, owner } = await workspaceWithTeam(ctx.prisma);
    const c = await as(ctx, owner.id, ws.id);
    expect((await c.post('/workspace/delete', { confirmName: 'wrong' })).status).toBe(400);
    expect((await c.post('/workspace/delete', { confirmName: ws.name })).status).toBe(200);
    expect(await ctx.prisma.workspace.findUnique({ where: { id: ws.id } })).toBeNull();
  });
});

describe('workspace isolation', () => {
  it('a member of one workspace cannot act in another, whatever header they send', async () => {
    const a = await workspaceWithTeam(ctx.prisma);
    const b = await workspaceWithTeam(ctx.prisma);
    const c = await as(ctx, a.owner.id, b.ws.id);
    expect((await c.get('/workspace')).status).toBe(403);
    expect((await c.get('/members')).status).toBe(403);
    const own = await (await as(ctx, a.owner.id, a.ws.id)).get('/workspace');
    expect(own.body.id).toBe(a.ws.id);
  });

  it('a junk workspace header is refused', async () => {
    const a = await workspaceWithTeam(ctx.prisma);
    expect((await (await as(ctx, a.owner.id, 'not-a-uuid')).get('/workspace')).status).toBe(403);
  });

  it('a person in two workspaces gets the role of the workspace they pick', async () => {
    const a = await workspaceWithTeam(ctx.prisma);
    const b = await workspaceWithTeam(ctx.prisma);
    await ctx.prisma.membership.create({ data: { workspaceId: b.ws.id, userId: a.owner.id, role: 'STAFF' } });
    expect((await (await as(ctx, a.owner.id, a.ws.id)).get('/members')).status).toBe(200);
    expect((await (await as(ctx, a.owner.id, b.ws.id)).get('/members')).status).toBe(403);
  });
});

describe('tenant role', () => {
  it('a tenant cannot reach any staff route', async () => {
    const { ws } = await workspaceWithTeam(ctx.prisma);
    const { user } = await createTenantUser(ctx.prisma, ws.id);
    const c = await as(ctx, user.id, ws.id);
    expect((await c.get('/workspace')).status).toBe(403);
    expect((await c.get('/members')).status).toBe(403);
    const me = await c.get('/me');
    expect(me.body.workspaces).toHaveLength(0);
    expect(me.body.tenancies).toHaveLength(1);
  });

  it('a signed-in person with no workspace sees only their own account', async () => {
    const user = await createUser(ctx.prisma);
    const c = await as(ctx, user.id);
    expect((await c.get('/me')).status).toBe(200);
    expect((await c.get('/workspace')).status).toBe(403);
  });
});

describe('CSRF', () => {
  it('a write with a session cookie but no CSRF header is refused', async () => {
    const res = await request(ctx.http).post('/api/v1/members/invites').set('Cookie', 'ol_at=x.y.z').send({ email: 'a@test.example', role: 'STAFF' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CSRF');
  });

  it('a write from another site is refused', async () => {
    const res = await request(ctx.http).post('/api/v1/auth/login').set('Origin', 'https://evil.example').send({ email: 'a@test.example', password: 'x' });
    expect(res.status).toBe(403);
  });
});

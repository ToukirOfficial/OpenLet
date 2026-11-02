import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PASSWORD, as, anon, clearOutbox, createUser, lastEmail, startApp, workspaceWithTeam, type TestContext } from './helpers.js';

let ctx: TestContext;
beforeAll(async () => {
  ctx = await startApp();
});
afterAll(async () => ctx.app.close());
beforeEach(clearOutbox);

/** Cookies from a response, as name=value pairs ready to send back. */
function cookiesOf(res: request.Response): Record<string, string> {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  const out: Record<string, string> = {};
  for (const c of raw ?? []) {
    const [pair] = c.split(';');
    const i = pair!.indexOf('=');
    out[pair!.slice(0, i)] = pair!.slice(i + 1);
  }
  return out;
}
const cookieHeader = (c: Record<string, string>) => Object.entries(c).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join('; ');
const CSRF = 'c'.repeat(24);
const refresh = (rt: string | undefined) =>
  request(ctx.http).post('/api/v1/auth/refresh').set('Cookie', `ol_rt=${rt}; ol_csrf=${CSRF}`).set('x-csrf-token', CSRF);
const codeFrom = (text: string) => /\b(\d{6})\b/.exec(text)?.[1] ?? '';

describe('first-run setup', () => {
  it('creates the Owner and workspace once, then closes for good', async () => {
    expect((await anon(ctx).get('/setup')).body.setupNeeded).toBe(true);
    const res = await anon(ctx).post('/setup', { name: 'Olive Owner', email: 'olive@test.example', password: PASSWORD, workspaceName: 'Olive Lettings' });
    expect(res.status).toBe(201);
    expect(cookiesOf(res)['ol_at']).toBeTruthy();
    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { email: 'olive@test.example' }, include: { memberships: true } });
    expect(user.memberships[0]?.role).toBe('OWNER');
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');

    expect((await anon(ctx).get('/setup')).body.setupNeeded).toBe(false);
    const again = await anon(ctx).post('/setup', { name: 'Mallory', email: 'mallory@test.example', password: PASSWORD, workspaceName: 'Takeover' });
    expect(again.status).toBe(403);
  });

  it('refuses sign-up while SIGNUP_ENABLED is off', async () => {
    const res = await anon(ctx).post('/auth/signup', { name: 'New', email: 'new@test.example', password: PASSWORD, workspaceName: 'New Co' });
    expect(res.status).toBe(403);
  });
});

describe('login with email code', () => {
  it('asks for a code on a new device, then logs in and trusts the device', async () => {
    const user = await createUser(ctx.prisma);
    const wrong = await anon(ctx).post('/auth/login', { email: user.email, password: 'nope-nope-nope' });
    expect(wrong.status).toBe(401);

    const first = await anon(ctx).post('/auth/login', { email: user.email, password: PASSWORD });
    expect(first.status).toBe(200);
    expect(first.body.status).toBe('code');
    expect(cookiesOf(first)['ol_at']).toBeUndefined();
    const code = codeFrom(lastEmail(user.email)!.text);

    const bad = await anon(ctx).post('/auth/verify-code', { challenge: first.body.challenge, code: code === '000000' ? '111111' : '000000' });
    expect(bad.status).toBe(400);

    const ok = await anon(ctx).post('/auth/verify-code', { challenge: first.body.challenge, code });
    expect(ok.status).toBe(200);
    const cookies = cookiesOf(ok);
    expect(cookies['ol_at']).toBeTruthy();
    expect(cookies['ol_td']).toBeTruthy();

    // The code works once.
    expect((await anon(ctx).post('/auth/verify-code', { challenge: first.body.challenge, code })).status).toBe(400);

    // Same browser (trusted device cookie): no code next time.
    const second = await request(ctx.http).post('/api/v1/auth/login').set('Cookie', `ol_td=${cookies['ol_td']}`).send({ email: user.email, password: PASSWORD });
    expect(second.body.status).toBe('ok');
    expect(cookiesOf(second)['ol_at']).toBeTruthy();

    const me = await request(ctx.http).get('/api/v1/me').set('Cookie', cookieHeader({ ol_at: cookiesOf(second)['ol_at']! }));
    expect(me.status).toBe(200);
    expect(me.body.email).toBe(user.email);
    expect(me.body.passwordHash).toBeUndefined();
  });

  it('locks a code after five wrong tries', async () => {
    const user = await createUser(ctx.prisma);
    const first = await anon(ctx).post('/auth/login', { email: user.email, password: PASSWORD });
    const code = codeFrom(lastEmail(user.email)!.text);
    const wrong = code === '123456' ? '654321' : '123456';
    for (let i = 0; i < 5; i++) await anon(ctx).post('/auth/verify-code', { challenge: first.body.challenge, code: wrong });
    expect((await anon(ctx).post('/auth/verify-code', { challenge: first.body.challenge, code })).status).toBe(400);
  });

  it('rate-limits repeated logins for one email', async () => {
    const user = await createUser(ctx.prisma);
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) statuses.push((await anon(ctx).post('/auth/login', { email: user.email, password: 'wrong-password-x' })).status);
    expect(statuses).toContain(429);
  });
});

describe('refresh tokens', () => {
  async function loggedIn() {
    const user = await createUser(ctx.prisma);
    const first = await anon(ctx).post('/auth/login', { email: user.email, password: PASSWORD });
    const ok = await anon(ctx).post('/auth/verify-code', { challenge: first.body.challenge, code: codeFrom(lastEmail(user.email)!.text) });
    return cookiesOf(ok);
  }

  it('rotates the refresh token and refuses the old one; reuse after the grace window logs everyone out', async () => {
    const c = await loggedIn();
    const r1 = await refresh(c['ol_rt']);
    expect(r1.status).toBe(200);
    const c1 = cookiesOf(r1);
    expect(c1['ol_rt']).toBeTruthy();
    expect(c1['ol_rt']).not.toBe(c['ol_rt']);

    // Old token again: refused.
    expect((await refresh(c['ol_rt'])).status).toBe(401);

    // Pretend the old token was rotated long ago: reuse now revokes the family, so the new one dies too.
    await ctx.prisma.refreshToken.updateMany({ where: { rotatedAt: { not: null } }, data: { rotatedAt: new Date(Date.now() - 60_000) } });
    expect((await refresh(c['ol_rt'])).status).toBe(401);
    expect((await refresh(c1['ol_rt'])).status).toBe(401);
    expect((await request(ctx.http).get('/api/v1/me').set('Cookie', `ol_at=${c1['ol_at']}`)).status).toBe(401);
  });

  it('logout ends the session at once, access token included', async () => {
    const c = await loggedIn();
    await request(ctx.http).post('/api/v1/auth/logout').set('Cookie', cookieHeader({ ol_rt: c['ol_rt']!, ol_csrf: 'x'.repeat(24) })).set('x-csrf-token', 'x'.repeat(24));
    expect((await request(ctx.http).get('/api/v1/me').set('Cookie', `ol_at=${c['ol_at']}`)).status).toBe(401);
  });

  it('refuses a forged or expired access token', async () => {
    expect((await request(ctx.http).get('/api/v1/me').set('Cookie', 'ol_at=abc.def.ghi')).status).toBe(401);
  });
});

describe('password reset', () => {
  it('sends a link, sets the new password and logs out every session', async () => {
    const user = await createUser(ctx.prisma);
    const client = await as(ctx, user.id);
    expect((await anon(ctx).post('/auth/reset/request', { email: 'nobody@test.example' })).status).toBe(200);
    expect((await anon(ctx).post('/auth/reset/request', { email: user.email })).status).toBe(200);
    const token = /token=([\w-]+)/.exec(lastEmail(user.email)!.text)?.[1];
    expect(token).toBeTruthy();
    expect((await anon(ctx).post('/auth/reset/confirm', { token, password: 'a-brand-new-password' })).status).toBe(200);
    expect((await anon(ctx).post('/auth/reset/confirm', { token, password: 'another-new-password' })).status).toBe(400);
    expect((await client.get('/me')).status).toBe(401);
    const login = await anon(ctx).post('/auth/login', { email: user.email, password: 'a-brand-new-password' });
    expect(login.status).toBe(200);
  });
});

describe('invites', () => {
  it('a team invite creates the account with the invited role', async () => {
    const { ws, owner } = await workspaceWithTeam(ctx.prisma);
    const c = await as(ctx, owner.id, ws.id);
    expect((await c.post('/members/invites', { email: 'newstaff@test.example', role: 'STAFF' })).status).toBe(201);
    const token = /invite\/([\w-]+)/.exec(lastEmail('newstaff@test.example')!.text)?.[1];
    const info = await anon(ctx).get(`/invites/${token}`);
    expect(info.body).toMatchObject({ kind: 'MEMBER', role: 'STAFF', hasAccount: false });
    const accepted = await anon(ctx).post('/invites/accept', { token, name: 'New Staff', password: PASSWORD });
    expect(accepted.status).toBe(200);
    const m = await ctx.prisma.membership.findFirst({ where: { workspaceId: ws.id, user: { email: 'newstaff@test.example' } } });
    expect(m?.role).toBe('STAFF');
    expect((await anon(ctx).post('/invites/accept', { token, name: 'Again', password: PASSWORD })).status).toBe(404);
  });

  it('an existing account must confirm its password to join (one person, several workspaces)', async () => {
    const { ws, owner } = await workspaceWithTeam(ctx.prisma);
    const other = await createUser(ctx.prisma);
    const c = await as(ctx, owner.id, ws.id);
    await c.post('/members/invites', { email: other.email, role: 'MANAGER' });
    const token = /invite\/([\w-]+)/.exec(lastEmail(other.email)!.text)?.[1];
    expect((await anon(ctx).post('/invites/accept', { token, password: 'wrong-password-123' })).status).toBe(400);
    expect((await anon(ctx).post('/invites/accept', { token, password: PASSWORD })).status).toBe(200);
    const me = await (await as(ctx, other.id)).get('/me');
    expect(me.body.workspaces.map((w: { id: string }) => w.id)).toContain(ws.id);
  });
});

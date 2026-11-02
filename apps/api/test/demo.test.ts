import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resetConfig } from '../src/config.js';
import { SEED_PASSWORD, seedAllowed } from '../src/seed.js';
import { as, createUser, startApp, type TestContext } from './helpers.js';

describe('the seed only runs for the demo, or with --dev off production', () => {
  it('allows DEMO_MODE=true anywhere', () => {
    expect(seedAllowed({ DEMO_MODE: true, NODE_ENV: 'production' }, []).ok).toBe(true);
  });
  it('allows --dev on a development or test machine', () => {
    expect(seedAllowed({ DEMO_MODE: false, NODE_ENV: 'development' }, ['--dev']).ok).toBe(true);
  });
  it('refuses without DEMO_MODE and without --dev', () => {
    expect(seedAllowed({ DEMO_MODE: false, NODE_ENV: 'development' }, []).ok).toBe(false);
  });
  it('refuses --dev in production', () => {
    expect(seedAllowed({ DEMO_MODE: false, NODE_ENV: 'production' }, ['--dev']).ok).toBe(false);
  });
});

describe('demo routes when DEMO_MODE is off', () => {
  let ctx: TestContext;
  beforeAll(async () => {
    ctx = await startApp();
  });
  afterAll(async () => ctx.app.close());

  it('a demo account cannot log in, even with the right password, and its sessions stop working', async () => {
    const { hashPassword } = await import('../src/auth/passwords.js');
    const demo = await createUser(ctx.prisma, { isDemo: true, passwordHash: await hashPassword(SEED_PASSWORD) });
    const res = await request(ctx.http).post('/api/v1/auth/login').send({ email: demo.email, password: SEED_PASSWORD });
    expect(res.status).toBe(401);
    expect((res.headers['set-cookie'] as unknown as string[] | undefined)?.some((c) => c.startsWith('ol_at=')) ?? false).toBe(false);
    const session = await as(ctx, demo.id);
    expect((await session.get('/me')).status).toBe(401);
    // An ordinary account with the same password is unaffected (it gets the email-code step).
    const normal = await createUser(ctx.prisma, { passwordHash: await hashPassword(SEED_PASSWORD) });
    expect((await request(ctx.http).post('/api/v1/auth/login').send({ email: normal.email, password: SEED_PASSWORD })).body.status).toBe('code');
  });

  it('one-click login and the mail viewer do not exist', async () => {
    expect((await request(ctx.http).post('/api/v1/demo/login/landlord')).status).toBe(404);
    expect((await request(ctx.http).get('/api/v1/demo/mail')).status).toBe(404);
    expect((await request(ctx.http).get('/api/v1/demo/info')).body.demoMode).toBe(false);
  });
});

describe('demo mode on', () => {
  let ctx: TestContext;
  beforeAll(async () => {
    process.env['DEMO_MODE'] = 'true';
    resetConfig();
    ctx = await startApp();
    const { seed } = await import('../src/seed.js');
    await seed(ctx.prisma as never);
  });
  afterAll(async () => {
    await ctx.app.close();
    process.env['DEMO_MODE'] = 'false';
    resetConfig();
  });

  it('one click logs in as the landlord or the tenant, and sign-up stays closed', async () => {
    const l = await request(ctx.http).post('/api/v1/demo/login/landlord');
    expect(l.status).toBe(200);
    const cookie = (l.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('ol_at='))!.split(';')[0]!;
    const me = await request(ctx.http).get('/api/v1/me').set('Cookie', cookie);
    expect(me.body.workspaces[0].role).toBe('OWNER');
    const t = await request(ctx.http).post('/api/v1/demo/login/tenant');
    expect(t.body.redirect).toBe('/portal');
    expect((await request(ctx.http).get('/api/v1/setup')).body.signupEnabled).toBe(false);
  });

  it('uploads are limited to 2 MB', async () => {
    const { config } = await import('../src/config.js');
    expect(config().UPLOAD_MAX_BYTES).toBe(2 * 1024 * 1024);
  });
});

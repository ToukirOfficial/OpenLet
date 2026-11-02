import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resetConfig } from '../src/config.js';
import { startApp, type TestContext } from './helpers.js';

describe('demo routes when DEMO_MODE is off', () => {
  let ctx: TestContext;
  beforeAll(async () => {
    ctx = await startApp();
  });
  afterAll(async () => ctx.app.close());

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

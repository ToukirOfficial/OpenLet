import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { certificateStatus, isRequired, worstStatus } from '@openlet/shared';
import { as, createProperty, startApp, workspaceWithTeam, type TestContext } from './helpers.js';

describe('certificate status (pure)', () => {
  const today = '2026-11-02';
  it('valid with more than 60 days left, expiring at 60 or fewer, expired after the date, missing when absent', () => {
    expect(certificateStatus('2027-01-02', true, today)).toBe('VALID'); // 61 days
    expect(certificateStatus('2027-01-01', true, today)).toBe('EXPIRING'); // 60 days
    expect(certificateStatus('2026-11-02', true, today)).toBe('EXPIRING'); // expires today
    expect(certificateStatus('2026-11-01', true, today)).toBe('EXPIRED');
    expect(certificateStatus(null, true, today)).toBe('VALID');
    expect(certificateStatus(null, false, today)).toBe('MISSING');
  });

  it('gas safety only with gas; licences only for HMOs', () => {
    const req = ['GAS_SAFETY', 'LICENCE', 'EPC'] as const;
    expect(isRequired('GAS_SAFETY', req, { type: 'HOUSE', hasGas: false })).toBe(false);
    expect(isRequired('GAS_SAFETY', req, { type: 'HOUSE', hasGas: true })).toBe(true);
    expect(isRequired('LICENCE', req, { type: 'FLAT', hasGas: true })).toBe(false);
    expect(isRequired('LICENCE', req, { type: 'HMO', hasGas: true })).toBe(true);
    expect(isRequired('INSURANCE', req, { type: 'HMO', hasGas: true })).toBe(false);
  });

  it('the worst status wins', () => {
    expect(worstStatus(['VALID', 'EXPIRING'])).toBe('EXPIRING');
    expect(worstStatus(['MISSING', 'EXPIRING'])).toBe('MISSING');
    expect(worstStatus(['MISSING', 'EXPIRED', 'VALID'])).toBe('EXPIRED');
  });
});

describe('compliance board', () => {
  let ctx: TestContext;
  beforeAll(async () => {
    ctx = await startApp();
  });
  afterAll(async () => ctx.app.close());

  it('uses the longest-running certificate and marks required ones missing', async () => {
    const { ws, staff } = await workspaceWithTeam(ctx.prisma);
    const p = await createProperty(ctx.prisma, ws.id);
    const c = await as(ctx, staff.id, ws.id);
    const pdf = Buffer.from('%PDF-1.4\n%%EOF');
    const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
    await c.upload('/documents').field('type', 'GAS_SAFETY').field('propertyId', p.id).field('expiresOn', day(-5)).attach('file', pdf, 'a.pdf');
    let board = (await c.get(`/compliance?propertyId=${p.id}`)).body;
    const gas = () => board.rows[0].cells.find((x: { type: string }) => x.type === 'GAS_SAFETY');
    expect(gas().status).toBe('EXPIRED');
    expect(board.rows[0].worst).toBe('EXPIRED');
    expect(board.rows[0].cells.find((x: { type: string }) => x.type === 'EICR').status).toBe('MISSING');
    expect(board.rows[0].cells.find((x: { type: string }) => x.type === 'LICENCE').status).toBe('NOT_NEEDED');

    await c.upload('/documents').field('type', 'GAS_SAFETY').field('propertyId', p.id).field('expiresOn', day(30)).attach('file', pdf, 'b.pdf');
    board = (await c.get(`/compliance?propertyId=${p.id}`)).body;
    expect(gas().status).toBe('EXPIRING');
    await c.upload('/documents').field('type', 'GAS_SAFETY').field('propertyId', p.id).field('expiresOn', day(360)).attach('file', pdf, 'c.pdf');
    board = (await c.get(`/compliance?propertyId=${p.id}`)).body;
    expect(gas().status).toBe('VALID');
  });
});

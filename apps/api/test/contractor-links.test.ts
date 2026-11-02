import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ContractorLinksService } from '../src/repairs/contractor-links.service.js';
import { startApp, workspaceWithTeam, type TestContext } from './helpers.js';

let ctx: TestContext;
let links: ContractorLinksService;
beforeAll(async () => {
  ctx = await startApp();
  links = ctx.app.get(ContractorLinksService);
});
afterAll(async () => ctx.app.close());

async function repair() {
  const { ws } = await workspaceWithTeam(ctx.prisma);
  const property = await ctx.prisma.property.create({
    data: { workspaceId: ws.id, addressLine1: '1 Test Street', town: 'Leeds', postcode: 'LS1 1AA', type: 'HOUSE', bedrooms: 2, bathrooms: 1, furnished: 'UNFURNISHED' },
  });
  const contractor = await ctx.prisma.contractor.create({ data: { workspaceId: ws.id, name: 'Pat Plumber', trade: 'Plumbing', email: 'pat@test.example' } });
  const r = await ctx.prisma.repair.create({
    data: { workspaceId: ws.id, propertyId: property.id, reference: 1, category: 'PLUMBING', title: 'Leak', description: 'Drip', priority: 'URGENT', targetAt: new Date() },
  });
  return { repair: r, contractor };
}

describe('contractor links', () => {
  it('stores only a hash and resolves to exactly one repair', async () => {
    const { repair: r, contractor } = await repair();
    const token = await links.issue(r.id, contractor.id);
    const row = await ctx.prisma.contractorLink.findFirstOrThrow({ where: { repairId: r.id } });
    expect(row.tokenHash).not.toContain(token);
    expect(row.tokenHash).toHaveLength(64);
    expect((await links.resolve(token)).repairId).toBe(r.id);
  });

  it('rejects unknown and revoked links; re-issuing revokes the old one', async () => {
    const { repair: r, contractor } = await repair();
    await expect(links.resolve('x'.repeat(43))).rejects.toThrow();
    const first = await links.issue(r.id, contractor.id);
    const second = await links.issue(r.id, contractor.id);
    await expect(links.resolve(first)).rejects.toThrow();
    expect((await links.resolve(second)).repairId).toBe(r.id);
    await links.revokeAll(r.id);
    await expect(links.resolve(second)).rejects.toThrow();
  });

  it('keeps working during the grace period after closing, then expires; re-opening restores it', async () => {
    const { repair: r, contractor } = await repair();
    const token = await links.issue(r.id, contractor.id);
    await links.expireForRepair(r.id, new Date());
    expect((await links.resolve(token)).repairId).toBe(r.id);
    await links.expireForRepair(r.id, new Date(Date.now() - 8 * 86_400_000));
    await expect(links.resolve(token)).rejects.toThrow();
    await links.reopen(r.id);
    expect((await links.resolve(token)).repairId).toBe(r.id);
  });
});

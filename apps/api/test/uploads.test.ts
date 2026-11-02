import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { as, createProperty, startApp, workspaceWithTeam, type TestContext } from './helpers.js';

let ctx: TestContext;
beforeAll(async () => {
  ctx = await startApp();
});
afterAll(async () => ctx.app.close());

/** A small JPEG carrying camera EXIF and GPS position. */
async function jpegWithGps() {
  return sharp({ create: { width: 40, height: 30, channels: 3, background: '#88aa44' } })
    .withExif({ IFD0: { Make: 'TestCam', Model: 'Phone' }, IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '53/1 43/1 0/1', GPSLongitudeRef: 'W', GPSLongitude: '1/1 51/1 0/1' } })
    .jpeg()
    .toBuffer();
}

describe('uploads', () => {
  it('stores photos privately, strips EXIF and GPS, and serves them only to the workspace', async () => {
    const { ws, staff } = await workspaceWithTeam(ctx.prisma);
    const p = await createProperty(ctx.prisma, ws.id);
    const input = await jpegWithGps();
    expect((await sharp(input).metadata()).exif).toBeTruthy();
    const c = await as(ctx, staff.id, ws.id);
    const res = await c.upload('/documents').field('type', 'PHOTO').field('propertyId', p.id).attach('file', input, 'IMG_0001-home-address.jpg');
    expect(res.status).toBe(201);
    expect(res.body.title).not.toContain('IMG_0001');
    const row = await ctx.prisma.document.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(row.storageKey).toMatch(/^files\/\d{4}\/\d{2}\/[0-9a-f-]{36}$/);

    const dl = await c.get(`/documents/${res.body.id}/download`).buffer(true).parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on('data', (d: Buffer) => chunks.push(d));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(dl.status).toBe(200);
    expect(dl.headers['content-disposition']).toContain('attachment');
    const meta = await sharp(dl.body as Buffer).metadata();
    expect(meta.exif).toBeUndefined();
    expect(await ctx.prisma.auditLog.count({ where: { workspaceId: ws.id, action: 'document.downloaded' } })).toBe(1);
    // The first photo becomes the cover.
    expect((await ctx.prisma.property.findUniqueOrThrow({ where: { id: p.id } })).coverDocId).toBe(res.body.id);

    const other = await workspaceWithTeam(ctx.prisma);
    expect((await (await as(ctx, other.owner.id, other.ws.id)).get(`/documents/${res.body.id}/download`)).status).toBe(404);
  });

  it('checks the type from the content, not the name', async () => {
    const { ws, staff } = await workspaceWithTeam(ctx.prisma);
    const p = await createProperty(ctx.prisma, ws.id);
    const c = await as(ctx, staff.id, ws.id);
    const fake = await c.upload('/documents').field('type', 'GAS_SAFETY').field('propertyId', p.id).attach('file', Buffer.from('<script>alert(1)</script>'), 'cert.pdf');
    expect(fake.status).toBe(400);
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
    const ok = await c.upload('/documents').field('type', 'GAS_SAFETY').field('propertyId', p.id).field('expiresOn', '2027-05-01').attach('file', pdf, 'whatever.png');
    expect(ok.status).toBe(201);
    expect(ok.body.mime).toBe('application/pdf');
    expect(ok.body.expiresOn).toBe('2027-05-01');
  });

  it('refuses to attach a document to another workspace’s record', async () => {
    const a = await workspaceWithTeam(ctx.prisma);
    const b = await workspaceWithTeam(ctx.prisma);
    const p = await createProperty(ctx.prisma, b.ws.id);
    const pdf = Buffer.from('%PDF-1.4\n%%EOF');
    const res = await (await as(ctx, a.staff.id, a.ws.id)).upload('/documents').field('type', 'EPC').field('propertyId', p.id).attach('file', pdf, 'a.pdf');
    expect(res.status).toBe(404);
  });
});

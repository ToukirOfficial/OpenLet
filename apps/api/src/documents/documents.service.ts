import { BadRequestException, Injectable, StreamableFile } from '@nestjs/common';
import type { z } from 'zod';
import { DOCUMENT_TYPE_LABELS, type DocumentItem, type documentListQuery, type documentUpdateSchema, type documentUploadSchema } from '@openlet/shared';
import { PrismaService } from '../prisma.service.js';
import { ActivityService } from '../common/activity.service.js';
import { actorOf, type Actor, type StaffContext } from '../common/auth-context.js';
import { fromDb, toDb } from '../common/dates.js';
import { notFound } from '../common/not-found.js';
import { StorageService } from '../files/storage.service.js';
import { QueueService } from '../jobs/queue.service.js';
import { RedisService } from '../redis.service.js';
import type { Document, Prisma } from '../generated/prisma/client.js';

type Owner = { propertyId?: string | null; tenancyId?: string | null; tenantId?: string | null; repairId?: string | null };

export function toItem(d: Document): DocumentItem {
  return {
    id: d.id,
    type: d.type,
    title: d.title,
    mime: d.mime,
    sizeBytes: d.sizeBytes,
    issuedOn: fromDb(d.issuedOn),
    expiresOn: fromDb(d.expiresOn),
    sharedWithTenant: d.sharedWithTenant,
    ready: d.ready,
    uploadedBy: d.uploadedByType,
    createdAt: d.createdAt.toISOString(),
    propertyId: d.propertyId,
    tenancyId: d.tenancyId,
    tenantId: d.tenantId,
    repairId: d.repairId,
  };
}

const EXT: Record<string, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/heic': 'heic' };

/** A safe download name built from our own fields, never the uploaded file name. */
export const downloadName = (d: Pick<Document, 'title' | 'mime'>) =>
  `${d.title.replace(/[^\w .-]+/g, '').trim().slice(0, 80) || 'document'}.${EXT[d.mime] ?? 'bin'}`;

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly activity: ActivityService,
    private readonly queue: QueueService,
    private readonly redis: RedisService,
  ) {}

  /** Checks every record a document is attached to belongs to this workspace. Exactly one owner is needed. */
  async assertOwner(workspaceId: string, o: Owner) {
    const set = [o.propertyId, o.tenancyId, o.tenantId, o.repairId].filter(Boolean);
    if (set.length !== 1) throw new BadRequestException({ message: 'Attach the document to one property, tenancy, tenant or repair.' });
    const checks: Promise<unknown>[] = [];
    if (o.propertyId) checks.push(this.prisma.property.findFirst({ where: { id: o.propertyId, workspaceId } }));
    if (o.tenancyId) checks.push(this.prisma.tenancy.findFirst({ where: { id: o.tenancyId, workspaceId } }));
    if (o.tenantId) checks.push(this.prisma.tenant.findFirst({ where: { id: o.tenantId, workspaceId } }));
    if (o.repairId) checks.push(this.prisma.repair.findFirst({ where: { id: o.repairId, workspaceId } }));
    const found = await Promise.all(checks);
    if (found.some((f) => !f)) throw notFound('Record');
  }

  /** Stores a file and its document row. Used by staff uploads, tenant repair photos and contractor photos. */
  async store(
    workspaceId: string,
    file: Express.Multer.File | undefined,
    meta: Owner & { type: Document['type']; title?: string | null; expiresOn?: string | null; issuedOn?: string | null; sharedWithTenant?: boolean },
    actor: Actor,
    opts: { imagesOnly?: boolean } = {},
  ) {
    const stored = await this.storage.saveUpload(file, opts);
    const repair = meta.repairId ? await this.prisma.repair.findUnique({ where: { id: meta.repairId }, select: { propertyId: true } }) : null;
    const doc = await this.prisma.document.create({
      data: {
        workspaceId,
        propertyId: meta.propertyId ?? null,
        tenancyId: meta.tenancyId ?? null,
        tenantId: meta.tenantId ?? null,
        repairId: meta.repairId ?? null,
        type: meta.type,
        title: meta.title || DOCUMENT_TYPE_LABELS[meta.type],
        storageKey: stored.key,
        mime: stored.needsConversion ? 'image/jpeg' : stored.mime,
        sizeBytes: stored.size,
        issuedOn: toDb(meta.issuedOn),
        expiresOn: toDb(meta.expiresOn),
        sharedWithTenant: meta.sharedWithTenant ?? false,
        uploadedByType: actor.type,
        uploadedById: actor.id,
        ready: !stored.needsConversion,
      },
    });
    if (stored.needsConversion) await this.queue.add('work', 'convert-heic', { documentId: doc.id });
    // The first photo of a property becomes its cover picture.
    if (doc.type === 'PHOTO' && doc.propertyId) {
      await this.prisma.property.updateMany({ where: { id: doc.propertyId, coverDocId: null }, data: { coverDocId: doc.id } });
    }
    await this.activity.record({
      workspaceId,
      actor,
      action: 'document.uploaded',
      summary: `Uploaded ${doc.title}`,
      propertyId: doc.propertyId ?? repair?.propertyId,
      tenancyId: doc.tenancyId,
      tenantId: doc.tenantId,
      repairId: doc.repairId,
    });
    await this.redis.invalidate(workspaceId);
    return doc;
  }

  async upload(ctx: StaffContext, file: Express.Multer.File | undefined, input: z.infer<typeof documentUploadSchema>) {
    await this.assertOwner(ctx.workspaceId, input);
    return toItem(await this.store(ctx.workspaceId, file, input, actorOf(ctx)));
  }

  async list(ctx: StaffContext, q: z.infer<typeof documentListQuery>) {
    const where: Prisma.DocumentWhereInput = { workspaceId: ctx.workspaceId };
    if (q.propertyId) where.propertyId = q.propertyId;
    if (q.tenancyId) where.tenancyId = q.tenancyId;
    if (q.tenantId) where.tenantId = q.tenantId;
    if (q.repairId) where.repairId = q.repairId;
    const rows = await this.prisma.document.findMany({ where, orderBy: { createdAt: 'desc' }, take: 300 });
    return rows.map(toItem);
  }

  private async load(ctx: StaffContext, id: string) {
    const d = await this.prisma.document.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
    if (!d) throw notFound('Document');
    return d;
  }

  async update(ctx: StaffContext, id: string, input: z.infer<typeof documentUpdateSchema>) {
    const d = await this.load(ctx, id);
    const updated = await this.prisma.document.update({
      where: { id },
      data: {
        ...(input.title ? { title: input.title } : {}),
        ...(input.type ? { type: input.type } : {}),
        ...('expiresOn' in input ? { expiresOn: toDb(input.expiresOn) } : {}),
        ...('issuedOn' in input ? { issuedOn: toDb(input.issuedOn) } : {}),
        ...(input.sharedWithTenant !== undefined ? { sharedWithTenant: input.sharedWithTenant } : {}),
      },
    });
    if (input.sharedWithTenant !== undefined && input.sharedWithTenant !== d.sharedWithTenant) {
      await this.activity.record({ workspaceId: ctx.workspaceId, actor: actorOf(ctx), action: input.sharedWithTenant ? 'document.shared' : 'document.unshared', summary: `${input.sharedWithTenant ? 'Shared' : 'Stopped sharing'} ${d.title} ${input.sharedWithTenant ? 'with' : 'with'} the tenant`, propertyId: d.propertyId, tenancyId: d.tenancyId, tenantId: d.tenantId });
    }
    await this.redis.invalidate(ctx.workspaceId);
    return toItem(updated);
  }

  async remove(ctx: StaffContext, id: string) {
    const d = await this.load(ctx, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.property.updateMany({ where: { coverDocId: d.id }, data: { coverDocId: null } });
      await tx.document.delete({ where: { id } });
    });
    await this.storage.remove(d.storageKey);
    await this.activity.audit({ workspaceId: ctx.workspaceId, userId: ctx.userId, action: 'document.deleted', targetType: 'document', targetId: id, ip: ctx.ip });
    await this.redis.invalidate(ctx.workspaceId);
    return { ok: true };
  }

  /** Streams a file after the caller's access was checked. Every download is audited. */
  async stream(d: Document, who: { workspaceId: string; userId: string | null; ip: string | null }, inline: boolean) {
    if (!d.ready) throw new BadRequestException({ code: 'NOT_READY', message: 'This photo is still being processed. Try again in a moment.' });
    const stream = await this.storage.stream(d.storageKey);
    await this.activity.audit({ workspaceId: who.workspaceId, userId: who.userId, action: 'document.downloaded', targetType: 'document', targetId: d.id, ip: who.ip });
    return new StreamableFile(stream, {
      type: d.mime,
      length: d.sizeBytes,
      disposition: `${inline ? 'inline' : 'attachment'}; filename="${downloadName(d)}"`,
    });
  }

  async download(ctx: StaffContext, id: string, inline: boolean) {
    return this.stream(await this.load(ctx, id), ctx, inline);
  }

  /** Worker: HEIC → JPEG, metadata stripped. */
  async convertHeic(documentId: string) {
    const d = await this.prisma.document.findUnique({ where: { id: documentId } });
    if (!d || d.ready) return;
    const { heicToJpeg } = await import('../files/heic.js');
    const jpeg = await heicToJpeg(await this.storage.read(d.storageKey));
    const size = await this.storage.replace(d.storageKey, jpeg);
    await this.prisma.document.update({ where: { id: d.id }, data: { mime: 'image/jpeg', sizeBytes: size, ready: true } });
  }
}

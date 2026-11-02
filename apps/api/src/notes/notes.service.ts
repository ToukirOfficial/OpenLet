import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import type { z } from 'zod';
import type { ActivityItem, NoteItem, activityQuery, noteSchema, notesQuery } from '@openlet/shared';
import { PrismaService } from '../prisma.service.js';
import type { StaffContext } from '../common/auth-context.js';
import { notFound } from '../common/not-found.js';
import { DocumentsService } from '../documents/documents.service.js';
import type { Prisma } from '../generated/prisma/client.js';

/** Internal notes (staff only, never shown to tenants) and the activity timeline. */
@Injectable()
export class NotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documents: DocumentsService,
  ) {}

  async list(ctx: StaffContext, q: z.infer<typeof notesQuery>): Promise<NoteItem[]> {
    if (!q.propertyId && !q.tenancyId && !q.tenantId) throw new BadRequestException({ message: 'Choose a record.' });
    const rows = await this.prisma.note.findMany({
      where: { workspaceId: ctx.workspaceId, propertyId: q.propertyId, tenancyId: q.tenancyId, tenantId: q.tenantId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map((n) => ({ id: n.id, body: n.body, authorName: n.authorName, createdAt: n.createdAt.toISOString(), mine: n.authorId === ctx.userId }));
  }

  async create(ctx: StaffContext, input: z.infer<typeof noteSchema>) {
    const { body, ...owner } = input;
    await this.documents.assertOwner(ctx.workspaceId, owner);
    const n = await this.prisma.note.create({ data: { workspaceId: ctx.workspaceId, ...owner, authorId: ctx.userId, authorName: ctx.name, body } });
    return { id: n.id, body: n.body, authorName: n.authorName, createdAt: n.createdAt.toISOString(), mine: true } satisfies NoteItem;
  }

  /** Authors delete their own notes; Owners and Managers can delete any. */
  async remove(ctx: StaffContext, id: string) {
    const n = await this.prisma.note.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
    if (!n) throw notFound('Note');
    if (n.authorId !== ctx.userId && ctx.role === 'STAFF') throw new ForbiddenException({ message: 'You can only delete your own notes.' });
    await this.prisma.note.delete({ where: { id } });
    return { ok: true };
  }

  async activity(ctx: StaffContext, q: z.infer<typeof activityQuery>): Promise<ActivityItem[]> {
    const where: Prisma.ActivityWhereInput = { workspaceId: ctx.workspaceId };
    if (q.propertyId) where.propertyId = q.propertyId;
    if (q.tenancyId) where.tenancyId = q.tenancyId;
    if (q.tenantId) where.tenantId = q.tenantId;
    if (q.repairId) where.repairId = q.repairId;
    const rows = await this.prisma.activity.findMany({ where, orderBy: { createdAt: 'desc' }, take: q.limit });
    return rows.map((a) => ({
      id: a.id,
      actorName: a.actorName,
      actorType: a.actorType,
      action: a.action,
      summary: a.summary,
      createdAt: a.createdAt.toISOString(),
      propertyId: a.propertyId,
      tenancyId: a.tenancyId,
      tenantId: a.tenantId,
      repairId: a.repairId,
    }));
  }
}

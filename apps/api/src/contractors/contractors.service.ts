import { Injectable } from '@nestjs/common';
import type { z } from 'zod';
import { OPEN_REPAIR_STATUSES, type ContractorItem, type contractorSchema } from '@openlet/shared';
import { PrismaService } from '../prisma.service.js';
import { ActivityService } from '../common/activity.service.js';
import { actorOf, type StaffContext } from '../common/auth-context.js';
import { notFound } from '../common/not-found.js';

@Injectable()
export class ContractorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  async list(ctx: StaffContext): Promise<ContractorItem[]> {
    const rows = await this.prisma.contractor.findMany({
      where: { workspaceId: ctx.workspaceId, archivedAt: null },
      orderBy: [{ trade: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { repairs: { where: { status: { in: [...OPEN_REPAIR_STATUSES] } } } } } },
    });
    return rows.map((c) => ({ id: c.id, name: c.name, company: c.company, trade: c.trade, email: c.email, phone: c.phone, notes: c.notes, openJobs: c._count.repairs }));
  }

  private async load(ctx: StaffContext, id: string) {
    const c = await this.prisma.contractor.findFirst({ where: { id, workspaceId: ctx.workspaceId, archivedAt: null } });
    if (!c) throw notFound('Contractor');
    return c;
  }

  async create(ctx: StaffContext, input: z.infer<typeof contractorSchema>) {
    const c = await this.prisma.contractor.create({ data: { ...input, workspaceId: ctx.workspaceId } });
    await this.activity.record({ workspaceId: ctx.workspaceId, actor: actorOf(ctx), action: 'contractor.created', summary: `Added contractor ${c.name}` });
    return { id: c.id };
  }

  async update(ctx: StaffContext, id: string, input: z.infer<typeof contractorSchema>) {
    await this.load(ctx, id);
    await this.prisma.contractor.update({ where: { id }, data: input });
    return { id };
  }

  /** Archived, not deleted: their past jobs still show who did the work. */
  async remove(ctx: StaffContext, id: string) {
    await this.load(ctx, id);
    await this.prisma.contractor.update({ where: { id }, data: { archivedAt: new Date() } });
    return { ok: true };
  }
}

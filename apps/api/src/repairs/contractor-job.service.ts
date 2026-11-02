import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { z } from 'zod';
import { OPEN_REPAIR_STATUSES, formatDateTime, formatPence, type ContractorJob, type contractorUpdateSchema } from '@openlet/shared';
import { PrismaService } from '../prisma.service.js';
import { ActivityService } from '../common/activity.service.js';
import { RateLimitService } from '../common/rate-limit.service.js';
import type { Actor } from '../common/auth-context.js';
import { readSettings } from '../common/settings.js';
import { DocumentsService } from '../documents/documents.service.js';
import { formatAddress } from '../properties/properties.service.js';
import { RedisService } from '../redis.service.js';
import { ContractorLinksService } from './contractor-links.service.js';
import { RepairsService } from './repairs.service.js';

/**
 * The contractor's job page. Every call starts from the link token, and every query is scoped to that
 * link's single repair: there is no way to reach another repair, a tenant record or the landlord's data.
 */
@Injectable()
export class ContractorJobService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly links: ContractorLinksService,
    private readonly repairs: RepairsService,
    private readonly documents: DocumentsService,
    private readonly activity: ActivityService,
    private readonly limits: RateLimitService,
    private readonly redis: RedisService,
  ) {}

  private async open(token: string, ip: string | null) {
    await this.limits.hit(`job:${ip}`, 120, 900);
    const link = await this.links.resolve(token);
    const repair = await this.prisma.repair.findUniqueOrThrow({
      where: { id: link.repairId },
      include: {
        property: true,
        unit: true,
        contractor: true,
        workspace: true,
        tenancy: { include: { tenants: { include: { tenant: true } } } },
        // Status changes and the contractor's own notes only: comments between landlord and tenant stay private.
        events: { where: { OR: [{ type: { in: ['CREATED', 'STATUS', 'VISIT'] } }, { actorType: 'CONTRACTOR', visibility: 'TENANT' }] }, orderBy: { createdAt: 'asc' } },
        documents: { where: { type: 'PHOTO' }, orderBy: { createdAt: 'asc' } },
      },
    });
    // The link was issued to one contractor; if the repair was re-assigned, it no longer applies.
    if (repair.contractorId !== link.contractorId) throw new NotFoundException({ code: 'LINK_INVALID', message: 'This job has been passed to someone else.' });
    const actor: Actor = { type: 'CONTRACTOR', id: null, name: repair.contractor?.name ?? 'Contractor' };
    return { link, repair, actor };
  }

  async view(token: string, ip: string | null): Promise<ContractorJob> {
    const { repair: r } = await this.open(token, ip);
    const settings = readSettings(r.workspace.settings);
    const tenants = r.tenancy?.tenants.map((x) => x.tenant).filter((t) => !t.anonymisedAt) ?? [];
    return {
      reference: r.reference,
      workspaceName: r.workspace.name,
      workspaceContact: [r.workspace.contactPhone, r.workspace.contactEmail].filter(Boolean).join(' · ') || null,
      title: r.title,
      category: r.category,
      priority: r.priority,
      status: r.status,
      description: r.description,
      accessNotes: r.accessNotes,
      availability: r.availability,
      address: formatAddress(r.property),
      unitName: r.unit && r.unit.name !== 'Whole property' ? r.unit.name : null,
      tenant:
        settings.contractorSeesTenantContact && tenants.length
          ? { names: tenants.map((t) => `${t.firstName} ${t.lastName}`).join(' and '), phone: tenants.find((t) => t.phone)?.phone ?? null }
          : null,
      visitAt: r.visitAt?.toISOString() ?? null,
      costPence: r.costPence,
      canUpdate: r.status !== 'CANCELLED' && r.status !== 'CLOSED',
      updates: r.events.map((e) => ({ body: e.type === 'STATUS' && e.actorType !== 'CONTRACTOR' ? null : e.body, toStatus: e.toStatus, type: e.type, createdAt: e.createdAt.toISOString() })),
      photos: r.documents.map((d) => ({ id: d.id, ready: d.ready })),
    };
  }

  async update(token: string, ip: string | null, input: z.infer<typeof contractorUpdateSchema>) {
    const { repair: r, actor } = await this.open(token, ip);
    if (r.status === 'CLOSED' || r.status === 'CANCELLED') throw new BadRequestException({ message: 'This job is closed. Contact the landlord or agent if something needs changing.' });
    const events: { type: 'VISIT' | 'COST' | 'COMMENT'; body: string }[] = [];
    const data: { visitAt?: Date | null; costPence?: number | null } = {};
    if (input.visitAt !== undefined) {
      data.visitAt = input.visitAt ? new Date(input.visitAt) : null;
      events.push({ type: 'VISIT', body: data.visitAt ? `Visit booked for ${formatDateTime(data.visitAt)}.` : 'Visit date removed.' });
    }
    if (input.costPence !== undefined) {
      data.costPence = input.costPence;
      events.push({ type: 'COST', body: input.costPence === null ? 'Cost removed.' : `Cost: ${formatPence(input.costPence)}.` });
    }
    if (input.note) events.push({ type: 'COMMENT', body: input.note });
    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(data).length) await tx.repair.update({ where: { id: r.id }, data });
      for (const e of events) {
        // Costs are for the landlord only; visits and notes are shared with the tenant.
        await tx.repairEvent.create({ data: { repairId: r.id, type: e.type, visibility: e.type === 'COST' ? 'INTERNAL' : 'TENANT', actorType: 'CONTRACTOR', actorName: actor.name, body: e.body } });
      }
    });
    if (input.status && input.status !== r.status) {
      if (!OPEN_REPAIR_STATUSES.includes(r.status)) throw new BadRequestException({ message: 'This job is already marked as completed.' });
      await this.repairs.changeStatus(r.workspaceId, r.id, input.status, actor, null);
    } else if (data.visitAt) {
      await this.repairs.notifyTenants(r, 'A visit is booked for your repair', [`Repair #${r.reference}: ${r.title}`, `The contractor will visit on ${formatDateTime(data.visitAt)}.`]);
    }
    if (events.length) {
      await this.activity.record({ workspaceId: r.workspaceId, actor, action: 'repair.contractor.update', summary: `Updated repair #${r.reference}: ${events.map((e) => e.body).join(' ')}`, propertyId: r.propertyId, tenancyId: r.tenancyId, repairId: r.id });
    }
    await this.redis.invalidate(r.workspaceId);
    return this.view(token, ip);
  }

  async addPhoto(token: string, ip: string | null, file: Express.Multer.File | undefined) {
    const { repair: r, actor } = await this.open(token, ip);
    if (r.status === 'CANCELLED') throw new BadRequestException({ message: 'This job was cancelled.' });
    await this.limits.hit(`job:photos:${r.id}`, 30, 3600);
    await this.documents.store(r.workspaceId, file, { repairId: r.id, type: 'PHOTO', title: `Photo for repair #${r.reference}`, sharedWithTenant: true }, actor, { imagesOnly: true });
    await this.prisma.repairEvent.create({ data: { repairId: r.id, type: 'PHOTO', visibility: 'TENANT', actorType: 'CONTRACTOR', actorName: actor.name, body: 'Added a photo.' } });
    return this.view(token, ip);
  }

  async photo(token: string, ip: string | null, documentId: string) {
    const { repair: r } = await this.open(token, ip);
    const d = await this.prisma.document.findFirst({ where: { id: documentId, repairId: r.id, type: 'PHOTO' } });
    if (!d) throw new NotFoundException({ message: 'Photo not found.' });
    return this.documents.stream(d, { workspaceId: r.workspaceId, userId: null, ip }, true);
  }
}

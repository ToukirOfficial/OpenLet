import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import type { z } from 'zod';
import { OPEN_REPAIR_STATUSES, londonDate, propertyStatus, tenancyStatus, type PropertyDetail, type PropertyListItem, type propertyListQuery, type propertySchema, type propertyUpdateSchema } from '@openlet/shared';
import { PrismaService } from '../prisma.service.js';
import { ActivityService } from '../common/activity.service.js';
import { actorOf, type StaffContext } from '../common/auth-context.js';
import { tenancyDates, fromDb } from '../common/dates.js';
import { notFound } from '../common/not-found.js';
import { RedisService } from '../redis.service.js';
import { StorageService } from '../files/storage.service.js';
import type { Prisma } from '../generated/prisma/client.js';

const PAGE = 50;

export const formatAddress = (p: { addressLine1: string; addressLine2?: string | null; town: string; postcode: string }) =>
  [p.addressLine1, p.addressLine2, p.town, p.postcode].filter(Boolean).join(', ');

const unitInclude = {
  units: {
    orderBy: { createdAt: 'asc' },
    include: {
      tenancies: {
        where: { archivedAt: null },
        orderBy: { startDate: 'desc' },
        include: {
          tenants: { include: { tenant: { select: { firstName: true, lastName: true } } } },
          rentChanges: { orderBy: { effectiveFrom: 'desc' }, take: 1 },
        },
      },
    },
  },
  _count: { select: { repairs: { where: { status: { in: [...OPEN_REPAIR_STATUSES] } } } } },
} satisfies Prisma.PropertyInclude;

type Loaded = Prisma.PropertyGetPayload<{ include: typeof unitInclude }>;

@Injectable()
export class PropertiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly redis: RedisService,
    private readonly storage: StorageService,
  ) {}

  private summarise(p: Loaded, today = londonDate()): PropertyListItem & { units: PropertyDetail['units'] } {
    const units = p.units.map((u) => {
      const dated = u.tenancies.map((t) => ({ t, d: tenancyDates(t), s: tenancyStatus(tenancyDates(t), today) }));
      const current = dated.find((x) => x.s === 'ACTIVE' || x.s === 'ENDING') ?? dated.find((x) => x.s === 'UPCOMING');
      return {
        id: u.id,
        name: u.name,
        dates: dated.map((x) => x.d),
        tenancy: current
          ? {
              id: current.t.id,
              status: current.s,
              tenantNames: current.t.tenants.map((x) => `${x.tenant.firstName} ${x.tenant.lastName}`).join(' and '),
              rentPence: current.t.rentChanges[0]?.amountPence ?? 0,
              frequency: current.t.frequency,
              endDate: fromDb(current.t.noticeEndDate ?? current.t.endDate),
            }
          : null,
      };
    });
    const status = propertyStatus(units.map((u) => ({ tenancies: u.dates })), today);
    return {
      id: p.id,
      address: formatAddress(p),
      addressLine1: p.addressLine1,
      town: p.town,
      postcode: p.postcode,
      type: p.type,
      bedrooms: p.bedrooms,
      status,
      unitCount: units.length,
      letUnits: units.filter((u) => u.tenancy && u.tenancy.status !== 'UPCOMING').length,
      openRepairs: p._count.repairs,
      hasCover: !!p.coverDocId,
      units: units.map(({ dates: _d, ...u }) => u),
    };
  }

  async list(ctx: StaffContext, q: z.infer<typeof propertyListQuery>) {
    const where: Prisma.PropertyWhereInput = { workspaceId: ctx.workspaceId, archivedAt: null };
    if (q.q) {
      const term = q.q.trim();
      const compact = term.replace(/\s+/g, '').toUpperCase();
      where.OR = [
        { addressLine1: { contains: term, mode: 'insensitive' } },
        { addressLine2: { contains: term, mode: 'insensitive' } },
        { town: { contains: term, mode: 'insensitive' } },
        { postcode: { contains: term, mode: 'insensitive' } },
        ...(compact.length >= 2 ? [{ postcode: { startsWith: compact.length > 3 ? `${compact.slice(0, -3)} ${compact.slice(-3)}` : compact } }] : []),
      ];
    }
    // Status is calculated from tenancy dates, so filter after loading (portfolios are small: 1–50 properties).
    const rows = await this.prisma.property.findMany({ where, include: unitInclude, orderBy: [{ town: 'asc' }, { addressLine1: 'asc' }] });
    const today = londonDate();
    const all = rows.map((p) => this.summarise(p, today)).filter((p) => !q.status || p.status === q.status);
    const start = (q.page - 1) * PAGE;
    return { items: all.slice(start, start + PAGE).map(({ units: _u, ...p }) => p), hasMore: all.length > start + PAGE, total: all.length };
  }

  private async load(ctx: StaffContext, id: string) {
    const p = await this.prisma.property.findFirst({ where: { id, workspaceId: ctx.workspaceId }, include: unitInclude });
    if (!p) throw notFound('Property');
    return p;
  }

  async get(ctx: StaffContext, id: string): Promise<PropertyDetail> {
    const p = await this.load(ctx, id);
    return {
      ...this.summarise(p),
      addressLine2: p.addressLine2,
      county: p.county,
      bathrooms: p.bathrooms,
      furnished: p.furnished,
      hasGas: p.hasGas,
      notes: p.notes,
      coverDocId: p.coverDocId,
      archived: !!p.archivedAt,
    };
  }

  async create(ctx: StaffContext, input: z.infer<typeof propertySchema>) {
    const { units, ...data } = input;
    const names = units?.length ? units : ['Whole property'];
    const p = await this.prisma.$transaction(async (tx) => {
      const created = await tx.property.create({ data: { ...data, workspaceId: ctx.workspaceId, units: { create: names.map((name) => ({ name })) } } });
      await this.activity.record({ workspaceId: ctx.workspaceId, actor: actorOf(ctx), action: 'property.created', summary: `Added ${created.addressLine1}`, propertyId: created.id }, tx);
      return created;
    });
    await this.redis.invalidate(ctx.workspaceId);
    return this.get(ctx, p.id);
  }

  async update(ctx: StaffContext, id: string, input: z.infer<typeof propertyUpdateSchema>) {
    await this.load(ctx, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.property.update({ where: { id }, data: input });
      await this.activity.record({ workspaceId: ctx.workspaceId, actor: actorOf(ctx), action: 'property.updated', summary: 'Updated the property details', propertyId: id }, tx);
    });
    return this.get(ctx, id);
  }

  /** Properties with tenancy or money history are archived, never deleted. */
  async remove(ctx: StaffContext, id: string) {
    const p = await this.load(ctx, id);
    const history = await this.prisma.tenancy.count({ where: { unit: { propertyId: p.id } } });
    if (history) {
      await this.prisma.property.update({ where: { id }, data: { archivedAt: new Date() } });
      await this.activity.record({ workspaceId: ctx.workspaceId, actor: actorOf(ctx), action: 'property.archived', summary: `Archived ${p.addressLine1}`, propertyId: id });
      await this.activity.audit({ workspaceId: ctx.workspaceId, userId: ctx.userId, action: 'property.archived', targetType: 'property', targetId: id, ip: ctx.ip });
      return { archived: true };
    }
    const docs = await this.prisma.document.findMany({ where: { propertyId: id }, select: { storageKey: true } });
    await this.prisma.property.delete({ where: { id } });
    await this.activity.audit({ workspaceId: ctx.workspaceId, userId: ctx.userId, action: 'property.deleted', targetType: 'property', targetId: id, ip: ctx.ip });
    await Promise.all(docs.map((d) => this.storage.remove(d.storageKey)));
    await this.redis.invalidate(ctx.workspaceId);
    return { archived: false };
  }

  async restore(ctx: StaffContext, id: string) {
    await this.load(ctx, id);
    await this.prisma.property.update({ where: { id }, data: { archivedAt: null } });
    return this.get(ctx, id);
  }

  // ---------- Units ----------

  async addUnit(ctx: StaffContext, propertyId: string, name: string) {
    await this.load(ctx, propertyId);
    const unit = await this.prisma.unit.create({ data: { propertyId, name } });
    await this.activity.record({ workspaceId: ctx.workspaceId, actor: actorOf(ctx), action: 'unit.created', summary: `Added unit ${name}`, propertyId });
    return { id: unit.id, name: unit.name };
  }

  private async unit(ctx: StaffContext, propertyId: string, unitId: string) {
    const unit = await this.prisma.unit.findFirst({ where: { id: unitId, propertyId, property: { workspaceId: ctx.workspaceId } } });
    if (!unit) throw notFound('Unit');
    return unit;
  }

  async renameUnit(ctx: StaffContext, propertyId: string, unitId: string, name: string) {
    await this.unit(ctx, propertyId, unitId);
    const unit = await this.prisma.unit.update({ where: { id: unitId }, data: { name } });
    return { id: unit.id, name: unit.name };
  }

  async removeUnit(ctx: StaffContext, propertyId: string, unitId: string) {
    await this.unit(ctx, propertyId, unitId);
    if (await this.prisma.tenancy.count({ where: { unitId } })) {
      throw new ConflictException({ message: 'This unit has tenancies, so it can’t be removed.' });
    }
    if ((await this.prisma.unit.count({ where: { propertyId } })) <= 1) {
      throw new BadRequestException({ message: 'A property needs at least one unit.' });
    }
    await this.prisma.unit.delete({ where: { id: unitId } });
    return { ok: true };
  }
}

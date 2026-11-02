import { ConflictException, Injectable } from '@nestjs/common';
import type { z } from 'zod';
import { londonDate, tenancyStatus, type TenantDetail, type TenantListItem, type rightToRentSchema, type tenantListQuery, type tenantSchema } from '@openlet/shared';
import { PrismaService } from '../prisma.service.js';
import { ActivityService } from '../common/activity.service.js';
import { actorOf, type StaffContext } from '../common/auth-context.js';
import { fromDb, fromDbReq, tenancyDates, toDb } from '../common/dates.js';
import { notFound } from '../common/not-found.js';
import { formatAddress } from '../properties/properties.service.js';
import { StorageService } from '../files/storage.service.js';
import type { Prisma } from '../generated/prisma/client.js';

const PAGE = 50;

const include = {
  rightToRent: { orderBy: { checkedOn: 'desc' } },
  invites: { where: { acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date(0) } }, select: { expiresAt: true } },
  tenancies: {
    include: {
      tenancy: {
        include: { unit: { include: { property: { select: { addressLine1: true, addressLine2: true, town: true, postcode: true } } } } },
      },
    },
  },
} satisfies Prisma.TenantInclude;
type Loaded = Prisma.TenantGetPayload<{ include: typeof include }>;

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly storage: StorageService,
  ) {}

  private item(t: Loaded, today = londonDate()): TenantListItem & { tenancies: TenantDetail['tenancies'] } {
    const tenancies = t.tenancies
      .map(({ tenancy }) => {
        const unitLabel = tenancy.unit.name === 'Whole property' ? '' : `${tenancy.unit.name}, `;
        return {
          id: tenancy.id,
          address: unitLabel + formatAddress(tenancy.unit.property),
          startDate: fromDbReq(tenancy.startDate),
          endDate: fromDb(tenancy.noticeEndDate ?? tenancy.endDate),
          status: tenancyStatus(tenancyDates(tenancy), today),
        };
      })
      .sort((a, b) => (a.startDate < b.startDate ? 1 : -1));
    const current = tenancies.find((x) => x.status === 'ACTIVE' || x.status === 'ENDING') ?? tenancies.find((x) => x.status === 'UPCOMING');
    const now = new Date();
    return {
      id: t.id,
      name: `${t.firstName} ${t.lastName}`,
      email: t.email,
      phone: t.phone,
      currentAddress: current?.address ?? null,
      portal: t.userId ? 'ACTIVE' : t.invites.some((i) => i.expiresAt > now) ? 'INVITED' : 'NONE',
      rightToRentDue: fromDb(t.rightToRent[0]?.expiresOn),
      anonymised: !!t.anonymisedAt,
      tenancies,
    };
  }

  async list(ctx: StaffContext, q: z.infer<typeof tenantListQuery>) {
    const where: Prisma.TenantWhereInput = { workspaceId: ctx.workspaceId, anonymisedAt: null };
    if (q.q) {
      const words = q.q.trim().split(/\s+/).slice(0, 4);
      where.AND = words.map((w) => ({
        OR: [
          { firstName: { contains: w, mode: 'insensitive' } },
          { lastName: { contains: w, mode: 'insensitive' } },
          { email: { contains: w, mode: 'insensitive' } },
          { phone: { contains: w } },
        ],
      }));
    }
    const [rows, total] = await Promise.all([
      this.prisma.tenant.findMany({ where, include, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }], skip: (q.page - 1) * PAGE, take: PAGE + 1 }),
      this.prisma.tenant.count({ where }),
    ]);
    const today = londonDate();
    return { items: rows.slice(0, PAGE).map((t) => { const { tenancies: _t, ...rest } = this.item(t, today); return rest; }), hasMore: rows.length > PAGE, total };
  }

  async load(ctx: StaffContext, id: string) {
    const t = await this.prisma.tenant.findFirst({ where: { id, workspaceId: ctx.workspaceId }, include });
    if (!t) throw notFound('Tenant');
    return t;
  }

  async get(ctx: StaffContext, id: string): Promise<TenantDetail> {
    const t = await this.load(ctx, id);
    return {
      ...this.item(t),
      firstName: t.firstName,
      lastName: t.lastName,
      dateOfBirth: fromDb(t.dateOfBirth),
      emergencyName: t.emergencyName,
      emergencyPhone: t.emergencyPhone,
      notes: t.notes,
      rightToRent: t.rightToRent.map((r) => ({ id: r.id, checkedOn: fromDbReq(r.checkedOn), method: r.method, expiresOn: fromDb(r.expiresOn), notes: r.notes })),
    };
  }

  async create(ctx: StaffContext, input: z.infer<typeof tenantSchema>) {
    const t = await this.prisma.$transaction(async (tx) => {
      const created = await tx.tenant.create({ data: { ...input, dateOfBirth: toDb(input.dateOfBirth), workspaceId: ctx.workspaceId } });
      await this.activity.record({ workspaceId: ctx.workspaceId, actor: actorOf(ctx), action: 'tenant.created', summary: `Added tenant ${created.firstName} ${created.lastName}`, tenantId: created.id }, tx);
      return created;
    });
    return this.get(ctx, t.id);
  }

  async update(ctx: StaffContext, id: string, input: z.infer<typeof tenantSchema>) {
    const t = await this.load(ctx, id);
    if (t.anonymisedAt) throw new ConflictException({ message: 'This tenant’s details were anonymised and can’t be edited.' });
    await this.prisma.$transaction(async (tx) => {
      await tx.tenant.update({ where: { id }, data: { ...input, dateOfBirth: toDb(input.dateOfBirth) } });
      await this.activity.record({ workspaceId: ctx.workspaceId, actor: actorOf(ctx), action: 'tenant.updated', summary: 'Updated the tenant’s details', tenantId: id }, tx);
    });
    return this.get(ctx, id);
  }

  /** Only a tenant with no tenancies can be deleted; otherwise their record stays until retention anonymises it. */
  async remove(ctx: StaffContext, id: string) {
    const t = await this.load(ctx, id);
    if (t.tenancies.length) throw new ConflictException({ code: 'HAS_TENANCIES', message: 'This tenant has tenancies, so their record is kept. It will be anonymised after the retention period.' });
    const docs = await this.prisma.document.findMany({ where: { tenantId: id }, select: { storageKey: true } });
    await this.prisma.tenant.delete({ where: { id } });
    await Promise.all(docs.map((d) => this.storage.remove(d.storageKey)));
    await this.activity.audit({ workspaceId: ctx.workspaceId, userId: ctx.userId, action: 'tenant.deleted', targetType: 'tenant', targetId: id, ip: ctx.ip });
    return { ok: true };
  }

  async addRightToRent(ctx: StaffContext, tenantId: string, input: z.infer<typeof rightToRentSchema>) {
    await this.load(ctx, tenantId);
    await this.prisma.$transaction(async (tx) => {
      await tx.rightToRentCheck.create({ data: { tenantId, checkedOn: toDb(input.checkedOn)!, method: input.method, expiresOn: toDb(input.expiresOn), notes: input.notes } });
      await this.activity.record({ workspaceId: ctx.workspaceId, actor: actorOf(ctx), action: 'rtr.recorded', summary: 'Recorded a Right to Rent check', tenantId }, tx);
    });
    return this.get(ctx, tenantId);
  }

  async removeRightToRent(ctx: StaffContext, tenantId: string, checkId: string) {
    await this.load(ctx, tenantId);
    const res = await this.prisma.rightToRentCheck.deleteMany({ where: { id: checkId, tenantId } });
    if (!res.count) throw notFound('Check');
    return this.get(ctx, tenantId);
  }
}

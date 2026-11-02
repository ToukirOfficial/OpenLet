import type { Prisma, PrismaClient } from '../generated/prisma/client.js';
import { addDays, addMonthsClamped, londonDate, parseIsoDate, type IsoDate } from '@openlet/shared';
import { DEFAULT_SETTINGS } from '../common/settings.js';
import { toDb } from '../common/dates.js';
import { rentPeriods } from '../ledger/schedule.js';
import { CHARGE_AHEAD_DAYS } from '../ledger/ledger.service.js';
import { CONTRACTORS, PROPERTIES, TENANCIES, TENANTS } from './data.js';

const monthsFromToday = (today: IsoDate, n: number, day: number) => {
  const { y, m } = parseIsoDate(today);
  return addMonthsClamped(y, m, n, day);
};

type U = { id: string; email: string; name: string };

/** The fake West Yorkshire portfolio. */
export async function seedPortfolio(prisma: PrismaClient, users: Record<'owner' | 'manager' | 'staff' | 'tenant', U>) {
  const ws = await prisma.workspace.create({
    data: {
      name: 'Calder Valley Lettings',
      contactEmail: 'hello@calder-valley.example',
      contactPhone: '01422 000 000',
      address: '1 Example Yard, Hebden Bridge',
      settings: DEFAULT_SETTINGS as unknown as Prisma.InputJsonValue,
      memberships: {
        create: [
          { userId: users.owner.id, role: 'OWNER' },
          { userId: users.manager.id, role: 'MANAGER' },
          { userId: users.staff.id, role: 'STAFF' },
        ],
      },
    },
  });
  const workspaceId = ws.id;

  const properties: Record<string, { id: string; units: { id: string; name: string }[] }> = {};
  for (const { key, units, ...p } of PROPERTIES) {
    properties[key] = await prisma.property.create({
      data: { ...p, workspaceId, units: { create: units.map((name) => ({ name })) } },
      include: { units: { orderBy: { createdAt: 'asc' } } },
    });
  }

  const tenants: Record<string, { id: string }> = {};
  for (const { key, ...t } of TENANTS) {
    const isPortalUser = key === 'tom';
    tenants[key] = await prisma.tenant.create({
      data: {
        ...t,
        workspaceId,
        email: isPortalUser ? users.tenant.email : `${t.firstName.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '')}.${t.lastName.toLowerCase()}@tenant.example`,
        userId: isPortalUser ? users.tenant.id : null,
      },
    });
  }

  const contractors: Record<string, { id: string }> = {};
  for (const { key, ...c } of CONTRACTORS) {
    contractors[key] = await prisma.contractor.create({ data: { ...c, workspaceId, email: `${key}@trades.example` } });
  }

  const today = londonDate();
  const tenancies: Record<string, string> = {};
  for (const [i, def] of TENANCIES.entries()) {
    const unit = properties[def.property]!.units[def.unit]!;
    const startDate = monthsFromToday(today, def.startMonths, def.day);
    const endDate = def.endMonths === null ? null : addDays(monthsFromToday(today, def.endMonths, def.day), -1);
    const noticeEnd = 'noticeDays' in def ? addDays(today, def.noticeDays) : null;
    const rentChanges: { amountPence: number; effectiveFrom: IsoDate }[] = [{ amountPence: def.rent, effectiveFrom: startDate }];
    if ('rentRise' in def) rentChanges.push({ amountPence: def.rentRise.rent, effectiveFrom: monthsFromToday(today, def.rentRise.months, def.day) });
    const ended = 'ended' in def;
    const t = await prisma.tenancy.create({
      data: {
        workspaceId,
        unitId: unit.id,
        startDate: toDb(startDate)!,
        endDate: toDb(endDate),
        frequency: def.frequency,
        dueDay: def.day,
        endedOn: ended ? toDb(endDate) : null,
        noticeBy: noticeEnd ? 'TENANT' : null,
        noticeGivenOn: noticeEnd ? toDb(addDays(today, -3)) : null,
        noticeEndDate: toDb(noticeEnd),
        tenants: { create: def.tenants.map((k) => ({ tenantId: tenants[k]!.id })) },
        rentChanges: { create: rentChanges.map((r) => ({ amountPence: r.amountPence, effectiveFrom: toDb(r.effectiveFrom)! })) },
        deposit: {
          create: {
            amountPence: def.deposit.amount,
            receivedOn: 'notReceived' in def.deposit ? null : toDb(addDays(startDate, -7)),
            scheme: def.deposit.protected ? (['DPS', 'TDS', 'MYDEPOSITS'] as const)[i % 3] : null,
            schemeReference: def.deposit.protected ? `DEMO-${1000 + i}` : null,
            protectedOn: def.deposit.protected ? toDb(addDays(startDate, 10)) : null,
            prescribedInfoOn: def.deposit.protected ? toDb(addDays(startDate, 12)) : null,
            ...('returned' in def.deposit ? { returnedOn: toDb(addDays(endDate!, 14)), returnedPence: def.deposit.amount - 9500, deductions: { create: [{ reason: 'Professional clean', amountPence: 9500 }] } } : {}),
          },
        },
      },
    });
    tenancies[`${def.property}:${def.unit}:${def.tenants[0]}`] = t.id;

    // Rent charges exactly as the daily job would make them, then a payment history.
    const last = ended ? endDate : (noticeEnd ?? endDate);
    const periods = rentPeriods({ startDate, endDate: last, frequency: def.frequency, dueDay: def.day, rentChanges }, addDays(today, CHARGE_AHEAD_DAYS));
    if (periods.length) {
      await prisma.ledgerEntry.createMany({
        data: periods.map((p) => ({ workspaceId, tenancyId: t.id, type: 'RENT_CHARGE' as const, amountPence: p.amountPence, date: toDb(p.dueDate)!, periodStart: toDb(p.periodStart), periodEnd: toDb(p.periodEnd), description: 'Rent' })),
      });
      await prisma.tenancy.update({ where: { id: t.id }, data: { chargedThrough: toDb(periods.at(-1)!.periodStart) } });
    }
    const due = periods.filter((p) => p.dueDate <= today);
    const payments: { date: IsoDate; amountPence: number }[] = [];
    due.forEach((p, n) => {
      const recent = n >= due.length - 3;
      if (def.pays === 'ON_TIME') payments.push({ date: p.dueDate, amountPence: p.amountPence });
      else if (def.pays === 'LATE') {
        const paid = addDays(p.dueDate, 9);
        if (paid <= today) payments.push({ date: paid, amountPence: p.amountPence });
      } else if (def.pays === 'PART') payments.push({ date: addDays(p.dueDate, 1), amountPence: Math.round(p.amountPence * 0.85) });
      else if (def.pays === 'ARREARS') {
        if (!recent) payments.push({ date: addDays(p.dueDate, 2), amountPence: p.amountPence });
        else if (n === due.length - 3) payments.push({ date: addDays(p.dueDate, 5), amountPence: 30000 });
      }
    });
    if (payments.length) {
      await prisma.ledgerEntry.createMany({
        data: payments.map((p, n) => ({ workspaceId, tenancyId: t.id, type: 'PAYMENT' as const, amountPence: p.amountPence, date: toDb(p.date)!, method: def.pays === 'LATE' ? ('BANK_TRANSFER' as const) : ('STANDING_ORDER' as const), reference: `${def.tenants[0]!.toUpperCase()}-${n + 1}`, description: 'Rent payment' })),
      });
    }
  }

  return { workspaceId, workspaceName: ws.name, contractorUrl: null as string | null, properties, tenants, contractors, tenancies, today };
}

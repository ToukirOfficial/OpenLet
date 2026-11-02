import type { Prisma, PrismaClient } from '../generated/prisma/client.js';
import { DEFAULT_SETTINGS } from '../common/settings.js';
import { CONTRACTORS, PROPERTIES, TENANTS } from './data.js';

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

  return { workspaceId, workspaceName: ws.name, contractorUrl: null as string | null, properties, tenants, contractors };
}

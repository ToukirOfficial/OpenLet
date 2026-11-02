import type { Prisma, PrismaClient } from '../generated/prisma/client.js';
import { DEFAULT_SETTINGS } from '../common/settings.js';

type U = { id: string; email: string; name: string };

/** The fake West Yorkshire portfolio. Grows phase by phase (plan.md). */
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
  await prisma.tenant.create({
    data: { workspaceId: ws.id, userId: users.tenant.id, firstName: 'Tom', lastName: 'Ashworth', email: users.tenant.email, phone: '07700 900123' },
  });
  return { workspaceId: ws.id, workspaceName: ws.name, contractorUrl: null as string | null };
}

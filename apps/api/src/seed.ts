/**
 * Local and demo seed: fake data only (no real people or addresses). Safe to run again: it wipes the
 * seeded workspace and recreates it. Logins are listed in ASSUMPTIONS.md.
 */
import 'reflect-metadata';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import { hashPassword } from './auth/passwords.js';
import { config } from './config.js';
import { seedPortfolio } from './demo/portfolio.js';

export const SEED_PASSWORD = 'openlet-demo-2026';
export const SEED_USERS = {
  owner: { email: 'owner@demo.openlet.test', name: 'Olivia Hartley' },
  manager: { email: 'manager@demo.openlet.test', name: 'Marcus Webb' },
  staff: { email: 'staff@demo.openlet.test', name: 'Sana Iqbal' },
  tenant: { email: 'tenant@demo.openlet.test', name: 'Tom Ashworth' },
} as const;

export async function seed(prisma: PrismaClient) {
  const passwordHash = await hashPassword(SEED_PASSWORD);
  const emails = Object.values(SEED_USERS).map((u) => u.email);
  const existing = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
  const old = await prisma.membership.findMany({ where: { userId: { in: existing.map((u) => u.id) } }, select: { workspaceId: true } });
  await prisma.workspace.deleteMany({ where: { id: { in: old.map((m) => m.workspaceId) } } });
  await prisma.user.deleteMany({ where: { email: { in: emails } } });

  const users = Object.fromEntries(
    await Promise.all(
      Object.entries(SEED_USERS).map(async ([k, u]) => [k, await prisma.user.create({ data: { ...u, passwordHash, isDemo: true } })] as const),
    ),
  ) as unknown as Record<keyof typeof SEED_USERS, { id: string; email: string; name: string }>;
  await prisma.installState.upsert({ where: { id: 1 }, create: { id: 1, completedAt: new Date() }, update: {} });
  return seedPortfolio(prisma, users);
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: config().DATABASE_URL }) });
  const result = await seed(prisma);
  console.log(`Seeded workspace "${result.workspaceName}". Password for every seed login: ${SEED_PASSWORD}`);
  for (const u of Object.values(SEED_USERS)) console.log(`  ${u.email}`);
  if (result.contractorUrl) console.log(`Contractor job link: ${result.contractorUrl}`);
  await prisma.$disconnect();
}

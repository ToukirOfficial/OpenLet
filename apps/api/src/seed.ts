/**
 * Local and demo seed: fake data only (no real people or addresses). Safe to run again: it wipes the
 * seeded workspace and recreates it. Logins are listed in ASSUMPTIONS.md.
 */
import 'reflect-metadata';
import { rm } from 'node:fs/promises';
import path from 'node:path';
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
  const oldIds = old.map((m) => m.workspaceId);
  // Remove the old seed's files too, not just its rows.
  const files = await prisma.document.findMany({ where: { workspaceId: { in: oldIds } }, select: { storageKey: true } });
  await Promise.all(files.map((f) => rm(path.join(path.resolve(config().STORAGE_DIR), f.storageKey), { force: true })));
  await prisma.workspace.deleteMany({ where: { id: { in: oldIds } } });
  await prisma.user.deleteMany({ where: { email: { in: emails } } });

  const users = Object.fromEntries(
    await Promise.all(
      Object.entries(SEED_USERS).map(async ([k, u]) => [k, await prisma.user.create({ data: { ...u, passwordHash, isDemo: true } })] as const),
    ),
  ) as unknown as Record<keyof typeof SEED_USERS, { id: string; email: string; name: string }>;
  await prisma.installState.upsert({ where: { id: 1 }, create: { id: 1, completedAt: new Date() }, update: {} });
  return seedPortfolio(prisma, users);
}

/**
 * The seed creates logins with a published password, so it only runs for the demo site (DEMO_MODE=true),
 * or with --dev on a machine that isn't production (the accounts then can't log in unless DEMO_MODE is on).
 */
export function seedAllowed(env: { DEMO_MODE: boolean; NODE_ENV: string }, argv: string[]): { ok: true } | { ok: false; reason: string } {
  if (env.DEMO_MODE) return { ok: true };
  if (argv.includes('--dev') && env.NODE_ENV !== 'production') return { ok: true };
  return { ok: false, reason: env.NODE_ENV === 'production' ? 'Refusing to seed a production install unless DEMO_MODE=true.' : 'Refusing to seed: set DEMO_MODE=true, or pass --dev on a development machine.' };
}

const isMain = process.argv[1]?.endsWith('seed.js') ?? false;
if (isMain) {
  const allowed = seedAllowed(config(), process.argv.slice(2));
  if (!allowed.ok) {
    console.error(allowed.reason);
    process.exit(1);
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: config().DATABASE_URL }) });
  const result = await seed(prisma);
  console.log(`Seeded workspace "${result.workspaceName}". Password for every seed login: ${SEED_PASSWORD}`);
  for (const u of Object.values(SEED_USERS)) console.log(`  ${u.email}`);
  if (!config().DEMO_MODE) console.log('DEMO_MODE is off, so these logins are refused. Set DEMO_MODE=true in .env to use them.');
  if (result.contractorUrl) console.log(`Contractor job link: ${result.contractorUrl}`);
  await prisma.$disconnect();
}

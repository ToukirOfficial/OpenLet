import type { Prisma } from '../generated/prisma/client.js';
import { DEFAULT_SETTINGS } from '../common/settings.js';

/** A new workspace with its first Owner. */
export function createWorkspace(tx: Prisma.TransactionClient, userId: string, name: string, contactEmail?: string) {
  return tx.workspace.create({
    data: {
      name,
      contactEmail: contactEmail ?? null,
      settings: DEFAULT_SETTINGS as unknown as Prisma.InputJsonValue,
      memberships: { create: { userId, role: 'OWNER' } },
    },
  });
}

import type { WorkspaceRole } from '@openlet/shared';

/** Any signed-in person (account routes: /me, choosing a workspace). */
export interface UserContext {
  kind: 'user';
  userId: string;
  name: string;
  email: string;
  isDemo: boolean;
  ip: string | null;
}

/** A team member (Owner, Manager or Staff) working in one workspace. Every query is scoped by workspaceId. */
export interface StaffContext extends Omit<UserContext, 'kind'> {
  kind: 'staff';
  workspaceId: string;
  role: WorkspaceRole;
}

/** A tenant in the portal: one tenant record in one workspace. Every query is scoped to their own tenancies. */
export interface TenantContext extends Omit<UserContext, 'kind'> {
  kind: 'tenant';
  workspaceId: string;
  tenantId: string;
}

export type RequestAuth = UserContext | StaffContext | TenantContext;

/** Who did something, for activity and audit rows. */
export type Actor = { type: 'STAFF' | 'TENANT' | 'CONTRACTOR' | 'SYSTEM'; id: string | null; name: string };
export const actorOf = (ctx: StaffContext | TenantContext): Actor => ({
  type: ctx.kind === 'staff' ? 'STAFF' : 'TENANT',
  id: ctx.userId,
  name: ctx.name,
});

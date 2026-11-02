import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import type { WorkspaceRole } from '@openlet/shared';
import type { RequestAuth, StaffContext, TenantContext, UserContext } from './auth-context.js';

export const IS_PUBLIC = 'ol:public';
export const ROLES = 'ol:roles';
export const TENANT = 'ol:tenant';
export const SIGNED_IN = 'ol:signedIn';

/** No login needed (setup, login, contractor links). Everything else is denied by default. */
export const Public = () => SetMetadata(IS_PUBLIC, true);
/** Staff route: the caller must be a member of the current workspace with one of these roles. */
export const Roles = (...roles: WorkspaceRole[]) => SetMetadata(ROLES, roles);
export const ALL_STAFF: WorkspaceRole[] = ['OWNER', 'MANAGER', 'STAFF'];
export const MANAGERS: WorkspaceRole[] = ['OWNER', 'MANAGER'];
/** Tenant portal route: the caller must be a tenant in the current workspace. */
export const TenantOnly = () => SetMetadata(TENANT, true);
/** Any signed-in user, no workspace needed. */
export const SignedIn = () => SetMetadata(SIGNED_IN, true);

const authOf = (ctx: ExecutionContext) => ctx.switchToHttp().getRequest<Request & { auth?: RequestAuth }>().auth;

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): UserContext => {
  const auth = authOf(ctx);
  if (!auth) throw new Error('CurrentUser used on a public route');
  return { ...auth, kind: 'user' } as UserContext;
});

export const Staff = createParamDecorator((_: unknown, ctx: ExecutionContext): StaffContext => {
  const auth = authOf(ctx);
  if (auth?.kind !== 'staff') throw new Error('Staff used on a route without @Roles');
  return auth;
});

export const CurrentTenant = createParamDecorator((_: unknown, ctx: ExecutionContext): TenantContext => {
  const auth = authOf(ctx);
  if (auth?.kind !== 'tenant') throw new Error('CurrentTenant used on a route without @TenantOnly');
  return auth;
});

export const ClientIp = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string | null => ctx.switchToHttp().getRequest<Request>().ip ?? null,
);

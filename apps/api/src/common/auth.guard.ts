import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { WorkspaceRole } from '@openlet/shared';
import { PrismaService } from '../prisma.service.js';
import type { RequestAuth } from './auth-context.js';
import { COOKIES, getCookie } from './cookies.js';
import { verifyAccessToken } from './crypto.js';
import { IS_PUBLIC, ROLES, SIGNED_IN, TENANT } from './decorators.js';

const notLoggedIn = () => new UnauthorizedException({ code: 'NOT_LOGGED_IN', message: 'Please log in.' });
const forbidden = () => new ForbiddenException({ code: 'FORBIDDEN', message: 'You do not have access to this.' });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Global guard, deny by default. A route is @Public(), @SignedIn(), @TenantOnly() or carries @Roles(...);
 * anything else is refused. The workspace comes from the X-Workspace-Id header (the web app sends the one
 * the user picked); membership or a tenant record in that workspace is checked on every request.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const roles = this.reflector.getAllAndOverride<WorkspaceRole[] | undefined>(ROLES, targets);
    const tenantOnly = this.reflector.getAllAndOverride<boolean>(TENANT, targets) ?? false;
    const signedIn = this.reflector.getAllAndOverride<boolean>(SIGNED_IN, targets) ?? false;
    if (!roles?.length && !tenantOnly && !signedIn) {
      // A route with no policy is a bug, not an open door.
      throw new ForbiddenException({ code: 'NO_POLICY', message: 'You do not have access to this.' });
    }

    const req = ctx.switchToHttp().getRequest<Request & { auth?: RequestAuth }>();
    const token = getCookie(req, COOKIES.access);
    const claims = token ? verifyAccessToken(token) : null;
    if (!claims) throw notLoggedIn();
    // Logging out or a password reset revokes the family; its access tokens stop at once.
    const live = await this.prisma.refreshToken.findFirst({
      where: { familyId: claims.fam, userId: claims.sub, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true },
    });
    if (!live) throw notLoggedIn();
    const user = await this.prisma.user.findUnique({
      where: { id: claims.sub },
      select: { id: true, name: true, email: true, isDemo: true },
    });
    if (!user) throw notLoggedIn();
    const base = { userId: user.id, name: user.name, email: user.email, isDemo: user.isDemo, ip: req.ip ?? null };

    const header = req.get('x-workspace-id');
    const workspaceId = header && UUID.test(header) ? header : undefined;
    if (header && !workspaceId) throw forbidden();

    if (roles?.length) {
      const membership = await this.prisma.membership.findFirst({
        where: { userId: user.id, ...(workspaceId ? { workspaceId } : {}) },
        orderBy: { createdAt: 'asc' },
        select: { workspaceId: true, role: true },
      });
      if (!membership || !roles.includes(membership.role)) throw forbidden();
      req.auth = { kind: 'staff', ...base, workspaceId: membership.workspaceId, role: membership.role };
      return true;
    }

    if (tenantOnly) {
      const tenant = await this.prisma.tenant.findFirst({
        where: { userId: user.id, anonymisedAt: null, ...(workspaceId ? { workspaceId } : {}) },
        orderBy: { createdAt: 'asc' },
        select: { id: true, workspaceId: true },
      });
      if (!tenant) throw forbidden();
      req.auth = { kind: 'tenant', ...base, workspaceId: tenant.workspaceId, tenantId: tenant.id };
      return true;
    }

    req.auth = { kind: 'user', ...base };
    return true;
  }
}

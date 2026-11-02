import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { WorkspaceRole } from '@openlet/shared';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/auth/passwords.js';
import { ACCESS_TTL_SECONDS } from '../src/common/cookies.js';
import { randomToken, sha256, signAccessToken } from '../src/common/crypto.js';
import { DEFAULT_SETTINGS } from '../src/common/settings.js';
import type { Prisma } from '../src/generated/prisma/client.js';
import { MailService } from '../src/mail/mail.service.js';
import { PrismaService } from '../src/prisma.service.js';
import { QueueService } from '../src/jobs/queue.service.js';

export const PASSWORD = 'test-password-123';
let passwordHash: Promise<string> | undefined;

export interface TestContext {
  app: INestApplication;
  prisma: PrismaService;
  http: ReturnType<INestApplication['getHttpServer']>;
}

export async function startApp(): Promise<TestContext> {
  const app = await createApp({ logger: false });
  await app.init();
  return { app, prisma: app.get(PrismaService), http: app.getHttpServer() };
}

export const unique = () => randomUUID().slice(0, 8);

export async function createUser(prisma: PrismaService, data: Partial<Prisma.UserCreateInput> = {}) {
  passwordHash ??= hashPassword(PASSWORD);
  return prisma.user.create({ data: { email: `user-${unique()}@test.example`, name: 'Test User', passwordHash: await passwordHash, ...data } });
}

export async function createWorkspace(prisma: PrismaService, name = `Lettings ${unique()}`) {
  return prisma.workspace.create({ data: { name, settings: DEFAULT_SETTINGS as unknown as Prisma.InputJsonValue } });
}

export async function addMember(prisma: PrismaService, workspaceId: string, role: WorkspaceRole) {
  const user = await createUser(prisma, { name: `${role} person` });
  await prisma.membership.create({ data: { workspaceId, userId: user.id, role } });
  return user;
}

/** A workspace with one person in each role. */
export async function workspaceWithTeam(prisma: PrismaService) {
  const ws = await createWorkspace(prisma);
  const [owner, manager, staff] = await Promise.all([addMember(prisma, ws.id, 'OWNER'), addMember(prisma, ws.id, 'MANAGER'), addMember(prisma, ws.id, 'STAFF')]);
  return { ws, owner, manager, staff };
}

/** A tenant record with a portal login in the workspace. */
export async function createTenantUser(prisma: PrismaService, workspaceId: string) {
  const user = await createUser(prisma, { name: 'Tenant person' });
  const tenant = await prisma.tenant.create({ data: { workspaceId, userId: user.id, firstName: 'Test', lastName: `Tenant ${unique()}`, email: user.email } });
  return { user, tenant };
}

/**
 * An HTTP client logged in as a user (a live session row plus a signed access cookie), sending the CSRF
 * header and, optionally, the workspace header like the web app does.
 */
export async function as(ctx: TestContext, userId: string, workspaceId?: string) {
  const familyId = randomUUID();
  await ctx.prisma.refreshToken.create({
    data: { userId, familyId, tokenHash: sha256(randomToken()), expiresAt: new Date(Date.now() + 3600_000) },
  });
  const csrf = randomToken(24);
  const cookie = `ol_at=${signAccessToken(userId, familyId, ACCESS_TTL_SECONDS)}; ol_csrf=${csrf}`;
  const headers: Record<string, string> = { Cookie: cookie, 'x-csrf-token': csrf, ...(workspaceId ? { 'x-workspace-id': workspaceId } : {}) };
  const withHeaders = (r: request.Test) => r.set(headers);
  return {
    get: (url: string) => withHeaders(request(ctx.http).get(`/api/v1${url}`)),
    post: (url: string, body?: object) => withHeaders(request(ctx.http).post(`/api/v1${url}`)).send(body ?? {}),
    patch: (url: string, body?: object) => withHeaders(request(ctx.http).patch(`/api/v1${url}`)).send(body ?? {}),
    put: (url: string, body?: object) => withHeaders(request(ctx.http).put(`/api/v1${url}`)).send(body ?? {}),
    delete: (url: string) => withHeaders(request(ctx.http).delete(`/api/v1${url}`)),
    upload: (url: string) => withHeaders(request(ctx.http).post(`/api/v1${url}`)),
  };
}
export type Client = Awaited<ReturnType<typeof as>>;

/** A plain client with no session (public routes). */
export const anon = (ctx: TestContext) => ({
  get: (url: string) => request(ctx.http).get(`/api/v1${url}`),
  post: (url: string, body?: object) => request(ctx.http).post(`/api/v1${url}`).send(body ?? {}),
});

export const lastEmail = (to?: string) => [...MailService.outbox].reverse().find((m) => !to || m.to === to);
export const clearOutbox = () => {
  MailService.outbox.length = 0;
  QueueService.testJobs.length = 0;
};

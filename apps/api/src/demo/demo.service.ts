import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { config } from '../config.js';
import { PrismaService } from '../prisma.service.js';
import { RateLimitService } from '../common/rate-limit.service.js';
import { StorageService } from '../files/storage.service.js';
import { SessionService } from '../auth/session.service.js';
import { SEED_USERS, seed } from '../seed.js';
import type { PrismaClient } from '../generated/prisma/client.js';

/**
 * Demo mode only (DEMO_MODE=true): one-click logins, the mail viewer, the nightly reset and the hourly
 * clean-up of uploads. Every route here refuses to work when demo mode is off.
 */
@Injectable()
export class DemoService {
  private readonly logger = new Logger('Demo');

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly limits: RateLimitService,
    private readonly storage: StorageService,
  ) {}

  private assertDemo() {
    if (!config().DEMO_MODE) throw new NotFoundException({ message: 'Not found.' });
  }

  info() {
    return { demoMode: config().DEMO_MODE };
  }

  async login(as: 'landlord' | 'tenant', ip: string | null, res: Response) {
    this.assertDemo();
    await this.limits.hit(`demo:login:${ip}`, 30, 600);
    const email = as === 'landlord' ? SEED_USERS.owner.email : SEED_USERS.tenant.email;
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user?.isDemo) throw new ForbiddenException({ message: 'The demo is being reset. Try again in a minute.' });
    await this.sessions.start(user.id, res);
    return { ok: true, redirect: as === 'landlord' ? '/app' : '/portal' };
  }

  /** Every email the demo "sent", newest first. Shown to anyone on the demo site: it only ever holds fake data. */
  async mail() {
    this.assertDemo();
    const rows = await this.prisma.outboundEmail.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
    return rows.map((m) => ({ id: m.id, to: m.to, subject: m.subject, html: m.html, createdAt: m.createdAt.toISOString() }));
  }

  /** Nightly: wipe and re-seed the whole demo. */
  async reset() {
    if (!config().DEMO_MODE) return;
    await this.prisma.outboundEmail.deleteMany({});
    await this.prisma.exportJob.deleteMany({});
    await seed(this.prisma as unknown as PrismaClient);
    this.logger.log('Demo reset');
  }

  /** Hourly: remove anything visitors uploaded to the demo (seeded documents stay). */
  async purgeUploads() {
    if (!config().DEMO_MODE) return;
    const docs = await this.prisma.document.findMany({ where: { isDemo: false, createdAt: { lt: new Date(Date.now() - 3600_000) } } });
    for (const d of docs) await this.storage.remove(d.storageKey);
    await this.prisma.property.updateMany({ where: { coverDocId: { in: docs.map((d) => d.id) } }, data: { coverDocId: null } });
    await this.prisma.document.deleteMany({ where: { id: { in: docs.map((d) => d.id) } } });
    const logos = await this.prisma.workspace.findMany({ where: { logoKey: { not: null }, updatedAt: { lt: new Date(Date.now() - 3600_000) } } });
    for (const w of logos) {
      await this.storage.remove(w.logoKey!);
      await this.prisma.workspace.update({ where: { id: w.id }, data: { logoKey: null, logoMime: null } });
    }
    return docs.length;
  }
}

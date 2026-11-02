import { Injectable, NotFoundException } from '@nestjs/common';
import { config } from '../config.js';
import { PrismaService } from '../prisma.service.js';
import { randomToken, sha256 } from '../common/crypto.js';
import type { Prisma } from '../generated/prisma/client.js';

type Tx = Prisma.TransactionClient | PrismaService;

const linkGone = () =>
  new NotFoundException({ code: 'LINK_INVALID', message: 'This job link has expired or was withdrawn. Contact the landlord or agent for a new one.' });

/**
 * Contractor job links: a random token emailed to the contractor, stored only as a SHA-256 hash, scoped to
 * one repair. A link expires when its repair is closed or cancelled (plus a grace period), and can be revoked.
 */
@Injectable()
export class ContractorLinksService {
  constructor(private readonly prisma: PrismaService) {}

  /** A new link for this repair and contractor; any earlier link for the repair is revoked. Returns the raw token. */
  async issue(repairId: string, contractorId: string, tx: Tx = this.prisma): Promise<string> {
    const token = randomToken(32);
    await tx.contractorLink.updateMany({ where: { repairId, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.contractorLink.create({ data: { repairId, contractorId, tokenHash: sha256(token) } });
    return token;
  }

  /** The live link for a token, with its repair id. Throws 404 for unknown, revoked or expired links. */
  async resolve(token: string) {
    const link = await this.prisma.contractorLink.findUnique({ where: { tokenHash: sha256(token) } });
    if (!link || link.revokedAt || (link.expiresAt && link.expiresAt < new Date())) throw linkGone();
    await this.prisma.contractorLink.update({ where: { id: link.id }, data: { lastUsedAt: new Date() } });
    return link;
  }

  revokeAll(repairId: string, tx: Tx = this.prisma) {
    return tx.contractorLink.updateMany({ where: { repairId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  /** Called when the repair is closed or cancelled. */
  expireForRepair(repairId: string, closedAt: Date, tx: Tx = this.prisma) {
    const expiresAt = new Date(closedAt.getTime() + config().CONTRACTOR_LINK_GRACE_DAYS * 86_400_000);
    return tx.contractorLink.updateMany({ where: { repairId, revokedAt: null }, data: { expiresAt } });
  }

  /** Re-opening a repair makes its links work again (no expiry). */
  reopen(repairId: string, tx: Tx = this.prisma) {
    return tx.contractorLink.updateMany({ where: { repairId, revokedAt: null }, data: { expiresAt: null } });
  }
}

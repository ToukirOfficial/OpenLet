import { Injectable } from '@nestjs/common';
import { CERTIFICATE_TYPES, certificateStatus, daysBetween, isRequired, londonDate, worstStatus, type ComplianceBoard, type ComplianceCell, type ComplianceRow } from '@openlet/shared';
import { PrismaService } from '../prisma.service.js';
import type { StaffContext } from '../common/auth-context.js';
import { fromDb } from '../common/dates.js';
import { readSettings } from '../common/settings.js';
import { formatAddress } from '../properties/properties.service.js';
import type { Document } from '../generated/prisma/client.js';

/** The certificate that counts for a type: the one that runs longest (no expiry date counts as longest). */
export function currentCertificate(docs: Document[]): Document | null {
  let best: Document | null = null;
  for (const d of docs) {
    if (!best) best = d;
    else if (!d.expiresOn && best.expiresOn) best = d;
    else if (d.expiresOn && best.expiresOn && d.expiresOn > best.expiresOn) best = d;
    else if (!d.expiresOn && !best.expiresOn && d.createdAt > best.createdAt) best = d;
  }
  return best;
}

@Injectable()
export class ComplianceService {
  constructor(private readonly prisma: PrismaService) {}

  async board(workspaceId: string, propertyId?: string): Promise<ComplianceBoard> {
    const ws = await this.prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { settings: true } });
    const required = readSettings(ws.settings).requiredCertificates;
    const properties = await this.prisma.property.findMany({
      where: { workspaceId, archivedAt: null, ...(propertyId ? { id: propertyId } : {}) },
      include: { documents: { where: { type: { in: [...CERTIFICATE_TYPES] }, ready: true } } },
      orderBy: [{ town: 'asc' }, { addressLine1: 'asc' }],
    });
    const today = londonDate();
    const counts = { VALID: 0, EXPIRING: 0, EXPIRED: 0, MISSING: 0 };
    const rows: ComplianceRow[] = properties.map((p) => {
      const cells: ComplianceCell[] = CERTIFICATE_TYPES.map((type) => {
        const doc = currentCertificate(p.documents.filter((d) => d.type === type));
        const needed = isRequired(type, required, p);
        if (!doc && !needed) return { type, status: 'NOT_NEEDED', documentId: null, expiresOn: null, daysLeft: null };
        const expiresOn = fromDb(doc?.expiresOn);
        const status = certificateStatus(expiresOn, !!doc, today);
        counts[status]++;
        return { type, status, documentId: doc?.id ?? null, expiresOn, daysLeft: expiresOn ? daysBetween(today, expiresOn) : null };
      });
      const real = cells.filter((c) => c.status !== 'NOT_NEEDED').map((c) => c.status as Exclude<ComplianceCell['status'], 'NOT_NEEDED'>);
      return { propertyId: p.id, address: formatAddress(p), type: p.type, cells, worst: worstStatus(real) };
    });
    const rank = { EXPIRED: 0, MISSING: 1, EXPIRING: 2, VALID: 3 } as const;
    rows.sort((a, b) => rank[a.worst] - rank[b.worst]);
    return { types: [...CERTIFICATE_TYPES], rows, counts };
  }

  forStaff(ctx: StaffContext, propertyId?: string) {
    return this.board(ctx.workspaceId, propertyId);
  }
}

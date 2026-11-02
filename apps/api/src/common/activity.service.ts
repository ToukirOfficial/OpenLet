import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import type { Actor } from './auth-context.js';
import type { Prisma } from '../generated/prisma/client.js';

type Tx = Prisma.TransactionClient | PrismaService;

export interface ActivityInput {
  workspaceId: string;
  actor: Actor;
  action: string;
  /** Plain sentence shown on timelines ("Recorded a payment of £850.00"). Staff-only. */
  summary: string;
  propertyId?: string | null;
  tenancyId?: string | null;
  tenantId?: string | null;
  repairId?: string | null;
}

/** Activity timeline (staff-facing) and the append-only audit log of sensitive actions. */
@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  record(input: ActivityInput, tx: Tx = this.prisma) {
    return tx.activity.create({
      data: {
        workspaceId: input.workspaceId,
        actorType: input.actor.type,
        actorId: input.actor.id,
        actorName: input.actor.name,
        action: input.action,
        summary: input.summary,
        propertyId: input.propertyId ?? null,
        tenancyId: input.tenancyId ?? null,
        tenantId: input.tenantId ?? null,
        repairId: input.repairId ?? null,
      },
    });
  }

  audit(
    input: { workspaceId?: string | null; userId?: string | null; action: string; targetType?: string; targetId?: string; ip?: string | null },
    tx: Tx = this.prisma,
  ) {
    return tx.auditLog.create({
      data: {
        workspaceId: input.workspaceId ?? null,
        userId: input.userId ?? null,
        action: input.action,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        ip: input.ip ?? null,
      },
    });
  }
}

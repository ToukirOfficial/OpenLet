import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { idParam, otherChargeSchema, paymentSchema, reverseEntrySchema, statementSchema } from '@openlet/shared';
import type { StaffContext } from '../common/auth-context.js';
import { ALL_STAFF, Roles, Staff } from '../common/decorators.js';
import { ExportsService } from '../exports/exports.service.js';
import { LedgerService } from './ledger.service.js';
import { notFound } from '../common/not-found.js';
import { PrismaService } from '../prisma.service.js';

const arrearsQuery = z.object({ sort: z.enum(['amount', 'age']).default('amount') });
type IdP = z.infer<typeof idParam>;

@Controller()
@Roles(...ALL_STAFF)
export class LedgerController {
  constructor(
    private readonly ledger: LedgerService,
    private readonly exports: ExportsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('tenancies/:id/ledger')
  get(@Staff() ctx: StaffContext, @Param({ schema: idParam }) p: IdP) {
    return this.ledger.ledgerFor(ctx, p.id);
  }

  @Post('payments')
  payment(@Staff() ctx: StaffContext, @Body({ schema: paymentSchema }) body: z.infer<typeof paymentSchema>) {
    return this.ledger.record(ctx, 'PAYMENT', body);
  }

  @Post('charges')
  charge(@Staff() ctx: StaffContext, @Body({ schema: otherChargeSchema }) body: z.infer<typeof otherChargeSchema>) {
    return this.ledger.record(ctx, 'OTHER_CHARGE', body);
  }

  @Post('credits')
  credit(@Staff() ctx: StaffContext, @Body({ schema: otherChargeSchema }) body: z.infer<typeof otherChargeSchema>) {
    return this.ledger.record(ctx, 'CREDIT', body);
  }

  @Post('ledger/:id/reverse')
  @HttpCode(200)
  reverse(@Staff() ctx: StaffContext, @Param({ schema: idParam }) p: IdP, @Body({ schema: reverseEntrySchema }) body: z.infer<typeof reverseEntrySchema>) {
    return this.ledger.reverse(ctx, p.id, body.reason);
  }

  @Get('arrears')
  arrears(@Staff() ctx: StaffContext, @Query({ schema: arrearsQuery }) q: z.infer<typeof arrearsQuery>) {
    return this.ledger.arrears(ctx, q.sort);
  }

  @Post('tenancies/:id/statements')
  async statement(@Staff() ctx: StaffContext, @Param({ schema: idParam }) p: IdP, @Body({ schema: statementSchema }) body: z.infer<typeof statementSchema>) {
    if (!(await this.prisma.tenancy.findFirst({ where: { id: p.id, workspaceId: ctx.workspaceId }, select: { id: true } }))) throw notFound('Tenancy');
    return this.exports.request(ctx, 'statement', { tenancyId: p.id, from: body.from, to: body.to });
  }
}

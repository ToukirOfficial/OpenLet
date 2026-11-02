import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { isoDate } from '@openlet/shared';
import type { StaffContext } from '../common/auth-context.js';
import { ALL_STAFF, MANAGERS, Roles, Staff } from '../common/decorators.js';
import { LedgerService } from '../ledger/ledger.service.js';
import { ReportsService } from './reports.service.js';

const range = z.object({ from: isoDate, to: isoDate });
const kindParam = z.object({ kind: z.enum(['rent-roll', 'income', 'arrears', 'maintenance']) });
const csvQuery = z.object({ from: isoDate.optional(), to: isoDate.optional() });

/** Everyone in the team can view reports on screen; CSV downloads and the full export are Owner/Manager and Owner only. */
@Controller()
@Roles(...ALL_STAFF)
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly ledger: LedgerService,
  ) {}

  @Get('reports/rent-roll')
  rentRoll(@Staff() ctx: StaffContext) {
    return this.reports.rentRoll(ctx.workspaceId);
  }

  @Get('reports/income')
  income(@Staff() ctx: StaffContext, @Query({ schema: range }) q: z.infer<typeof range>) {
    return this.reports.income(ctx.workspaceId, q.from, q.to);
  }

  @Get('reports/arrears')
  arrears(@Staff() ctx: StaffContext) {
    return this.ledger.arrears(ctx);
  }

  @Get('reports/maintenance')
  maintenance(@Staff() ctx: StaffContext, @Query({ schema: range }) q: z.infer<typeof range>) {
    return this.reports.maintenance(ctx.workspaceId, q.from, q.to);
  }

  @Roles(...MANAGERS)
  @Post('reports/:kind/csv')
  csv(@Staff() ctx: StaffContext, @Param({ schema: kindParam }) p: z.infer<typeof kindParam>, @Query({ schema: csvQuery }) q: z.infer<typeof csvQuery>) {
    return this.reports.requestCsv(ctx, p.kind, q);
  }

  @Roles('OWNER')
  @Post('exports')
  fullExport(@Staff() ctx: StaffContext) {
    return this.reports.requestFullExport(ctx);
  }
}

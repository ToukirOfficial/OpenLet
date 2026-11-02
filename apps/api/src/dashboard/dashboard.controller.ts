import { Controller, Get, Query } from '@nestjs/common';
import type { z } from 'zod';
import { calendarQuery } from '@openlet/shared';
import type { StaffContext } from '../common/auth-context.js';
import { ALL_STAFF, Roles, Staff } from '../common/decorators.js';
import { DashboardService } from './dashboard.service.js';

@Controller()
@Roles(...ALL_STAFF)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('dashboard')
  get(@Staff() ctx: StaffContext) {
    return this.dashboard.dashboard(ctx);
  }

  @Get('calendar')
  calendar(@Staff() ctx: StaffContext, @Query({ schema: calendarQuery }) q: z.infer<typeof calendarQuery>) {
    return this.dashboard.calendar(ctx, q.from, q.to);
  }
}

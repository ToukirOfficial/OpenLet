import { Controller, Get, Query } from '@nestjs/common';
import { z } from 'zod';
import { id } from '@openlet/shared';
import type { StaffContext } from '../common/auth-context.js';
import { ALL_STAFF, Roles, Staff } from '../common/decorators.js';
import { ComplianceService } from './compliance.service.js';

const q = z.object({ propertyId: id.optional() });

@Controller('compliance')
@Roles(...ALL_STAFF)
export class ComplianceController {
  constructor(private readonly compliance: ComplianceService) {}

  @Get()
  board(@Staff() ctx: StaffContext, @Query({ schema: q }) query: z.infer<typeof q>) {
    return this.compliance.forStaff(ctx, query.propertyId);
  }
}

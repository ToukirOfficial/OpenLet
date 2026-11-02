import { Controller, Get, Param } from '@nestjs/common';
import type { z } from 'zod';
import { idParam } from '@openlet/shared';
import type { StaffContext } from '../common/auth-context.js';
import { ALL_STAFF, Roles, Staff } from '../common/decorators.js';
import { ExportsService } from './exports.service.js';

@Controller('jobs')
@Roles(...ALL_STAFF)
export class ExportsController {
  constructor(private readonly exports: ExportsService) {}

  @Get(':id')
  status(@Staff() ctx: StaffContext, @Param({ schema: idParam }) p: z.infer<typeof idParam>) {
    return this.exports.status(ctx, p.id);
  }

  @Get(':id/download')
  download(@Staff() ctx: StaffContext, @Param({ schema: idParam }) p: z.infer<typeof idParam>) {
    return this.exports.download(ctx, p.id);
  }
}

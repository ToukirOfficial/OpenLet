import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import type { z } from 'zod';
import { contractorSchema, idParam } from '@openlet/shared';
import type { StaffContext } from '../common/auth-context.js';
import { ALL_STAFF, Roles, Staff } from '../common/decorators.js';
import { ContractorsService } from './contractors.service.js';

@Controller('contractors')
@Roles(...ALL_STAFF)
export class ContractorsController {
  constructor(private readonly contractors: ContractorsService) {}

  @Get()
  list(@Staff() ctx: StaffContext) {
    return this.contractors.list(ctx);
  }

  @Post()
  create(@Staff() ctx: StaffContext, @Body({ schema: contractorSchema }) body: z.infer<typeof contractorSchema>) {
    return this.contractors.create(ctx, body);
  }

  @Patch(':id')
  update(@Staff() ctx: StaffContext, @Param({ schema: idParam }) p: z.infer<typeof idParam>, @Body({ schema: contractorSchema }) body: z.infer<typeof contractorSchema>) {
    return this.contractors.update(ctx, p.id, body);
  }

  @Delete(':id')
  remove(@Staff() ctx: StaffContext, @Param({ schema: idParam }) p: z.infer<typeof idParam>) {
    return this.contractors.remove(ctx, p.id);
  }
}

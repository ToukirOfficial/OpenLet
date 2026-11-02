import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { id, idParam, rightToRentSchema, tenantListQuery, tenantSchema } from '@openlet/shared';
import type { StaffContext } from '../common/auth-context.js';
import { ALL_STAFF, MANAGERS, Roles, Staff } from '../common/decorators.js';
import { TenantsService } from './tenants.service.js';

const checkParams = z.object({ id, checkId: id });

@Controller('tenants')
@Roles(...ALL_STAFF)
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Get()
  list(@Staff() ctx: StaffContext, @Query({ schema: tenantListQuery }) q: z.infer<typeof tenantListQuery>) {
    return this.tenants.list(ctx, q);
  }

  @Post()
  create(@Staff() ctx: StaffContext, @Body({ schema: tenantSchema }) body: z.infer<typeof tenantSchema>) {
    return this.tenants.create(ctx, body);
  }

  @Get(':id')
  get(@Staff() ctx: StaffContext, @Param({ schema: idParam }) p: z.infer<typeof idParam>) {
    return this.tenants.get(ctx, p.id);
  }

  @Patch(':id')
  update(@Staff() ctx: StaffContext, @Param({ schema: idParam }) p: z.infer<typeof idParam>, @Body({ schema: tenantSchema }) body: z.infer<typeof tenantSchema>) {
    return this.tenants.update(ctx, p.id, body);
  }

  @Roles(...MANAGERS)
  @Delete(':id')
  remove(@Staff() ctx: StaffContext, @Param({ schema: idParam }) p: z.infer<typeof idParam>) {
    return this.tenants.remove(ctx, p.id);
  }

  @Post(':id/invite')
  invite(@Staff() ctx: StaffContext, @Param({ schema: idParam }) p: z.infer<typeof idParam>) {
    return this.tenants.invite(ctx, p.id);
  }

  @Post(':id/right-to-rent')
  addCheck(@Staff() ctx: StaffContext, @Param({ schema: idParam }) p: z.infer<typeof idParam>, @Body({ schema: rightToRentSchema }) body: z.infer<typeof rightToRentSchema>) {
    return this.tenants.addRightToRent(ctx, p.id, body);
  }

  @Delete(':id/right-to-rent/:checkId')
  removeCheck(@Staff() ctx: StaffContext, @Param({ schema: checkParams }) p: z.infer<typeof checkParams>) {
    return this.tenants.removeRightToRent(ctx, p.id, p.checkId);
  }
}

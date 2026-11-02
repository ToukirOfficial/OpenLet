import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { id, idParam, propertyListQuery, propertySchema, propertyUpdateSchema, unitSchema } from '@openlet/shared';
import type { StaffContext } from '../common/auth-context.js';
import { ALL_STAFF, MANAGERS, Roles, Staff } from '../common/decorators.js';
import { PropertiesService } from './properties.service.js';

const unitParams = z.object({ id, unitId: id });

@Controller('properties')
@Roles(...ALL_STAFF)
export class PropertiesController {
  constructor(private readonly properties: PropertiesService) {}

  @Get()
  list(@Staff() ctx: StaffContext, @Query({ schema: propertyListQuery }) q: z.infer<typeof propertyListQuery>) {
    return this.properties.list(ctx, q);
  }

  @Post()
  create(@Staff() ctx: StaffContext, @Body({ schema: propertySchema }) body: z.infer<typeof propertySchema>) {
    return this.properties.create(ctx, body);
  }

  @Get('options')
  options(@Staff() ctx: StaffContext) {
    return this.properties.options(ctx);
  }

  @Get(':id')
  get(@Staff() ctx: StaffContext, @Param({ schema: idParam }) p: z.infer<typeof idParam>) {
    return this.properties.get(ctx, p.id);
  }

  @Patch(':id')
  update(@Staff() ctx: StaffContext, @Param({ schema: idParam }) p: z.infer<typeof idParam>, @Body({ schema: propertyUpdateSchema }) body: z.infer<typeof propertyUpdateSchema>) {
    return this.properties.update(ctx, p.id, body);
  }

  @Roles(...MANAGERS)
  @Delete(':id')
  remove(@Staff() ctx: StaffContext, @Param({ schema: idParam }) p: z.infer<typeof idParam>) {
    return this.properties.remove(ctx, p.id);
  }

  @Roles(...MANAGERS)
  @Post(':id/restore')
  restore(@Staff() ctx: StaffContext, @Param({ schema: idParam }) p: z.infer<typeof idParam>) {
    return this.properties.restore(ctx, p.id);
  }

  @Post(':id/units')
  addUnit(@Staff() ctx: StaffContext, @Param({ schema: idParam }) p: z.infer<typeof idParam>, @Body({ schema: unitSchema }) body: z.infer<typeof unitSchema>) {
    return this.properties.addUnit(ctx, p.id, body.name);
  }

  @Patch(':id/units/:unitId')
  renameUnit(@Staff() ctx: StaffContext, @Param({ schema: unitParams }) p: z.infer<typeof unitParams>, @Body({ schema: unitSchema }) body: z.infer<typeof unitSchema>) {
    return this.properties.renameUnit(ctx, p.id, p.unitId, body.name);
  }

  @Roles(...MANAGERS)
  @Delete(':id/units/:unitId')
  removeUnit(@Staff() ctx: StaffContext, @Param({ schema: unitParams }) p: z.infer<typeof unitParams>) {
    return this.properties.removeUnit(ctx, p.id, p.unitId);
  }
}

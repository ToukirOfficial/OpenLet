import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { z } from 'zod';
import { depositReturnSchema, depositSchema, endTenancySchema, guarantorSchema, id, idParam, noticeSchema, rentChangeSchema, tenancyListQuery, tenancySchema, tenancyUpdateSchema } from '@openlet/shared';
import type { StaffContext } from '../common/auth-context.js';
import { ALL_STAFF, Roles, Staff } from '../common/decorators.js';
import { TenanciesService } from './tenancies.service.js';

const childParams = z.object({ id, childId: id });
type IdP = z.infer<typeof idParam>;

@Controller('tenancies')
@Roles(...ALL_STAFF)
export class TenanciesController {
  constructor(private readonly tenancies: TenanciesService) {}

  @Get()
  list(@Staff() ctx: StaffContext, @Query({ schema: tenancyListQuery }) q: z.infer<typeof tenancyListQuery>) {
    return this.tenancies.list(ctx, q);
  }

  @Post()
  create(@Staff() ctx: StaffContext, @Body({ schema: tenancySchema }) body: z.infer<typeof tenancySchema>) {
    return this.tenancies.create(ctx, body);
  }

  @Get(':id')
  get(@Staff() ctx: StaffContext, @Param({ schema: idParam }) p: IdP) {
    return this.tenancies.get(ctx, p.id);
  }

  @Patch(':id')
  update(@Staff() ctx: StaffContext, @Param({ schema: idParam }) p: IdP, @Body({ schema: tenancyUpdateSchema }) body: z.infer<typeof tenancyUpdateSchema>) {
    return this.tenancies.update(ctx, p.id, body);
  }

  @Post(':id/rent-changes')
  addRent(@Staff() ctx: StaffContext, @Param({ schema: idParam }) p: IdP, @Body({ schema: rentChangeSchema }) body: z.infer<typeof rentChangeSchema>) {
    return this.tenancies.addRentChange(ctx, p.id, body);
  }

  @Delete(':id/rent-changes/:childId')
  removeRent(@Staff() ctx: StaffContext, @Param({ schema: childParams }) p: z.infer<typeof childParams>) {
    return this.tenancies.removeRentChange(ctx, p.id, p.childId);
  }

  @Post(':id/notice')
  @HttpCode(200)
  notice(@Staff() ctx: StaffContext, @Param({ schema: idParam }) p: IdP, @Body({ schema: noticeSchema }) body: z.infer<typeof noticeSchema>) {
    return this.tenancies.giveNotice(ctx, p.id, body);
  }

  @Delete(':id/notice')
  withdrawNotice(@Staff() ctx: StaffContext, @Param({ schema: idParam }) p: IdP) {
    return this.tenancies.withdrawNotice(ctx, p.id);
  }

  @Post(':id/end')
  @HttpCode(200)
  end(@Staff() ctx: StaffContext, @Param({ schema: idParam }) p: IdP, @Body({ schema: endTenancySchema }) body: z.infer<typeof endTenancySchema>) {
    return this.tenancies.end(ctx, p.id, body.endedOn);
  }

  @Post(':id/guarantors')
  addGuarantor(@Staff() ctx: StaffContext, @Param({ schema: idParam }) p: IdP, @Body({ schema: guarantorSchema }) body: z.infer<typeof guarantorSchema>) {
    return this.tenancies.addGuarantor(ctx, p.id, body);
  }

  @Patch(':id/guarantors/:childId')
  updateGuarantor(@Staff() ctx: StaffContext, @Param({ schema: childParams }) p: z.infer<typeof childParams>, @Body({ schema: guarantorSchema }) body: z.infer<typeof guarantorSchema>) {
    return this.tenancies.updateGuarantor(ctx, p.id, p.childId, body);
  }

  @Delete(':id/guarantors/:childId')
  removeGuarantor(@Staff() ctx: StaffContext, @Param({ schema: childParams }) p: z.infer<typeof childParams>) {
    return this.tenancies.removeGuarantor(ctx, p.id, p.childId);
  }

  @Put(':id/deposit')
  deposit(@Staff() ctx: StaffContext, @Param({ schema: idParam }) p: IdP, @Body({ schema: depositSchema }) body: z.infer<typeof depositSchema>) {
    return this.tenancies.saveDeposit(ctx, p.id, body);
  }

  @Post(':id/deposit/return')
  @HttpCode(200)
  depositReturn(@Staff() ctx: StaffContext, @Param({ schema: idParam }) p: IdP, @Body({ schema: depositReturnSchema }) body: z.infer<typeof depositReturnSchema>) {
    return this.tenancies.returnDeposit(ctx, p.id, body);
  }
}

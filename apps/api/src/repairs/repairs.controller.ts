import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { z } from 'zod';
import { assignContractorSchema, contractorUpdateSchema, id, idParam, repairCommentSchema, repairListQuery, repairStatusSchema, repairUpdateSchema, staffRepairSchema, tokenParam } from '@openlet/shared';
import type { StaffContext } from '../common/auth-context.js';
import { ALL_STAFF, ClientIp, Public, Roles, Staff } from '../common/decorators.js';
import { uploadInterceptor } from '../documents/documents.controller.js';
import { ContractorJobService } from './contractor-job.service.js';
import { RepairsService } from './repairs.service.js';

type IdP = z.infer<typeof idParam>;

@Controller('repairs')
@Roles(...ALL_STAFF)
export class RepairsController {
  constructor(private readonly repairs: RepairsService) {}

  @Get()
  list(@Staff() ctx: StaffContext, @Query({ schema: repairListQuery }) q: z.infer<typeof repairListQuery>) {
    return this.repairs.list(ctx, q);
  }

  @Post()
  create(@Staff() ctx: StaffContext, @Body({ schema: staffRepairSchema }) body: z.infer<typeof staffRepairSchema>) {
    return this.repairs.create(ctx, body);
  }

  @Get(':id')
  get(@Staff() ctx: StaffContext, @Param({ schema: idParam }) p: IdP) {
    return this.repairs.get(ctx, p.id);
  }

  @Patch(':id')
  update(@Staff() ctx: StaffContext, @Param({ schema: idParam }) p: IdP, @Body({ schema: repairUpdateSchema }) body: z.infer<typeof repairUpdateSchema>) {
    return this.repairs.update(ctx, p.id, body);
  }

  @Post(':id/status')
  @HttpCode(200)
  status(@Staff() ctx: StaffContext, @Param({ schema: idParam }) p: IdP, @Body({ schema: repairStatusSchema }) body: z.infer<typeof repairStatusSchema>) {
    return this.repairs.setStatus(ctx, p.id, body.status, body.note);
  }

  @Post(':id/comments')
  comment(@Staff() ctx: StaffContext, @Param({ schema: idParam }) p: IdP, @Body({ schema: repairCommentSchema }) body: z.infer<typeof repairCommentSchema>) {
    return this.repairs.comment(ctx, p.id, body.body, body.visibility);
  }

  @Post(':id/assign')
  @HttpCode(200)
  assign(@Staff() ctx: StaffContext, @Param({ schema: idParam }) p: IdP, @Body({ schema: assignContractorSchema }) body: z.infer<typeof assignContractorSchema>) {
    return this.repairs.assign(ctx, p.id, body.contractorId);
  }

  @Post(':id/links/revoke')
  @HttpCode(200)
  revoke(@Staff() ctx: StaffContext, @Param({ schema: idParam }) p: IdP) {
    return this.repairs.revokeLink(ctx, p.id);
  }
}

const photoParams = z.object({ token: z.string().min(20).max(200), id });

/** Public: the link token is the only credential, and it opens exactly one repair. */
@Controller('job')
@Public()
export class ContractorJobController {
  constructor(private readonly jobs: ContractorJobService) {}

  @Get(':token')
  view(@Param({ schema: tokenParam }) p: z.infer<typeof tokenParam>, @ClientIp() ip: string | null) {
    return this.jobs.view(p.token, ip);
  }

  @Post(':token')
  @HttpCode(200)
  update(@Param({ schema: tokenParam }) p: z.infer<typeof tokenParam>, @ClientIp() ip: string | null, @Body({ schema: contractorUpdateSchema }) body: z.infer<typeof contractorUpdateSchema>) {
    return this.jobs.update(p.token, ip, body);
  }

  @Post(':token/photos')
  @HttpCode(200)
  @UseInterceptors(uploadInterceptor())
  photo(@Param({ schema: tokenParam }) p: z.infer<typeof tokenParam>, @ClientIp() ip: string | null, @UploadedFile() file: Express.Multer.File | undefined) {
    return this.jobs.addPhoto(p.token, ip, file);
  }

  @Get(':token/photos/:id')
  getPhoto(@Param({ schema: photoParams }) p: z.infer<typeof photoParams>, @ClientIp() ip: string | null) {
    return this.jobs.photo(p.token, ip, p.id);
  }
}

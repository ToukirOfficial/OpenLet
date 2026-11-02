import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { z } from 'zod';
import { id, idParam, isoDate, messageSchema, portalContactSchema, portalTenancyQuery, reportRepairSchema } from '@openlet/shared';
import type { TenantContext } from '../common/auth-context.js';
import { CurrentTenant, TenantOnly } from '../common/decorators.js';
import { uploadInterceptor } from '../documents/documents.controller.js';
import { ExportsService } from '../exports/exports.service.js';
import { PortalService } from './portal.service.js';

type IdP = z.infer<typeof idParam>;
const statementBody = z.object({ tenancyId: id.optional(), from: isoDate, to: isoDate }).refine((s) => s.to >= s.from, { path: ['to'], message: 'The end date must be on or after the start' });
const repairBody = reportRepairSchema.extend({ tenancyId: id.optional() });
const messageBody = messageSchema.extend({ tenancyId: id.optional() });
const commentBody = z.object({ body: z.string().trim().min(1, 'Write a comment').max(4000) });
const photoParams = z.object({ id, docId: id });

/** Tenant portal. Every route needs a tenant login and works only on that tenant's own records. */
@Controller('portal')
@TenantOnly()
export class PortalController {
  constructor(
    private readonly portal: PortalService,
    private readonly exports: ExportsService,
  ) {}

  @Get('home')
  home(@CurrentTenant() ctx: TenantContext) {
    return this.portal.home(ctx);
  }

  @Get('ledger')
  ledger(@CurrentTenant() ctx: TenantContext, @Query({ schema: portalTenancyQuery }) q: z.infer<typeof portalTenancyQuery>) {
    return this.portal.ledgerFor(ctx, q.tenancyId);
  }

  @Post('statements')
  statement(@CurrentTenant() ctx: TenantContext, @Body({ schema: statementBody }) body: z.infer<typeof statementBody>) {
    return this.portal.statement(ctx, body);
  }

  @Get('jobs/:id')
  job(@CurrentTenant() ctx: TenantContext, @Param({ schema: idParam }) p: IdP) {
    return this.exports.status(ctx, p.id);
  }

  @Get('jobs/:id/download')
  jobDownload(@CurrentTenant() ctx: TenantContext, @Param({ schema: idParam }) p: IdP) {
    return this.exports.download(ctx, p.id);
  }

  @Get('repairs')
  repairs(@CurrentTenant() ctx: TenantContext) {
    return this.portal.repairs(ctx);
  }

  @Post('repairs')
  report(@CurrentTenant() ctx: TenantContext, @Body({ schema: repairBody }) body: z.infer<typeof repairBody>) {
    return this.portal.reportRepair(ctx, body);
  }

  @Get('repairs/:id')
  repair(@CurrentTenant() ctx: TenantContext, @Param({ schema: idParam }) p: IdP) {
    return this.portal.repair(ctx, p.id);
  }

  @Post('repairs/:id/photos')
  @HttpCode(200)
  @UseInterceptors(uploadInterceptor())
  photo(@CurrentTenant() ctx: TenantContext, @Param({ schema: idParam }) p: IdP, @UploadedFile() file: Express.Multer.File | undefined) {
    return this.portal.addRepairPhoto(ctx, p.id, file);
  }

  @Get('repairs/:id/photos/:docId')
  getPhoto(@CurrentTenant() ctx: TenantContext, @Param({ schema: photoParams }) p: z.infer<typeof photoParams>) {
    return this.portal.repairPhoto(ctx, p.id, p.docId);
  }

  @Post('repairs/:id/comments')
  @HttpCode(200)
  comment(@CurrentTenant() ctx: TenantContext, @Param({ schema: idParam }) p: IdP, @Body({ schema: commentBody }) body: z.infer<typeof commentBody>) {
    return this.portal.commentOnRepair(ctx, p.id, body.body);
  }

  @Get('documents')
  documents(@CurrentTenant() ctx: TenantContext) {
    return this.portal.documentsList(ctx);
  }

  @Get('documents/:id/download')
  download(@CurrentTenant() ctx: TenantContext, @Param({ schema: idParam }) p: IdP) {
    return this.portal.download(ctx, p.id);
  }

  @Get('messages')
  messages(@CurrentTenant() ctx: TenantContext, @Query({ schema: portalTenancyQuery }) q: z.infer<typeof portalTenancyQuery>) {
    return this.portal.messagesFor(ctx, q.tenancyId);
  }

  @Post('messages')
  send(@CurrentTenant() ctx: TenantContext, @Body({ schema: messageBody }) body: z.infer<typeof messageBody>) {
    return this.portal.sendMessage(ctx, body.body, body.tenancyId);
  }

  @Get('details')
  details(@CurrentTenant() ctx: TenantContext) {
    return this.portal.details(ctx);
  }

  @Patch('contact')
  contact(@CurrentTenant() ctx: TenantContext, @Body({ schema: portalContactSchema }) body: z.infer<typeof portalContactSchema>) {
    return this.portal.updateContact(ctx, body);
  }
}

import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { z } from 'zod';
import { documentListQuery, documentUpdateSchema, documentUploadSchema, idParam } from '@openlet/shared';
import { config } from '../config.js';
import type { StaffContext } from '../common/auth-context.js';
import { ALL_STAFF, Roles, Staff } from '../common/decorators.js';
import { DocumentsService } from './documents.service.js';

export const uploadInterceptor = () => FileInterceptor('file', { limits: { fileSize: config().UPLOAD_MAX_BYTES, files: 1, fields: 20 } });
const downloadQuery = z.object({ inline: z.enum(['1', '0']).optional() });

@Controller('documents')
@Roles(...ALL_STAFF)
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  list(@Staff() ctx: StaffContext, @Query({ schema: documentListQuery }) q: z.infer<typeof documentListQuery>) {
    return this.documents.list(ctx, q);
  }

  @Post()
  @UseInterceptors(uploadInterceptor())
  upload(@Staff() ctx: StaffContext, @UploadedFile() file: Express.Multer.File | undefined, @Body({ schema: documentUploadSchema }) body: z.infer<typeof documentUploadSchema>) {
    return this.documents.upload(ctx, file, body);
  }

  @Patch(':id')
  update(@Staff() ctx: StaffContext, @Param({ schema: idParam }) p: z.infer<typeof idParam>, @Body({ schema: documentUpdateSchema }) body: z.infer<typeof documentUpdateSchema>) {
    return this.documents.update(ctx, p.id, body);
  }

  @Delete(':id')
  remove(@Staff() ctx: StaffContext, @Param({ schema: idParam }) p: z.infer<typeof idParam>) {
    return this.documents.remove(ctx, p.id);
  }

  @Get(':id/download')
  download(@Staff() ctx: StaffContext, @Param({ schema: idParam }) p: z.infer<typeof idParam>, @Query({ schema: downloadQuery }) q: z.infer<typeof downloadQuery>) {
    return this.documents.download(ctx, p.id, q.inline === '1');
  }
}

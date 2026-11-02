import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import type { z } from 'zod';
import { activityQuery, idParam, noteSchema, notesQuery } from '@openlet/shared';
import type { StaffContext } from '../common/auth-context.js';
import { ALL_STAFF, Roles, Staff } from '../common/decorators.js';
import { NotesService } from './notes.service.js';

@Controller()
@Roles(...ALL_STAFF)
export class NotesController {
  constructor(private readonly notes: NotesService) {}

  @Get('notes')
  list(@Staff() ctx: StaffContext, @Query({ schema: notesQuery }) q: z.infer<typeof notesQuery>) {
    return this.notes.list(ctx, q);
  }

  @Post('notes')
  create(@Staff() ctx: StaffContext, @Body({ schema: noteSchema }) body: z.infer<typeof noteSchema>) {
    return this.notes.create(ctx, body);
  }

  @Delete('notes/:id')
  remove(@Staff() ctx: StaffContext, @Param({ schema: idParam }) p: z.infer<typeof idParam>) {
    return this.notes.remove(ctx, p.id);
  }

  @Get('activity')
  activity(@Staff() ctx: StaffContext, @Query({ schema: activityQuery }) q: z.infer<typeof activityQuery>) {
    return this.notes.activity(ctx, q);
  }
}

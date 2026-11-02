import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import type { z } from 'zod';
import { idParam, messageSchema } from '@openlet/shared';
import type { StaffContext } from '../common/auth-context.js';
import { ALL_STAFF, Roles, Staff } from '../common/decorators.js';
import { MessagesService } from './messages.service.js';

@Controller()
@Roles(...ALL_STAFF)
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get('messages/threads')
  threads(@Staff() ctx: StaffContext) {
    return this.messages.threads(ctx);
  }

  @Get('tenancies/:id/messages')
  list(@Staff() ctx: StaffContext, @Param({ schema: idParam }) p: z.infer<typeof idParam>) {
    return this.messages.forStaff(ctx, p.id);
  }

  @Post('tenancies/:id/messages')
  send(@Staff() ctx: StaffContext, @Param({ schema: idParam }) p: z.infer<typeof idParam>, @Body({ schema: messageSchema }) body: z.infer<typeof messageSchema>) {
    return this.messages.sendAsStaff(ctx, p.id, body.body);
  }
}

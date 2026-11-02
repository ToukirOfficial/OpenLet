import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import type { z } from 'zod';
import { createWorkspaceSchema, deleteWorkspaceSchema, idParam, inviteMemberSchema, listQuery, updateMemberSchema, workspaceSettingsSchema } from '@openlet/shared';
import type { StaffContext, UserContext } from '../common/auth-context.js';
import { ALL_STAFF, CurrentUser, MANAGERS, Public, Roles, SignedIn, Staff } from '../common/decorators.js';
import { uploadInterceptor } from '../documents/documents.controller.js';
import { WorkspacesService } from './workspaces.service.js';

@Controller()
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @SignedIn()
  @Post('workspaces')
  create(@CurrentUser() user: UserContext, @Body({ schema: createWorkspaceSchema }) body: z.infer<typeof createWorkspaceSchema>) {
    return this.workspaces.create(user, body.name);
  }

  @Roles(...ALL_STAFF)
  @Get('workspace')
  current(@Staff() ctx: StaffContext) {
    return this.workspaces.current(ctx);
  }

  @Roles(...MANAGERS)
  @Patch('workspace/settings')
  settings(@Staff() ctx: StaffContext, @Body({ schema: workspaceSettingsSchema }) body: z.infer<typeof workspaceSettingsSchema>) {
    return this.workspaces.updateSettings(ctx, body);
  }

  @Roles(...MANAGERS)
  @Post('workspace/logo')
  @HttpCode(200)
  @UseInterceptors(uploadInterceptor())
  setLogo(@Staff() ctx: StaffContext, @UploadedFile() file: Express.Multer.File | undefined) {
    return this.workspaces.setLogo(ctx, file);
  }

  @Public()
  @Get('workspace-logo/:id')
  logo(@Param({ schema: idParam }) p: z.infer<typeof idParam>) {
    return this.workspaces.logo(p.id);
  }

  @Roles('OWNER')
  @Post('workspace/delete')
  @HttpCode(200)
  remove(@Staff() ctx: StaffContext, @Body({ schema: deleteWorkspaceSchema }) body: z.infer<typeof deleteWorkspaceSchema>) {
    return this.workspaces.remove(ctx, body.confirmName);
  }

  @Roles('OWNER')
  @Get('members')
  members(@Staff() ctx: StaffContext) {
    return this.workspaces.members(ctx);
  }

  @Roles('OWNER')
  @Post('members/invites')
  invite(@Staff() ctx: StaffContext, @Body({ schema: inviteMemberSchema }) body: z.infer<typeof inviteMemberSchema>) {
    return this.workspaces.invite(ctx, body);
  }

  @Roles('OWNER')
  @Delete('members/invites/:id')
  revokeInvite(@Staff() ctx: StaffContext, @Param({ schema: idParam }) p: z.infer<typeof idParam>) {
    return this.workspaces.revokeInvite(ctx, p.id);
  }

  @Roles('OWNER')
  @Patch('members/:id')
  changeRole(@Staff() ctx: StaffContext, @Param({ schema: idParam }) p: z.infer<typeof idParam>, @Body({ schema: updateMemberSchema }) body: z.infer<typeof updateMemberSchema>) {
    return this.workspaces.changeRole(ctx, p.id, body.role);
  }

  @Roles('OWNER')
  @Delete('members/:id')
  removeMember(@Staff() ctx: StaffContext, @Param({ schema: idParam }) p: z.infer<typeof idParam>) {
    return this.workspaces.removeMember(ctx, p.id);
  }

  @Roles('OWNER')
  @Get('audit-log')
  audit(@Staff() ctx: StaffContext, @Query({ schema: listQuery }) q: z.infer<typeof listQuery>) {
    return this.workspaces.auditLog(ctx, q.page);
  }
}

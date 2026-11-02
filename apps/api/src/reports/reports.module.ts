import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';
import { WorkspaceExportService } from './workspace-export.service.js';

@Module({ controllers: [ReportsController], providers: [ReportsService, WorkspaceExportService] })
export class ReportsModule {}

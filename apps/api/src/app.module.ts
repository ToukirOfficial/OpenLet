import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './common/auth.guard.js';
import { CommonModule } from './common/common.module.js';
import { AuthModule } from './auth/auth.module.js';
import { WorkspacesModule } from './workspaces/workspaces.module.js';
import { HealthController } from './health/health.controller.js';
import { PropertiesModule } from './properties/properties.module.js';
import { TenantsModule } from './tenants/tenants.module.js';
import { ContractorsModule } from './contractors/contractors.module.js';
import { DocumentsModule } from './documents/documents.module.js';
import { NotesModule } from './notes/notes.module.js';
import { LedgerModule } from './ledger/ledger.module.js';
import { TenanciesModule } from './tenancies/tenancies.module.js';
import { ExportsModule } from './exports/exports.module.js';

@Module({
  imports: [CommonModule, AuthModule, WorkspacesModule, DocumentsModule, PropertiesModule, TenantsModule, ContractorsModule, NotesModule, LedgerModule, ExportsModule, TenanciesModule],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}

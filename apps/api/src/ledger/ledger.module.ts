import { Global, Module } from '@nestjs/common';
import { LedgerService } from './ledger.service.js';
import { LedgerController } from './ledger.controller.js';

@Global()
@Module({ controllers: [LedgerController], providers: [LedgerService], exports: [LedgerService] })
export class LedgerModule {}

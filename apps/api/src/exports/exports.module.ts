import { Global, Module } from '@nestjs/common';
import { ExportsController } from './exports.controller.js';
import { ExportsService } from './exports.service.js';

@Global()
@Module({ controllers: [ExportsController], providers: [ExportsService], exports: [ExportsService] })
export class ExportsModule {}

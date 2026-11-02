import { Module } from '@nestjs/common';
import { TenanciesController } from './tenancies.controller.js';
import { TenanciesService } from './tenancies.service.js';

@Module({ controllers: [TenanciesController], providers: [TenanciesService], exports: [TenanciesService] })
export class TenanciesModule {}

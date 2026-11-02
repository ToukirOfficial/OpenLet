import { Module } from '@nestjs/common';
import { ContractorJobController, RepairsController } from './repairs.controller.js';
import { ContractorJobService } from './contractor-job.service.js';
import { RepairsService } from './repairs.service.js';

@Module({ controllers: [RepairsController, ContractorJobController], providers: [RepairsService, ContractorJobService], exports: [RepairsService] })
export class RepairsModule {}

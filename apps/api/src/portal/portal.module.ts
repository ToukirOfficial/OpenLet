import { Module } from '@nestjs/common';
import { RepairsModule } from '../repairs/repairs.module.js';
import { PortalController } from './portal.controller.js';
import { PortalService } from './portal.service.js';

@Module({ imports: [RepairsModule], controllers: [PortalController], providers: [PortalService] })
export class PortalModule {}

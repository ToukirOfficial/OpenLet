import { Global, Module } from '@nestjs/common';
import { RemindersService } from './reminders.service.js';

@Global()
@Module({ providers: [RemindersService], exports: [RemindersService] })
export class RemindersModule {}

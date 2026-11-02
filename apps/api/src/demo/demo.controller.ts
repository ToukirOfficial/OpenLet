import { Controller, Get, HttpCode, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { ClientIp, Public } from '../common/decorators.js';
import { DemoService } from './demo.service.js';

const asParam = z.object({ as: z.enum(['landlord', 'tenant']) });

@Controller('demo')
@Public()
export class DemoController {
  constructor(private readonly demo: DemoService) {}

  @Get('info')
  info() {
    return this.demo.info();
  }

  @Post('login/:as')
  @HttpCode(200)
  login(@Param({ schema: asParam }) p: z.infer<typeof asParam>, @ClientIp() ip: string | null, @Res({ passthrough: true }) res: Response) {
    return this.demo.login(p.as, ip, res);
  }

  @Get('mail')
  mail() {
    return this.demo.mail();
  }
}

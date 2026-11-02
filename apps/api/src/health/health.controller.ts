import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators.js';
import { PrismaService } from '../prisma.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { ok: true };
  }
}

/** The same check at /api/health (outside the /api/v1 prefix), for uptime monitors and deploy scripts. */
@Controller('api/health')
export class PlainHealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { ok: true };
  }
}

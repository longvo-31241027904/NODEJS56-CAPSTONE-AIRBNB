import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../modules-system/prisma/prisma.service';
@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}
  @Get()
  @ApiOkResponse({ description: 'Application is running' })
  application() {
    return { application: 'up' };
  }
  @Get('database')
  @ApiOkResponse({ description: 'Database query succeeded' })
  @ApiServiceUnavailableResponse({ description: 'Database unavailable' })
  async database() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { database: 'up' };
    } catch {
      throw new ServiceUnavailableException();
    }
  }
}

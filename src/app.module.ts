import { Module } from '@nestjs/common';
import { PrismaModule } from './modules-system/prisma/prisma.module';
import { HealthController } from './modules-api/health/health.controller';
import { UsersModule } from './modules-api/users/users.module';
import { CatalogModule } from './modules-api/catalog/catalog.module';
import { StaysModule } from './modules-api/stays/stays.module';
@Module({
  imports: [PrismaModule, UsersModule, CatalogModule, StaysModule],
  controllers: [HealthController],
})
export class AppModule {}

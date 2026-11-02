import { Module } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { LocationController, RoomController } from './catalog.controller';
import { ImageStorage } from '../../common/helpers/image-storage';
import { JwtGuard } from '../../common/guard/jwt.guard';
@Module({
  controllers: [LocationController, RoomController],
  providers: [CatalogService, ImageStorage, JwtGuard],
})
export class CatalogModule {}

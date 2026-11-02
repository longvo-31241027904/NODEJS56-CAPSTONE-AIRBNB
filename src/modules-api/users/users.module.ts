import { ImageStorage } from '../../common/helpers/image-storage';
import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AuthController } from '../auth/auth.controller';
import { JwtGuard } from '../../common/guard/jwt.guard';
@Module({
  controllers: [UsersController, AuthController],
  providers: [UsersService, JwtGuard, ImageStorage],
})
export class UsersModule {}

import { Module } from '@nestjs/common';
import { JwtGuard } from '../../common/guard/jwt.guard';
import { BookingService } from './booking.service';
import { CommentService } from './comment.service';
import { BookingController, CommentController } from './stays.controller';
@Module({
  controllers: [BookingController, CommentController],
  providers: [BookingService, CommentService, JwtGuard],
})
export class StaysModule {}

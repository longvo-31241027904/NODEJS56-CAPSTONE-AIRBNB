import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Req,
  UseGuards,
  applyDecorators,
} from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { JwtGuard, AdminOnly } from '../../common/guard/jwt.guard';
import { BookingService } from './booking.service';
import { CommentService } from './comment.service';
import {
  BookingDto,
  UpdateBookingDto,
  CommentDto,
  UpdateCommentDto,
  RoomPath,
  UserPath,
} from './stays.dto';
import { CatalogId } from '../catalog/catalog.dto';
import { CommentResponseDto } from './stays.response';
function Protected() {
  return applyDecorators(
    UseGuards(JwtGuard),
    ApiSecurity('token'),
    ApiResponse({ status: 401, description: 'JWT missing/invalid/expired' }),
    ApiResponse({ status: 403, description: 'Ownership/role denied' }),
  );
}
function Result(model: typeof BookingDto | typeof CommentDto, status = 200, array = false) {
  const record = { $ref: getSchemaPath(model) };
  return ApiResponse({
    status,
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        statusCode: { type: 'integer', example: status },
        data: array ? { type: 'array', items: record } : record,
      },
    },
    description:
      'Safe record; comments include only author id/name/avatar; date-times serialized as UTC ISO-8601',
  });
}
@ApiExtraModels(BookingDto)
@ApiTags('DatPhong')
@ApiResponse({ status: 400, description: 'Invalid fields, interval or guest count' })
@ApiResponse({ status: 404, description: 'Booking, room or user not found' })
@ApiResponse({
  status: 409,
  description: 'Overlapping booking, FK conflict or bounded concurrent retry exhausted',
})
@Controller('dat-phong')
@Protected()
export class BookingController {
  constructor(private readonly service: BookingService) {}
  @Get()
  @AdminOnly()
  @Result(BookingDto, 200, true)
  @ApiOperation({ summary: 'ADMIN: list all bookings' })
  list() {
    return this.service.list();
  }
  @Post()
  @Result(BookingDto, 201)
  @ApiOperation({
    summary: 'Create booking; owner or ADMIN',
    description:
      'Half-open [ngayDen,ngayDi), adjacent bookings allowed. Explicit timezone required, UTC storage. Past dates allowed. Same-room writes serialized in MySQL; overlap returns 409.',
  })
  create(@Body() dto: BookingDto, @Req() req: AuthenticatedRequest) {
    return this.service.create(dto, req.user);
  }
  @Get('lay-theo-nguoi-dung/:MaNguoiDung')
  @Result(BookingDto, 200, true)
  @ApiOperation({ summary: 'Owner or ADMIN: bookings by user' })
  byUser(@Param() params: UserPath, @Req() req: AuthenticatedRequest) {
    return this.service.byUser(params.MaNguoiDung, req.user);
  }
  @Get(':id')
  @Result(BookingDto)
  @ApiOperation({ summary: 'Owner or ADMIN: booking detail' })
  detail(@Param() params: CatalogId, @Req() req: AuthenticatedRequest) {
    return this.service.detail(params.id, req.user);
  }
  @Put(':id')
  @Result(BookingDto)
  @ApiOperation({
    summary: 'Owner or ADMIN: update booking',
    description:
      'Allowed partial fields; merged interval/capacity/availability revalidated. USER cannot transfer ownership. Same booking excluded from overlap check.',
  })
  update(
    @Param() params: CatalogId,
    @Body() dto: UpdateBookingDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.update(params.id, dto, req.user);
  }
  @Delete(':id')
  @ApiResponse({
    status: 200,
    description: 'data: {deleted:true}; physical deletion, no payment/cancellation state',
  })
  @ApiOperation({ summary: 'Owner or ADMIN: delete booking' })
  remove(@Param() params: CatalogId, @Req() req: AuthenticatedRequest) {
    return this.service.remove(params.id, req.user);
  }
}
@ApiExtraModels(CommentDto, CommentResponseDto)
@ApiTags('BinhLuan')
@ApiResponse({ status: 400, description: 'Invalid fields, blank comment or stars outside 1..5' })
@ApiResponse({ status: 404, description: 'Room or comment not found' })
@ApiResponse({ status: 409, description: 'Referenced record changed/deleted' })
@Controller('binh-luan')
export class CommentController {
  constructor(private readonly service: CommentService) {}
  @Get()
  @Result(CommentResponseDto, 200, true)
  @ApiOperation({ summary: 'Public: list comments with minimal author info' })
  list() {
    return this.service.list();
  }
  @Get('lay-binh-luan-theo-phong/:MaPhong')
  @Result(CommentResponseDto, 200, true)
  @ApiOperation({ summary: 'Public: comments by room' })
  byRoom(@Param() params: RoomPath) {
    return this.service.byRoom(params.MaPhong);
  }
  @Post()
  @Protected()
  @Result(CommentResponseDto, 201)
  @ApiOperation({
    summary: 'Authenticated: create own comment',
    description:
      'No prior-stay or one-comment restriction. ngayBinhLuan request ignored; server supplies current creation time.',
  })
  create(@Body() dto: CommentDto, @Req() req: AuthenticatedRequest) {
    return this.service.create(dto, req.user);
  }
  @Put(':id')
  @Protected()
  @Result(CommentResponseDto)
  @ApiOperation({
    summary: 'Author or ADMIN: edit comment',
    description:
      'Cannot change author. ngayBinhLuan request ignored; original creation time preserved.',
  })
  update(
    @Param() params: CatalogId,
    @Body() dto: UpdateCommentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.change(params.id, req.user, dto);
  }
  @Delete(':id')
  @Protected()
  @ApiResponse({ status: 200, description: 'data: {deleted:true}' })
  @ApiOperation({ summary: 'Author or ADMIN: delete comment' })
  remove(@Param() params: CatalogId, @Req() req: AuthenticatedRequest) {
    return this.service.change(params.id, req.user);
  }
}

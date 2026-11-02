import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { UserEnvelopeDto, UserListEnvelopeDto, PagingEnvelopeDto } from './dto/response.dto';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtGuard, AdminOnly } from '../../common/guard/jwt.guard';
import { UsersService } from './users.service';
import { CreateUserDto, EmptyDto, IdQueryDto, PagingDto, UpdateUserDto } from './dto/user.dto';
import { Type } from 'class-transformer';
import { IsInt, Min, Max, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
class UserIdParam {
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) @Max(2147483647) id!: number;
}
class SearchParam {
  @ApiProperty() @IsString() @Length(1, 255) TenNguoiDung!: string;
}
@ApiTags('Users')
@ApiSecurity('token')
@ApiResponse({ status: 400, description: 'Invalid input, extra fields or malformed ID' })
@ApiResponse({
  status: 401,
  description: 'Missing, conflicting, invalid, expired token or deleted account',
})
@ApiResponse({ status: 403, description: 'Insufficient role or ownership' })
@ApiResponse({ status: 404, description: 'User not found' })
@ApiResponse({ status: 409, description: 'Email conflict or related records prevent deletion' })
@UseGuards(JwtGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}
  @Get()
  @AdminOnly()
  @ApiOperation({ summary: 'ADMIN: list users' })
  @ApiResponse({
    status: 200,
    type: UserListEnvelopeDto,
    description: 'Success envelope with safe user array',
  })
  list(@Query() _query: EmptyDto) {
    return this.users.list();
  }
  @Post()
  @AdminOnly()
  @ApiOperation({ summary: 'ADMIN: create USER or ADMIN; database generates ID' })
  @ApiResponse({
    status: 201,
    type: UserEnvelopeDto,
    description: 'Success envelope with safe user',
  })
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto, true);
  }
  @Delete()
  @AdminOnly()
  @ApiOperation({ summary: 'ADMIN: delete by query id; related records block deletion' })
  @ApiResponse({ status: 200, description: 'data: { deleted: true }' })
  remove(@Query() query: IdQueryDto, @Req() req: AuthenticatedRequest) {
    return this.users.remove(query.id, req.user);
  }
  @Get('phan-trang-tim-kiem')
  @AdminOnly()
  @ApiOperation({ summary: 'ADMIN: name search and paging, ordered by id' })
  @ApiResponse({
    status: 200,
    type: PagingEnvelopeDto,
    description: 'data: { items, totalItems, totalPages, pageIndex, pageSize }',
  })
  page(@Query() query: PagingDto) {
    return this.users.page(query);
  }
  @Get('search/:TenNguoiDung')
  @AdminOnly()
  @ApiOperation({ summary: 'ADMIN: find names containing TenNguoiDung' })
  @ApiResponse({
    status: 200,
    type: UserListEnvelopeDto,
    description: 'Success envelope with safe user array',
  })
  search(@Param() params: SearchParam) {
    return this.users.list(params.TenNguoiDung);
  }
  @Post('upload-avatar')
  @ApiOperation({ summary: 'Authenticated account: upload own avatar (max 2 MiB, JPEG/PNG/WebP)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['formFile'],
      properties: { formFile: { type: 'string', format: 'binary' } },
    },
  })
  @ApiResponse({
    status: 201,
    type: UserEnvelopeDto,
    description: 'Safe user with publicly accessible avatar URL',
  })
  @ApiResponse({ status: 413, description: 'File exceeds 2 MiB' })
  @ApiResponse({ status: 415, description: 'Unsupported or invalid image content' })
  @UseInterceptors(
    FileInterceptor('formFile', { limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 0 } }),
  )
  avatar(@Req() req: AuthenticatedRequest, @UploadedFile() file?: Express.Multer.File) {
    return this.users.avatar(req.user.id, file);
  }
  @Get(':id')
  @ApiOperation({ summary: 'Owner or ADMIN: user detail' })
  @ApiResponse({
    status: 200,
    type: UserEnvelopeDto,
    description: 'Success envelope with safe user',
  })
  detail(@Param() params: UserIdParam, @Req() req: AuthenticatedRequest) {
    return this.users.detail(params.id, req.user);
  }
  @Put(':id')
  @ApiOperation({
    summary: 'Owner or ADMIN: update allowed profile fields; only ADMIN may assign role',
  })
  @ApiResponse({
    status: 200,
    type: UserEnvelopeDto,
    description: 'Success envelope with safe user',
  })
  update(
    @Param() params: UserIdParam,
    @Body() dto: UpdateUserDto,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!Object.keys(dto).length)
      throw new BadRequestException('At least one profile field is required');
    return this.users.update(params.id, dto, req.user);
  }
}

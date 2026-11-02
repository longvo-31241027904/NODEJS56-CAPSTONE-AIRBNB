import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  applyDecorators,
} from '@nestjs/common';
import {
  ApiTags,
  ApiSecurity,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
  ApiExtraModels,
  getSchemaPath,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtGuard, AdminOnly } from '../../common/guard/jwt.guard';
import { CatalogService } from './catalog.service';
import {
  LocationDto,
  UpdateLocationDto,
  RoomDto,
  UpdateRoomDto,
  CatalogId,
  LocationQuery,
  RoomQuery,
} from './catalog.dto';
import { PagingDto, EmptyDto } from '../users/dto/user.dto';
function Admin() {
  return applyDecorators(
    UseGuards(JwtGuard),
    AdminOnly(),
    ApiSecurity('token'),
    ApiResponse({ status: 401, description: 'Missing, conflicting or invalid JWT' }),
    ApiResponse({ status: 403, description: 'ADMIN required' }),
  );
}
function ImageBody() {
  return applyDecorators(
    ApiConsumes('multipart/form-data'),
    ApiBody({
      schema: {
        type: 'object',
        required: ['formFile'],
        properties: { formFile: { type: 'string', format: 'binary' } },
      },
    }),
    ApiResponse({ status: 413, description: 'Maximum 2 MiB' }),
    ApiResponse({ status: 415, description: 'Invalid JPEG/PNG/WebP content' }),
  );
}

@ApiExtraModels(LocationDto)
@ApiTags('ViTri')
@ApiResponse({ status: 400, description: 'Invalid input or additional fields' })
@ApiResponse({ status: 404, description: 'Record or referenced location not found' })
@ApiResponse({ status: 409, description: 'Foreign key or related records conflict' })
@Controller('vi-tri')
export class LocationController {
  constructor(private readonly catalog: CatalogService) {}
  @Get()
  @ApiOperation({ summary: 'Public: list locations, ordered by id' })
  @ApiResponse({
    status: 200,
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        statusCode: { type: 'integer' },
        data: { type: 'array', items: { $ref: getSchemaPath(LocationDto) } },
      },
    },
    description: 'Success envelope; data is record array',
  })
  list(@Query() _query: EmptyDto) {
    return this.catalog.list('location');
  }
  @Post()
  @Admin()
  @ApiOperation({ summary: 'ADMIN: create location; database generates ID' })
  @ApiResponse({
    status: 201,
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        statusCode: { type: 'integer' },
        data: { $ref: getSchemaPath(LocationDto) },
      },
    },
    description: 'Success envelope with created record',
  })
  create(@Body() dto: LocationDto) {
    return this.catalog.createLocation(dto);
  }
  @Get('phan-trang-tim-kiem')
  @ApiOperation({ summary: 'Public: name search/paging, defaults 1/10, max pageSize 100' })
  @ApiResponse({
    status: 200,
    description: 'data: {items,totalItems,totalPages,pageIndex,pageSize}',
  })
  page(@Query() query: PagingDto) {
    return this.catalog.page('location', query);
  }
  @Post('upload-hinh-vitri')
  @Admin()
  @ImageBody()
  @ApiOperation({ summary: 'ADMIN: upload image; only formFile, 2 MiB, JPEG/PNG/WebP' })
  @ApiResponse({
    status: 201,
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        statusCode: { type: 'integer' },
        data: { $ref: getSchemaPath(LocationDto) },
      },
    },
    description: 'Updated record with accessible hinhAnh URL',
  })
  @UseInterceptors(
    FileInterceptor('formFile', { limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 0 } }),
  )
  image(@Query() query: LocationQuery, @UploadedFile() file?: Express.Multer.File) {
    return this.catalog.image('location', query.maViTri, file);
  }
  @Get(':id')
  @ApiOperation({ summary: 'Public: location detail' })
  @ApiResponse({
    status: 200,
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        statusCode: { type: 'integer' },
        data: { $ref: getSchemaPath(LocationDto) },
      },
    },
    description: 'Success envelope with record',
  })
  detail(@Param() params: CatalogId) {
    return this.catalog.detail('location', params.id);
  }
  @Put(':id')
  @Admin()
  @ApiOperation({ summary: 'ADMIN: update location; body id must match path; only allowed fields' })
  @ApiResponse({
    status: 200,
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        statusCode: { type: 'integer' },
        data: { $ref: getSchemaPath(LocationDto) },
      },
    },
    description: 'Success envelope with updated record',
  })
  update(@Param() params: CatalogId, @Body() dto: UpdateLocationDto) {
    return this.catalog.updateLocation(params.id, dto);
  }
  @Delete(':id')
  @Admin()
  @ApiOperation({ summary: 'ADMIN: delete location; restricted when related data exists' })
  @ApiResponse({ status: 200, description: 'data: {deleted:true}' })
  remove(@Param() params: CatalogId) {
    return this.catalog.remove('location', params.id);
  }
}

@ApiExtraModels(RoomDto)
@ApiTags('Phong')
@ApiResponse({ status: 400, description: 'Invalid input or additional fields' })
@ApiResponse({ status: 404, description: 'Record or referenced location not found' })
@ApiResponse({ status: 409, description: 'Foreign key or related records conflict' })
@Controller('phong-thue')
export class RoomController {
  constructor(private readonly catalog: CatalogService) {}
  @Get()
  @ApiOperation({ summary: 'Public: list rooms, ordered by id' })
  @ApiResponse({
    status: 200,
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        statusCode: { type: 'integer' },
        data: { type: 'array', items: { $ref: getSchemaPath(RoomDto) } },
      },
    },
    description: 'Success envelope; data is record array',
  })
  list(@Query() _query: EmptyDto) {
    return this.catalog.list('room');
  }
  @Post()
  @Admin()
  @ApiOperation({ summary: 'ADMIN: create room; database generates ID' })
  @ApiResponse({
    status: 201,
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        statusCode: { type: 'integer' },
        data: { $ref: getSchemaPath(RoomDto) },
      },
    },
    description: 'Success envelope with created record',
  })
  create(@Body() dto: RoomDto) {
    return this.catalog.createRoom(dto);
  }
  @Get('phan-trang-tim-kiem')
  @ApiOperation({ summary: 'Public: name search/paging, defaults 1/10, max pageSize 100' })
  @ApiResponse({
    status: 200,
    description: 'data: {items,totalItems,totalPages,pageIndex,pageSize}',
  })
  page(@Query() query: PagingDto) {
    return this.catalog.page('room', query);
  }
  @Get('lay-phong-theo-vi-tri')
  @ApiOperation({ summary: 'Public: rooms at maViTri' })
  @ApiResponse({ status: 200, description: 'Success envelope with room array' })
  byLocation(@Query() query: LocationQuery) {
    return this.catalog.byLocation(query.maViTri);
  }
  @Post('upload-hinh-phong')
  @Admin()
  @ImageBody()
  @ApiOperation({ summary: 'ADMIN: upload image; only formFile, 2 MiB, JPEG/PNG/WebP' })
  @ApiResponse({
    status: 201,
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        statusCode: { type: 'integer' },
        data: { $ref: getSchemaPath(RoomDto) },
      },
    },
    description: 'Updated record with accessible hinhAnh URL',
  })
  @UseInterceptors(
    FileInterceptor('formFile', { limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 0 } }),
  )
  image(@Query() query: RoomQuery, @UploadedFile() file?: Express.Multer.File) {
    return this.catalog.image('room', query.maPhong, file);
  }
  @Get(':id')
  @ApiOperation({ summary: 'Public: room detail' })
  @ApiResponse({
    status: 200,
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        statusCode: { type: 'integer' },
        data: { $ref: getSchemaPath(RoomDto) },
      },
    },
    description: 'Success envelope with record',
  })
  detail(@Param() params: CatalogId) {
    return this.catalog.detail('room', params.id);
  }
  @Put(':id')
  @Admin()
  @ApiOperation({ summary: 'ADMIN: update room; body id must match path; only allowed fields' })
  @ApiResponse({
    status: 200,
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        statusCode: { type: 'integer' },
        data: { $ref: getSchemaPath(RoomDto) },
      },
    },
    description: 'Success envelope with updated record',
  })
  update(@Param() params: CatalogId, @Body() dto: UpdateRoomDto) {
    return this.catalog.updateRoom(params.id, dto);
  }
  @Delete(':id')
  @Admin()
  @ApiOperation({ summary: 'ADMIN: delete room; restricted when related data exists' })
  @ApiResponse({ status: 200, description: 'data: {deleted:true}' })
  remove(@Param() params: CatalogId) {
    return this.catalog.remove('room', params.id);
  }
}

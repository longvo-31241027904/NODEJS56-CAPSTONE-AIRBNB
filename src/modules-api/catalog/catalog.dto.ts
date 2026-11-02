import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, Length, IsInt, Min, Max, IsBoolean, ValidateIf, IsUrl } from 'class-validator';
import { Type } from 'class-transformer';
export class LocationDto {
  @ApiPropertyOptional()
  @ValidateIf((_o, v) => v !== undefined)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  id?: number;
  @ApiProperty({ example: 'Demo' }) @IsString() @Length(1, 255) tenViTri!: string;
  @ApiProperty({ example: 'Demo' }) @IsString() @Length(1, 255) tinhThanh!: string;
  @ApiProperty({ example: 'Demo' }) @IsString() @Length(1, 255) quocGia!: string;
  @ApiPropertyOptional()
  @ValidateIf((_o, v) => v !== undefined)
  @IsUrl({ require_tld: false, protocols: ['http', 'https'], require_protocol: true })
  @Length(1, 2048)
  hinhAnh?: string;
}
export class UpdateLocationDto extends PartialType(LocationDto, { skipNullProperties: false }) {}
export class RoomDto {
  @ApiPropertyOptional()
  @ValidateIf((_o, v) => v !== undefined)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  id?: number;
  @ApiProperty({ example: 'Demo room' }) @IsString() @Length(1, 255) tenPhong!: string;
  @ApiProperty({ example: 'Demo room' }) @IsString() @Length(1, 10000) moTa!: string;
  @ApiProperty({ example: 1 }) @IsInt() @Min(1) @Max(2147483647) khach!: number;
  @ApiProperty({ example: 1 }) @IsInt() @Min(0) @Max(2147483647) phongNgu!: number;
  @ApiProperty({ example: 1 }) @IsInt() @Min(0) @Max(2147483647) giuong!: number;
  @ApiProperty({ example: 1 }) @IsInt() @Min(0) @Max(2147483647) phongTam!: number;
  @ApiProperty({ example: 1 }) @IsInt() @Min(0) @Max(2147483647) giaTien!: number;
  @ApiProperty({ example: 1 }) @IsInt() @Min(1) @Max(2147483647) maViTri!: number;
  @ApiProperty({ example: false }) @IsBoolean() mayGiat!: boolean;
  @ApiProperty({ example: false }) @IsBoolean() banLa!: boolean;
  @ApiProperty({ example: false }) @IsBoolean() tivi!: boolean;
  @ApiProperty({ example: false }) @IsBoolean() dieuHoa!: boolean;
  @ApiProperty({ example: false }) @IsBoolean() wifi!: boolean;
  @ApiProperty({ example: false }) @IsBoolean() bep!: boolean;
  @ApiProperty({ example: false }) @IsBoolean() doXe!: boolean;
  @ApiProperty({ example: false }) @IsBoolean() hoBoi!: boolean;
  @ApiProperty({ example: false }) @IsBoolean() banUi!: boolean;
  @ApiPropertyOptional()
  @ValidateIf((_o, v) => v !== undefined)
  @IsUrl({ require_tld: false, protocols: ['http', 'https'], require_protocol: true })
  @Length(1, 2048)
  hinhAnh?: string;
}
export class UpdateRoomDto extends PartialType(RoomDto, { skipNullProperties: false }) {}
export class CatalogId {
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) @Max(2147483647) id!: number;
}
export class LocationQuery {
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) @Max(2147483647) maViTri!: number;
}
export class RoomQuery {
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) @Max(2147483647) maPhong!: number;
}

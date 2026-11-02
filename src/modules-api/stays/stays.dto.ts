import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, Min, Max, IsString, Length, IsISO8601, Matches, ValidateIf } from 'class-validator';
export class BookingDto {
  @ApiPropertyOptional({
    example: 0,
    description: 'Database generates id on create; on PUT must match path',
  })
  @ValidateIf((_o, v) => v !== undefined)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  id?: number;
  @ApiProperty({ example: 1 }) @IsInt() @Min(1) @Max(2147483647) maPhong!: number;
  @ApiProperty({
    example: '2030-01-10T07:00:00Z',
    description:
      'Timezone required; milliseconds maximum 3 digits. UTC storage; past dates permitted.',
  })
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/)
  ngayDen!: string;
  @ApiProperty({
    example: '2030-01-12T07:00:00Z',
    description: 'Exclusive end of [ngayDen,ngayDi)',
  })
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/)
  ngayDi!: string;
  @ApiProperty({ example: 1 }) @IsInt() @Min(1) @Max(2147483647) soLuongKhach!: number;
  @ApiProperty({
    example: 1,
    description: 'USER must match JWT; ADMIN may select an existing user',
  })
  @IsInt()
  @Min(1)
  @Max(2147483647)
  maNguoiDung!: number;
}
export class UpdateBookingDto extends PartialType(BookingDto, { skipNullProperties: false }) {}
export class CommentDto {
  @ApiPropertyOptional({ example: 0 })
  @ValidateIf((_o, v) => v !== undefined)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  id?: number;
  @ApiProperty({ example: 1 }) @IsInt() @Min(1) @Max(2147483647) maPhong!: number;
  @ApiProperty({ example: 1, description: 'Must match authenticated author; cannot change on PUT' })
  @IsInt()
  @Min(1)
  @Max(2147483647)
  maNguoiBinhLuan!: number;
  @ApiPropertyOptional({
    description:
      'Accepted for Swagger compatibility but ignored; server determines creation date, PUT preserves it',
  })
  @ValidateIf((_o, v) => v !== undefined)
  @IsString()
  @Length(0, 100)
  ngayBinhLuan?: string;
  @ApiProperty({ example: 'Phong sach va dep' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 10000)
  noiDung!: string;
  @ApiProperty({ example: 5, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  saoBinhLuan!: number;
}
export class UpdateCommentDto extends PartialType(CommentDto, { skipNullProperties: false }) {}
export class UserPath {
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) @Max(2147483647) MaNguoiDung!: number;
}
export class RoomPath {
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) @Max(2147483647) MaPhong!: number;
}

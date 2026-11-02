import { ApiProperty, ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  registerDecorator,
} from 'class-validator';

export function Birthday() {
  return (target: object, propertyName: string) =>
    registerDecorator({
      name: 'birthday',
      target: target.constructor,
      propertyName,
      validator: {
        validate: (v: unknown) =>
          typeof v === 'string' &&
          /^\d{4}-\d{2}-\d{2}$/.test(v) &&
          Number(v.slice(0, 4)) >= 1900 &&
          Number.isFinite(Date.parse(v)) &&
          new Date(v).toISOString().slice(0, 10) === v &&
          v <= new Date().toISOString().slice(0, 10),
        defaultMessage: () => 'birthday must be a real date YYYY-MM-DD, from 1900 through today',
      },
    });
}
export class SignupDto {
  @ApiPropertyOptional({
    example: 0,
    description: 'Accepted for compatibility; database generates ID',
  })
  @ValidateIf((_o, v) => v !== undefined)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  id?: number;
  @ApiProperty({ example: 'Nguyen An' }) @IsString() @Length(1, 255) name!: string;
  @ApiProperty({ example: 'an@example.test' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(255)
  email!: string;
  @ApiProperty({ minLength: 12, maxLength: 72, example: 'Demo-password-2026' })
  @IsString()
  @Length(12, 72)
  password!: string;
  @ApiProperty({ example: '0901234567' }) @IsString() @Length(1, 30) phone!: string;
  @ApiPropertyOptional({ example: '2000-01-01' })
  @ValidateIf((_o, v) => v !== undefined)
  @Birthday()
  birthday?: string;
  @ApiProperty({ example: false }) @IsBoolean() gender!: boolean;
  @ApiPropertyOptional({ enum: ['USER', 'ADMIN'], description: 'Signup always stores USER' })
  @ValidateIf((_o, v) => v !== undefined)
  @IsIn(['USER', 'ADMIN'])
  role?: 'USER' | 'ADMIN';
}
export class CreateUserDto extends SignupDto {
  @ApiPropertyOptional({
    enum: ['USER', 'ADMIN'],
    description: 'ADMIN can create either role; default USER',
  })
  declare role?: 'USER' | 'ADMIN';
}
export class UpdateUserDto extends PartialType(OmitType(SignupDto, ['password'] as const), {
  skipNullProperties: false,
}) {}
export class SigninDto {
  @ApiProperty({ example: 'an@example.test' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(255)
  email!: string;
  @ApiProperty({ example: 'Demo-password-2026' }) @IsString() @Length(1, 72) password!: string;
}
export class IdQueryDto {
  @ApiProperty({ minimum: 1 }) @Type(() => Number) @IsInt() @Min(1) @Max(2147483647) id!: number;
}
export class PagingDto {
  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  pageIndex = 1;
  @ApiPropertyOptional({ default: 10, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 10;
  @ApiPropertyOptional()
  @ValidateIf((_o, v) => v !== undefined)
  @IsString()
  @MaxLength(255)
  keyword?: string;
}
export class EmptyDto {}

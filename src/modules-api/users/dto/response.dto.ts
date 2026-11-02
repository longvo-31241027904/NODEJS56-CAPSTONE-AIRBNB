import { ApiProperty } from '@nestjs/swagger';
export class SafeUserDto {
  @ApiProperty({ example: 1 }) id!: number;
  @ApiProperty({ example: 'Nguyen An' }) name!: string;
  @ApiProperty({ example: 'an@example.test' }) email!: string;
  @ApiProperty({ example: '0901234567' }) phone!: string;
  @ApiProperty({ example: '2000-01-01', nullable: true }) birthday!: string | null;
  @ApiProperty({ example: false }) gender!: boolean;
  @ApiProperty({ enum: ['USER', 'ADMIN'] }) role!: string;
  @ApiProperty({ example: 'http://localhost:3069/uploads/avatars/example.webp', nullable: true })
  avatar!: string | null;
}
export class UserEnvelopeDto {
  @ApiProperty({ example: 'success' }) status!: string;
  @ApiProperty({ example: 200 }) statusCode!: number;
  @ApiProperty({ type: SafeUserDto }) data!: SafeUserDto;
}
export class UserListEnvelopeDto {
  @ApiProperty({ example: 'success' }) status!: string;
  @ApiProperty({ example: 200 }) statusCode!: number;
  @ApiProperty({ type: [SafeUserDto] }) data!: SafeUserDto[];
}
class SigninDataDto {
  @ApiProperty({ description: 'HS256 JWT, expires in 3600 seconds' }) token!: string;
  @ApiProperty({ type: SafeUserDto }) user!: SafeUserDto;
}
export class SigninEnvelopeDto {
  @ApiProperty({ example: 'success' }) status!: string;
  @ApiProperty({ example: 200 }) statusCode!: number;
  @ApiProperty({ type: SigninDataDto }) data!: SigninDataDto;
}
class PagingDataDto {
  @ApiProperty({ type: [SafeUserDto] }) items!: SafeUserDto[];
  @ApiProperty({ example: 12 }) totalItems!: number;
  @ApiProperty({ example: 2 }) totalPages!: number;
  @ApiProperty({ example: 1 }) pageIndex!: number;
  @ApiProperty({ example: 10 }) pageSize!: number;
}
export class PagingEnvelopeDto {
  @ApiProperty({ example: 'success' }) status!: string;
  @ApiProperty({ example: 200 }) statusCode!: number;
  @ApiProperty({ type: PagingDataDto }) data!: PagingDataDto;
}

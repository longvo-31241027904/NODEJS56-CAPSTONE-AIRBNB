import { ApiProperty } from '@nestjs/swagger';
import { CommentDto } from './stays.dto';
class PublicAuthorDto {
  @ApiProperty({ example: 1 }) id!: number;
  @ApiProperty({ example: 'Nguyen An' }) name!: string;
  @ApiProperty({ type: String, nullable: true, example: null }) avatar!: string | null;
}
export class CommentResponseDto extends CommentDto {
  @ApiProperty({
    type: PublicAuthorDto,
    description: 'Only id/name/avatar; no contact details or password',
  })
  nguoiDung!: PublicAuthorDto;
}

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../modules-system/prisma/prisma.service';
import { databaseError } from '../../common/helpers/database-error';
import { CommentDto, UpdateCommentDto } from './stays.dto';
import { Actor } from './booking.service';
const publicAuthor = { nguoiDung: { select: { id: true, name: true, avatar: true } } } as const;
@Injectable()
export class CommentService {
  constructor(private readonly prisma: PrismaService) {}
  async list() {
    return this.prisma.binhLuan.findMany({ include: publicAuthor, orderBy: { id: 'asc' } });
  }
  async byRoom(id: number) {
    if (!(await this.prisma.phong.findUnique({ where: { id }, select: { id: true } })))
      throw new NotFoundException('Room not found');
    return this.prisma.binhLuan.findMany({
      where: { maPhong: id },
      include: publicAuthor,
      orderBy: { id: 'asc' },
    });
  }
  async create(dto: CommentDto, actor: Actor) {
    if (dto.maNguoiBinhLuan !== actor.id) throw new ForbiddenException('Author must match JWT');
    if (!(await this.prisma.phong.findUnique({ where: { id: dto.maPhong }, select: { id: true } })))
      throw new NotFoundException('Room not found');
    try {
      return await this.prisma.binhLuan.create({
        data: {
          maPhong: dto.maPhong,
          maNguoiBinhLuan: actor.id,
          noiDung: dto.noiDung,
          saoBinhLuan: dto.saoBinhLuan,
          ngayBinhLuan: new Date(),
        },
        include: publicAuthor,
      });
    } catch (error) {
      databaseError(error, 'Referenced room or author is unavailable');
    }
  }
  async change(id: number, actor: Actor, dto?: UpdateCommentDto) {
    if (dto?.id !== undefined && dto.id !== id)
      throw new BadRequestException('Body id must match path');
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM BinhLuan WHERE id = ${id} FOR UPDATE`;
          const old = await tx.binhLuan.findUnique({ where: { id } });
          if (!old) throw new NotFoundException('Comment not found');
          if (actor.role !== 'ADMIN' && old.maNguoiBinhLuan !== actor.id)
            throw new ForbiddenException('Access denied');
          if (!dto) {
            await tx.binhLuan.delete({ where: { id } });
            return { deleted: true };
          }
          if (dto.maNguoiBinhLuan !== undefined && dto.maNguoiBinhLuan !== old.maNguoiBinhLuan)
            throw new ForbiddenException('Cannot change comment author');
          if (
            dto.maPhong !== undefined &&
            !(await tx.phong.findUnique({ where: { id: dto.maPhong }, select: { id: true } }))
          )
            throw new NotFoundException('Room not found');
          return tx.binhLuan.update({
            where: { id },
            data: {
              ...(dto.maPhong !== undefined ? { maPhong: dto.maPhong } : {}),
              ...(dto.noiDung !== undefined ? { noiDung: dto.noiDung } : {}),
              ...(dto.saoBinhLuan !== undefined ? { saoBinhLuan: dto.saoBinhLuan } : {}),
            },
            include: publicAuthor,
          });
        },
        { isolationLevel: 'ReadCommitted' },
      );
    } catch (error) {
      databaseError(error, 'Referenced room or author is unavailable');
    }
  }
}

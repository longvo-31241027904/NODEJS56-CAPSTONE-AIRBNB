import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../modules-system/prisma/prisma.service';
import { Prisma } from '../../modules-system/prisma/generated/prisma/client';
import { databaseError } from '../../common/helpers/database-error';
import { BookingDto, UpdateBookingDto } from './stays.dto';
export type Actor = { id: number; role: string };
@Injectable()
export class BookingService {
  constructor(private readonly prisma: PrismaService) {}
  private owner(actor: Actor, id: number) {
    if (actor.role !== 'ADMIN' && actor.id !== id) throw new ForbiddenException('Access denied');
  }
  private async transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.prisma.$transaction(work, {
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
          timeout: 10000,
          maxWait: 10000,
        });
      } catch (error) {
        const e = error as Prisma.PrismaClientKnownRequestError;
        const cause = (
          e.meta?.driverAdapterError as { cause?: { originalCode?: string } } | undefined
        )?.cause;
        const originalCode = cause?.originalCode ?? e.meta?.code;
        const retryable = e.code === 'P2034' || ['1213', '1205'].includes(String(originalCode));
        if (!retryable) databaseError(error, 'Referenced room or user is unavailable');
        if (attempt === 2) throw new ConflictException('Concurrent booking change; please retry');
        await new Promise((resolve) => setTimeout(resolve, 20 * (attempt + 1)));
      }
    }
    throw new ConflictException('Concurrent booking change');
  }
  private async lockRooms(tx: Prisma.TransactionClient, ids: number[]) {
    for (const id of [...new Set(ids)].sort((a, b) => a - b)) {
      const rows = await tx.$queryRaw<
        { id: number }[]
      >`SELECT id FROM Phong WHERE id = ${id} FOR UPDATE`;
      if (!rows.length) throw new NotFoundException('Room not found');
    }
  }
  private async actor(tx: Prisma.TransactionClient, input: Actor) {
    const user = await tx.nguoiDung.findUnique({
      where: { id: input.id },
      select: { id: true, role: true },
    });
    if (!user) throw new ForbiddenException('Account no longer available');
    return user;
  }
  private async validate(
    tx: Prisma.TransactionClient,
    data: {
      maPhong: number;
      maNguoiDung: number;
      ngayDen: Date;
      ngayDi: Date;
      soLuongKhach: number;
    },
    excludeId?: number,
  ) {
    const { ngayDen, ngayDi } = data;
    if (
      !Number.isFinite(+ngayDen) ||
      !Number.isFinite(+ngayDi) ||
      ngayDen.getUTCFullYear() < 1000 ||
      ngayDi.getUTCFullYear() > 9999 ||
      ngayDen >= ngayDi
    ) {
      throw new BadRequestException('ngayDen must precede ngayDi; dates must fit MySQL DATETIME');
    }
    const room = await tx.phong.findUnique({ where: { id: data.maPhong } });
    if (!room) throw new NotFoundException('Room not found');
    if (
      !Number.isInteger(data.soLuongKhach) ||
      data.soLuongKhach < 1 ||
      data.soLuongKhach > room.khach
    )
      throw new BadRequestException('Guest count exceeds room capacity');
    if (!(await tx.nguoiDung.findUnique({ where: { id: data.maNguoiDung }, select: { id: true } })))
      throw new NotFoundException('User not found');
    // READ COMMITTED: this read occurs after the room lock; it sees the preceding holder's commit.
    const overlap = await tx.datPhong.findFirst({
      where: {
        maPhong: data.maPhong,
        ngayDen: { lt: ngayDi },
        ngayDi: { gt: ngayDen },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (overlap) throw new ConflictException('Room is already booked for this interval');
  }
  async list() {
    return this.prisma.datPhong.findMany({ orderBy: { id: 'asc' } });
  }
  async detail(id: number, actor: Actor) {
    const booking = await this.prisma.datPhong.findUnique({ where: { id } });
    if (!booking) throw new NotFoundException('Booking not found');
    this.owner(actor, booking.maNguoiDung);
    return booking;
  }
  async byUser(id: number, actor: Actor) {
    this.owner(actor, id);
    if (!(await this.prisma.nguoiDung.findUnique({ where: { id }, select: { id: true } })))
      throw new NotFoundException('User not found');
    return this.prisma.datPhong.findMany({ where: { maNguoiDung: id }, orderBy: { id: 'asc' } });
  }
  async create(dto: BookingDto, input: Actor) {
    return this.transaction(async (tx) => {
      const actor = await this.actor(tx, input);
      this.owner(actor, dto.maNguoiDung);
      await this.lockRooms(tx, [dto.maPhong]);
      const data = {
        maPhong: dto.maPhong,
        maNguoiDung: dto.maNguoiDung,
        ngayDen: new Date(dto.ngayDen),
        ngayDi: new Date(dto.ngayDi),
        soLuongKhach: dto.soLuongKhach,
      };
      await this.validate(tx, data);
      return tx.datPhong.create({ data });
    });
  }
  async update(id: number, dto: UpdateBookingDto, input: Actor) {
    if (dto.id !== undefined && dto.id !== id)
      throw new BadRequestException('Body id must match path');
    return this.transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM DatPhong WHERE id = ${id} FOR UPDATE`;
      const old = await tx.datPhong.findUnique({ where: { id } });
      if (!old) throw new NotFoundException('Booking not found');
      const actor = await this.actor(tx, input);
      this.owner(actor, old.maNguoiDung);
      const data = {
        maPhong: dto.maPhong ?? old.maPhong,
        maNguoiDung: dto.maNguoiDung ?? old.maNguoiDung,
        ngayDen: dto.ngayDen ? new Date(dto.ngayDen) : old.ngayDen,
        ngayDi: dto.ngayDi ? new Date(dto.ngayDi) : old.ngayDi,
        soLuongKhach: dto.soLuongKhach ?? old.soLuongKhach,
      };
      this.owner(actor, data.maNguoiDung);
      await this.lockRooms(tx, [old.maPhong, data.maPhong]);
      await this.validate(tx, data, id);
      return tx.datPhong.update({ where: { id }, data });
    });
  }
  async remove(id: number, input: Actor) {
    return this.transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM DatPhong WHERE id = ${id} FOR UPDATE`;
      const old = await tx.datPhong.findUnique({ where: { id } });
      if (!old) throw new NotFoundException('Booking not found');
      this.owner(await this.actor(tx, input), old.maNguoiDung);
      await this.lockRooms(tx, [old.maPhong]);
      await tx.datPhong.delete({ where: { id } });
      return { deleted: true };
    });
  }
}

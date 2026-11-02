import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../modules-system/prisma/prisma.service';
import { ImageStorage } from '../../common/helpers/image-storage';
import { databaseError } from '../../common/helpers/database-error';
import { Prisma, ViTri, Phong } from '../../modules-system/prisma/generated/prisma/client';
import { LocationDto, RoomDto, UpdateLocationDto, UpdateRoomDto } from './catalog.dto';
import { PagingDto } from '../users/dto/user.dto';
type Kind = 'location' | 'room';
@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly images: ImageStorage,
  ) {}
  private locationData(dto: LocationDto): Prisma.ViTriCreateInput;
  private locationData(dto: UpdateLocationDto): Prisma.ViTriUpdateInput;
  private locationData(dto: UpdateLocationDto): Prisma.ViTriCreateInput | Prisma.ViTriUpdateInput {
    return {
      tenViTri: dto.tenViTri,
      tinhThanh: dto.tinhThanh,
      quocGia: dto.quocGia,
      hinhAnh: dto.hinhAnh,
    };
  }
  private roomData(dto: RoomDto): Prisma.PhongUncheckedCreateInput;
  private roomData(dto: UpdateRoomDto): Prisma.PhongUncheckedUpdateInput;
  private roomData(
    dto: UpdateRoomDto,
  ): Prisma.PhongUncheckedCreateInput | Prisma.PhongUncheckedUpdateInput {
    return {
      tenPhong: dto.tenPhong,
      khach: dto.khach,
      phongNgu: dto.phongNgu,
      giuong: dto.giuong,
      phongTam: dto.phongTam,
      moTa: dto.moTa,
      giaTien: dto.giaTien,
      mayGiat: dto.mayGiat,
      banLa: dto.banLa,
      tivi: dto.tivi,
      dieuHoa: dto.dieuHoa,
      wifi: dto.wifi,
      bep: dto.bep,
      doXe: dto.doXe,
      hoBoi: dto.hoBoi,
      banUi: dto.banUi,
      maViTri: dto.maViTri,
      hinhAnh: dto.hinhAnh,
    };
  }
  async list(kind: Kind) {
    return kind === 'location'
      ? this.prisma.viTri.findMany({ orderBy: { id: 'asc' } })
      : this.prisma.phong.findMany({ orderBy: { id: 'asc' } });
  }
  async detail(kind: Kind, id: number) {
    const value =
      kind === 'location'
        ? await this.prisma.viTri.findUnique({ where: { id } })
        : await this.prisma.phong.findUnique({ where: { id } });
    if (!value) throw new NotFoundException('Record not found');
    return value;
  }
  async page(kind: Kind, query: PagingDto) {
    const paging = {
      orderBy: { id: 'asc' as const },
      skip: (query.pageIndex - 1) * query.pageSize,
      take: query.pageSize,
    };
    const [items, totalItems] =
      kind === 'location'
        ? await this.prisma.$transaction([
            this.prisma.viTri.findMany({
              ...paging,
              where: { tenViTri: query.keyword ? { contains: query.keyword } : undefined },
            }),
            this.prisma.viTri.count({
              where: { tenViTri: query.keyword ? { contains: query.keyword } : undefined },
            }),
          ])
        : await this.prisma.$transaction([
            this.prisma.phong.findMany({
              ...paging,
              where: { tenPhong: query.keyword ? { contains: query.keyword } : undefined },
            }),
            this.prisma.phong.count({
              where: { tenPhong: query.keyword ? { contains: query.keyword } : undefined },
            }),
          ]);
    return {
      items,
      totalItems,
      totalPages: Math.ceil(totalItems / query.pageSize),
      pageIndex: query.pageIndex,
      pageSize: query.pageSize,
    };
  }
  async byLocation(id: number) {
    await this.detail('location', id);
    return this.prisma.phong.findMany({ where: { maViTri: id }, orderBy: { id: 'asc' } });
  }
  async createLocation(dto: LocationDto) {
    try {
      return await this.prisma.viTri.create({ data: this.locationData(dto) });
    } catch (error) {
      databaseError(error);
    }
  }
  async createRoom(dto: RoomDto) {
    await this.detail('location', dto.maViTri);
    try {
      return await this.prisma.phong.create({ data: this.roomData(dto) });
    } catch (error) {
      databaseError(error, 'Referenced location is unavailable');
    }
  }
  async updateLocation(id: number, dto: UpdateLocationDto) {
    this.checkUpdate(id, dto);
    await this.detail('location', id);
    try {
      return await this.prisma.viTri.update({ where: { id }, data: this.locationData(dto) });
    } catch (error) {
      databaseError(error);
    }
  }
  async updateRoom(id: number, dto: UpdateRoomDto) {
    this.checkUpdate(id, dto);
    await this.detail('room', id);
    if (dto.maViTri !== undefined) await this.detail('location', dto.maViTri);
    try {
      return await this.prisma.phong.update({ where: { id }, data: this.roomData(dto) });
    } catch (error) {
      databaseError(error, 'Referenced location is unavailable');
    }
  }
  private checkUpdate(id: number, dto: { id?: number }) {
    if (dto.id !== undefined && dto.id !== id)
      throw new BadRequestException('Body id must match path id');
    if (!Object.entries(dto).some(([key, value]) => key !== 'id' && value !== undefined))
      throw new BadRequestException('At least one editable field is required');
  }
  async remove(kind: Kind, id: number) {
    try {
      if (kind === 'location') await this.prisma.viTri.delete({ where: { id } });
      else await this.prisma.phong.delete({ where: { id } });
      return { deleted: true };
    } catch (error) {
      databaseError(
        error,
        kind === 'location' ? 'Location still has rooms' : 'Room has bookings or comments',
      );
    }
  }
  async image(kind: Kind, id: number, file?: Express.Multer.File) {
    await this.detail(kind, id);
    return this.images.replace<ViTri | Phong>(file, async (url) => {
      try {
        return await this.prisma.$transaction(async (tx) => {
          if (kind === 'location') {
            await tx.$queryRaw`SELECT id FROM ViTri WHERE id = ${id} FOR UPDATE`;
            const old = await tx.viTri.findUnique({ where: { id } });
            const data = await tx.viTri.update({ where: { id }, data: { hinhAnh: url } });
            return { oldUrl: old?.hinhAnh ?? null, data };
          }
          await tx.$queryRaw`SELECT id FROM Phong WHERE id = ${id} FOR UPDATE`;
          const old = await tx.phong.findUnique({ where: { id } });
          const data = await tx.phong.update({ where: { id }, data: { hinhAnh: url } });
          return { oldUrl: old?.hinhAnh ?? null, data };
        });
      } catch (error) {
        databaseError(error);
      }
    });
  }
}

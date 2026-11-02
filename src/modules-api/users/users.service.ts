import { databaseError } from '../../common/helpers/database-error';
import { ImageStorage } from '../../common/helpers/image-storage';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaService } from '../../modules-system/prisma/prisma.service';
import { environment } from '../../common/config/environment';
import { CreateUserDto, SignupDto, SigninDto, UpdateUserDto, PagingDto } from './dto/user.dto';
import { NguoiDung, Prisma } from '../../modules-system/prisma/generated/prisma/client';
type Actor = { id: number; role: string };
export function safeUser(user: Omit<NguoiDung, 'password'> | NguoiDung) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    birthday: user.birthday?.toISOString().slice(0, 10) ?? null,
    gender: user.gender,
    role: user.role,
    avatar: user.avatar,
  };
}
export function mapDatabaseError(error: unknown): never {
  return databaseError(error, 'User has related bookings or comments');
}
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly images: ImageStorage,
  ) {}
  async create(dto: SignupDto | CreateUserDto, admin = false) {
    if (Buffer.byteLength(dto.password, 'utf8') > 72)
      throw new BadRequestException('Password exceeds 72 UTF-8 bytes');
    const { id, birthday, role, password, ...data } = dto;
    try {
      return safeUser(
        await this.prisma.nguoiDung.create({
          data: {
            ...data,
            email: data.email.trim().toLowerCase(),
            password: await bcrypt.hash(password, 10),
            birthday: birthday ? new Date(`${birthday}T00:00:00Z`) : null,
            role: admin ? (role ?? 'USER') : 'USER',
          },
        }),
      );
    } catch (error) {
      mapDatabaseError(error);
    }
  }
  async signin(dto: SigninDto) {
    if (Buffer.byteLength(dto.password, 'utf8') > 72)
      throw new UnauthorizedException('Invalid email or password');
    const user = await this.prisma.nguoiDung.findUnique({
      where: { email: dto.email },
      omit: { password: false },
    });
    // Compare a valid dummy hash on missing email to avoid skipping the expensive bcrypt work.
    const hash = user?.password ?? '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
    const valid = await bcrypt.compare(dto.password, hash);
    if (!user || !valid) throw new UnauthorizedException('Invalid email or password');
    return {
      token: jwt.sign({}, environment.jwtSecret, {
        algorithm: 'HS256',
        subject: String(user.id),
        expiresIn: 3600,
        issuer: 'airbnb-backend',
        audience: 'airbnb-api',
      }),
      user: safeUser(user),
    };
  }
  checkOwner(actor: Actor, id: number) {
    if (actor.role !== 'ADMIN' && actor.id !== id) throw new ForbiddenException('Access denied');
  }
  async detail(id: number, actor: Actor) {
    this.checkOwner(actor, id);
    const user = await this.prisma.nguoiDung.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return safeUser(user);
  }
  async list(keyword?: string) {
    return (
      await this.prisma.nguoiDung.findMany({
        where: keyword ? { name: { contains: keyword } } : {},
        orderBy: { id: 'asc' },
      })
    ).map(safeUser);
  }
  async page(query: PagingDto) {
    const where = query.keyword ? { name: { contains: query.keyword } } : {};
    const [users, totalItems] = await this.prisma.$transaction([
      this.prisma.nguoiDung.findMany({
        where,
        orderBy: { id: 'asc' },
        skip: (query.pageIndex - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.nguoiDung.count({ where }),
    ]);
    return {
      items: users.map(safeUser),
      totalItems,
      totalPages: Math.ceil(totalItems / query.pageSize),
      pageIndex: query.pageIndex,
      pageSize: query.pageSize,
    };
  }
  async update(id: number, dto: UpdateUserDto, actor: Actor) {
    this.checkOwner(actor, id);
    if (dto.id !== undefined && dto.id !== id)
      throw new BadRequestException('Body id must match path id');
    if (actor.role !== 'ADMIN' && dto.role !== undefined)
      throw new ForbiddenException('Only ADMIN can set role');
    const { id: bodyId, birthday, ...data } = dto;
    const changes = {
      ...data,
      ...(birthday !== undefined ? { birthday: new Date(`${birthday}T00:00:00Z`) } : {}),
    };
    if (dto.role !== undefined) return this.adminMutation(id, actor, changes);
    try {
      return safeUser(await this.prisma.nguoiDung.update({ where: { id }, data: changes }));
    } catch (error) {
      mapDatabaseError(error);
    }
  }
  private async adminMutation(id: number, actor: Actor, changes?: Prisma.NguoiDungUpdateInput) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            // All role changes/deletions use the same ordered locking read.
            await tx.$queryRaw`SELECT id FROM NguoiDung WHERE role = 'ADMIN' ORDER BY id FOR UPDATE`;
            const target = await tx.nguoiDung.findUnique({ where: { id } });
            if (!target) throw new NotFoundException('User not found');
            if (
              target.role === 'ADMIN' &&
              (!changes || changes.role === 'USER') &&
              (await tx.nguoiDung.count({ where: { role: 'ADMIN' } })) <= 1
            ) {
              throw new ConflictException('Cannot delete or demote the last ADMIN');
            }
            const currentActor = await tx.nguoiDung.findUnique({ where: { id: actor.id } });
            if (currentActor?.role !== 'ADMIN') throw new ForbiddenException('ADMIN required');
            if (changes)
              return safeUser(await tx.nguoiDung.update({ where: { id }, data: changes }));
            await tx.nguoiDung.delete({ where: { id } });
            return { deleted: true };
          },
          { isolationLevel: 'ReadCommitted', timeout: 10000 },
        );
      } catch (error) {
        const e = error as Prisma.PrismaClientKnownRequestError;
        const cause = (
          e.meta?.driverAdapterError as { cause?: { originalCode?: string } } | undefined
        )?.cause;
        if (
          e.code === 'P2034' ||
          ['1213', '1205'].includes(String(cause?.originalCode ?? e.meta?.code))
        ) {
          if (attempt === 2) throw new ConflictException('Concurrent administrator change; retry');
          continue;
        }
        mapDatabaseError(error);
      }
    }
    throw new ConflictException('Concurrent administrator change');
  }
  async remove(id: number, actor: Actor) {
    return this.adminMutation(id, actor);
  }
  async avatar(id: number, file?: Express.Multer.File) {
    return this.images.replace(file, async (url) => {
      try {
        return await this.prisma.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT id FROM NguoiDung WHERE id = ${id} FOR UPDATE`;
          const old = await tx.nguoiDung.findUnique({ where: { id } });
          const oldUrl = old?.avatar ?? null;
          const user = await tx.nguoiDung.update({ where: { id }, data: { avatar: url } });
          return { oldUrl, data: safeUser(user) };
        });
      } catch (error) {
        mapDatabaseError(error);
      }
    });
  }
}

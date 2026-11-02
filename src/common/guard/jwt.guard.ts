import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import jwt from 'jsonwebtoken';
import { PrismaService } from '../../modules-system/prisma/prisma.service';
import { environment } from '../config/environment';
export const AdminOnly = () => SetMetadata('adminOnly', true);
@Injectable()
export class JwtGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}
  async canActivate(context: ExecutionContext) {
    const req = context
      .switchToHttp()
      .getRequest<import('express').Request & { user?: { id: number; role: string } }>();
    const header = req.headers.token;
    const auth = req.headers.authorization;
    if (auth && (typeof auth !== 'string' || !/^Bearer \S+$/i.test(auth)))
      throw new UnauthorizedException('Invalid token');
    const bearer = auth?.slice(7);
    if (header && (typeof header !== 'string' || (bearer && bearer !== header)))
      throw new UnauthorizedException('Conflicting or invalid token headers');
    const token = header || bearer;
    if (!token) throw new UnauthorizedException('Authentication required');
    let id: number;
    try {
      const payload = jwt.verify(token, environment.jwtSecret, {
        algorithms: ['HS256'],
        issuer: 'airbnb-backend',
        audience: 'airbnb-api',
      });
      if (
        typeof payload === 'string' ||
        !Number.isInteger(Number(payload.sub)) ||
        Number(payload.sub) < 1 ||
        !payload.exp
      )
        throw new Error();
      id = Number(payload.sub);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    const user = await this.prisma.nguoiDung.findUnique({ where: { id } });
    if (!user) throw new UnauthorizedException('Invalid token');
    req.user = user;
    if (
      this.reflector.getAllAndOverride('adminOnly', [context.getHandler(), context.getClass()]) &&
      user.role !== 'ADMIN'
    ) {
      throw new ForbiddenException('ADMIN required');
    }
    return true;
  }
}

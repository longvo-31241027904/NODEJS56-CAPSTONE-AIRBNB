import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from './generated/prisma/client';
import { createAdapter } from './create-client';
import { environment } from '../../common/config/environment';
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super({
      adapter: createAdapter(environment.database),
      omit: { nguoiDung: { password: true } },
    });
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}

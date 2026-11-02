import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../modules-system/prisma/generated/prisma/client';
export function databaseError(error: unknown, conflictMessage = 'Record has related data'): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') throw new ConflictException('Unique field already exists');
    const cause = (
      error.meta?.driverAdapterError as { cause?: { originalCode?: string } } | undefined
    )?.cause;
    if (
      error.code === 'P2003' ||
      (error.code === 'P2039' &&
        ['1216', '1217', '1451', '1452'].includes(String(cause?.originalCode)))
    ) {
      throw new ConflictException(conflictMessage);
    }
    if (error.code === 'P2025') throw new NotFoundException('Record not found');
  }
  throw error;
}

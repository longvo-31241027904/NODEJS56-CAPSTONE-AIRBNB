import { BadRequestException, Injectable, UnsupportedMediaTypeException } from '@nestjs/common';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { environment } from '../config/environment';
@Injectable()
export class ImageStorage {
  async replace<T>(
    file: Express.Multer.File | undefined,
    update: (url: string) => Promise<{ oldUrl: string | null; data: T }>,
  ): Promise<T> {
    if (!file) throw new BadRequestException('formFile is required');
    let image: Buffer;
    try {
      const input = sharp(file.buffer, { limitInputPixels: 16000000, failOn: 'warning' });
      const metadata = await input.metadata();
      if (!['jpeg', 'png', 'webp'].includes(metadata.format ?? '') || (metadata.pages ?? 1) > 1)
        throw new Error();
      image = await input
        .rotate()
        .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
        .webp()
        .toBuffer();
    } catch {
      throw new UnsupportedMediaTypeException(
        'Only valid non-animated JPEG, PNG or WebP images are supported',
      );
    }
    await mkdir(environment.uploadDir, { recursive: true });
    const filename = path.join(environment.uploadDir, `${randomUUID()}.webp`);
    const prefix = `${environment.publicUrl}/uploads/avatars/`;
    const url = prefix + path.basename(filename);
    await writeFile(filename, image, { flag: 'wx' });
    let result;
    try {
      result = await update(url);
    } catch (error) {
      await unlink(filename).catch(() => undefined);
      throw error;
    }
    if (result.oldUrl?.startsWith(prefix)) {
      const name = result.oldUrl.slice(prefix.length);
      if (/^[a-f0-9-]{36}\.webp$/.test(name))
        await unlink(path.join(environment.uploadDir, name)).catch(() => undefined);
    }
    return result.data;
  }
}

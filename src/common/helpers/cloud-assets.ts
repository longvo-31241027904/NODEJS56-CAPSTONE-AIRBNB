import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { environment } from '../config/environment';
function signature(id: string) {
  return createHmac('sha256', process.env.CLOUDINARY_ASSET_SIGNING_KEY || environment.jwtSecret)
    .update(id)
    .digest('hex');
}
export function managedCloudId(raw: string): string | undefined {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com') return;
    const match = url.pathname.match(
      /^\/([^/]+)\/image\/upload\/v\d+\/(airbnb\/[a-f0-9-]{36})\.webp$/,
    );
    if (!match || match[1] !== process.env.CLOUDINARY_CLOUD_NAME) return;
    const supplied = url.searchParams.get('airbnb_sig') || '';
    if (
      !/^[a-f0-9]{64}$/.test(supplied) ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(signature(match[2])))
    )
      return;
    return match[2];
  } catch {
    return;
  }
}
function configure() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}
export async function uploadCloud(image: Buffer) {
  configure();
  const id = 'airbnb/' + randomUUID();
  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        { public_id: id, resource_type: 'image', format: 'webp', overwrite: false },
        (error, result) => {
          if (error || !result) return reject(new Error('Cloud image upload failed'));
          resolve(result);
        },
      )
      .end(image);
  });
  if (result.public_id !== id) throw new Error('Unexpected uploaded asset identity');
  const url = new URL(result.secure_url);
  url.searchParams.set('airbnb_sig', signature(id));
  if (managedCloudId(url.toString()) !== id) throw new Error('Unexpected uploaded asset URL');
  return url.toString();
}
export async function removeCloud(url: string) {
  const id = managedCloudId(url);
  if (!id) return;
  configure();
  await cloudinary.uploader.destroy(id, { resource_type: 'image', invalidate: true });
}

import { parseDatabase, databaseTls } from './database';
import 'dotenv/config';
import path from 'node:path';
export function loadEnvironment() {
  const port = Number(process.env.PORT ?? 3069);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be 1..65535');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const database = parseDatabase(process.env.DATABASE_URL);
  databaseTls(database);
  const origins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  for (const origin of origins) {
    try {
      const u = new URL(origin);
      if (!['http:', 'https:'].includes(u.protocol) || u.origin !== origin) throw new Error();
    } catch {
      throw new Error('CORS_ORIGINS must contain explicit HTTP origins');
    }
  }
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  if (!['development', 'test', 'production'].includes(nodeEnv))
    throw new Error('NODE_ENV is invalid');
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || Buffer.byteLength(jwtSecret) < 32)
    throw new Error('JWT_SECRET must contain at least 32 bytes');
  const publicUrl = process.env.PUBLIC_URL ?? `http://localhost:${port}`;
  try {
    const u = new URL(publicUrl);
    if (!['http:', 'https:'].includes(u.protocol) || u.origin !== publicUrl) throw new Error();
  } catch {
    throw new Error('PUBLIC_URL must be an HTTP origin without trailing slash');
  }
  const imageStorage = process.env.IMAGE_STORAGE ?? 'local';
  if (!['local', 'cloudinary'].includes(imageStorage)) throw new Error('Invalid IMAGE_STORAGE');
  if (
    imageStorage === 'cloudinary' &&
    ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'].some(
      (key) => !process.env[key],
    )
  )
    throw new Error('Cloudinary configuration required');
  if (
    process.env.RENDER === 'true' &&
    (imageStorage !== 'cloudinary' || process.env.DB_TLS_REQUIRED !== 'true')
  )
    throw new Error('Render requires Cloudinary and verified database TLS');
  const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS ?? 0);
  if (![0, 1].includes(trustProxyHops)) throw new Error('TRUST_PROXY_HOPS must be 0 or 1');
  const uploadDir = path.resolve(process.env.UPLOAD_DIR ?? 'uploads/avatars');
  return {
    port,
    database,
    origins,
    nodeEnv,
    jwtSecret,
    publicUrl,
    uploadDir,
    imageStorage,
    trustProxyHops,
  };
}
export const environment = loadEnvironment();

import { databaseTls, parseDatabase } from '../../common/config/database';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from './generated/prisma/client';
export function createAdapter(url: URL) {
  parseDatabase(url.toString());
  const ssl = databaseTls(url);
  return new PrismaMariaDb({
    ssl,
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1)),
    connectionLimit: 5,
    allowPublicKeyRetrieval: !ssl && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname),
    connectTimeout: 3000,
    acquireTimeout: 4000,
  });
}
export function createClient(url: URL) {
  return new PrismaClient({ adapter: createAdapter(url), omit: { nguoiDung: { password: true } } });
}

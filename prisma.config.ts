import { migrationDatabaseUrl } from './src/common/config/database';
import 'dotenv/config';
import { defineConfig } from 'prisma/config';
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'tsx prisma/seed.ts' },
  datasource: { url: migrationDatabaseUrl(process.env.DATABASE_URL ?? '') },
});

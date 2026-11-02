import dotenv from 'dotenv';
dotenv.config({ path: process.env.CLOUD_ENV_FILE || '.env.cloud.local', override: true });
import { spawnSync } from 'node:child_process';
import { writeFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import { createClient } from '../src/modules-system/prisma/create-client';
import { parseDatabase, databaseTls } from '../src/common/config/database';
async function main() {
  const url = parseDatabase(process.env.DATABASE_URL || '');
  if (
    process.env.CLOUD_ALLOW_WRITE !== 'true' ||
    process.env.CLOUD_DB_OWNERSHIP_CONFIRMED !== 'true' ||
    process.env.DB_TLS_REQUIRED !== 'true'
  )
    throw new Error('Cloud writes require explicit ownership/TLS opt-in');
  if (
    url.hostname !== process.env.CLOUD_DB_EXPECTED_HOST ||
    !url.hostname.endsWith('.aivencloud.com') ||
    url.pathname !== '/airbnb_capstone_deploy' ||
    process.env.CLOUD_DB_EXPECTED_DATABASE !== 'airbnb_capstone_deploy'
  )
    throw new Error('Unexpected cloud target');
  databaseTls(url);
  const prisma = createClient(url);
  try {
    const [identity] = await prisma.$queryRaw<{ name: string }[]>`SELECT DATABASE() AS name`;
    if (identity.name !== 'airbnb_capstone_deploy') throw new Error('Wrong connected database');
    const tls = await prisma.$queryRaw<
      { Variable_name: string; Value: string }[]
    >`SHOW SESSION STATUS LIKE 'Ssl_cipher'`;
    if (!tls[0]?.Value) throw new Error('Database session is not encrypted');
    const migration = spawnSync(
      process.execPath,
      ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
      { env: process.env, stdio: 'pipe' },
    );
    if (migration.status !== 0) {
      const diagnostics = String(migration.stdout || '') + String(migration.stderr || '');
      const codes = [
        ...new Set(diagnostics.match(/\bP\d{4}\b|\b(?:1005|1044|1045|1142|1215|2026)\b/g) || []),
      ];
      console.error('Migration diagnostic codes:', codes.join(',') || 'none');
      throw new Error('Cloud migration failed (details suppressed)');
    }
    if (process.env.CLOUD_BOOTSTRAP_ADMIN === 'true') {
      const existing = await prisma.nguoiDung.count({ where: { role: 'ADMIN' } });
      if (existing) {
        console.log('ADMIN already exists; no new account or password change');
        return;
      }
      const email = process.env.CLOUD_ADMIN_EMAIL?.trim().toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        throw new Error('CLOUD_ADMIN_EMAIL required');
      if (await prisma.nguoiDung.findUnique({ where: { email } }))
        throw new Error('Existing account will not be promoted');
      const output = '.env.cloud-admin.local';
      if (existsSync(output))
        throw new Error('Local bootstrap credential file exists; inspect before retry');
      const password = randomBytes(24).toString('base64url');
      // Save locally before write so a failed/uncertain network response does not lose the credential.
      writeFileSync(output, `ADMIN_EMAIL=${email}\nADMIN_PASSWORD=${password}\n`, {
        flag: 'wx',
        mode: 0o600,
      });
      await prisma.nguoiDung.create({
        data: {
          name: 'Airbnb administrator',
          email,
          password: await bcrypt.hash(password, 12),
          phone: '',
          gender: false,
          role: 'ADMIN',
        },
      });
      console.log('ADMIN bootstrapped; credentials saved to ignored local file');
    }
    console.log('Cloud migration/TLS verification passed');
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((error) => {
  const code = error?.code || error?.cause?.code;
  if (typeof code === 'string' && /^[A-Z0-9_]+$/.test(code))
    console.error('Diagnostic code:', code);
  if (error?.meta) {
    console.error('Diagnostic metadata fields:', Object.keys(error.meta).join(','));
    const message = JSON.stringify(error.meta);
    console.error(
      'Diagnostic categories:',
      [
        'Access denied',
        'command denied',
        'certificate',
        'SSL',
        'unsupported',
        'timeout',
        'Unknown',
        'denied',
        'deserialize',
      ]
        .filter((x) => message.toLowerCase().includes(x.toLowerCase()))
        .join(','),
    );
  }
  console.error(
    'Cloud preparation failed; inspect target/ownership/TLS configuration. Secrets suppressed.',
  );
  process.exitCode = 1;
});

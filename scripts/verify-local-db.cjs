require('dotenv/config');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { verifyLocalIdentity } = require('./local-db-identity.cjs');
async function main() {
  const url = new URL(process.env.DATABASE_URL || '');
  assert.ok(
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) &&
      url.pathname === '/airbnb_capstone_local',
    'Requires dedicated local development database',
  );
  const { createClient } = require('../dist/modules-system/prisma/create-client');
  const prisma = createClient(url);
  try {
    const [target] =
      await prisma.$queryRaw`SELECT DATABASE() AS database_name, @@port AS server_port, VERSION() AS server_version`;
    verifyLocalIdentity(url, target);
    console.log(
      `Connected to project local database on port ${Number(target.server_port)}; MySQL ${target.server_version}`,
    );
    const run = (args) => {
      const result = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', ...args], {
        env: process.env,
        stdio: 'pipe',
      });
      assert.equal(
        result.status,
        0,
        'Prisma command failed; check local database and seed configuration',
      );
    };
    run(['migrate', 'deploy']);
    run(['db', 'seed']);
    const snapshot = async () => ({
      counts: await Promise.all([
        prisma.nguoiDung.count(),
        prisma.viTri.count(),
        prisma.phong.count(),
        prisma.datPhong.count(),
        prisma.binhLuan.count(),
      ]),
      accounts: await prisma.nguoiDung.findMany({
        orderBy: { id: 'asc' },
        select: { id: true, email: true, password: true, role: true },
      }),
    });
    const before = await snapshot();
    assert.ok(
      before.counts.every((n) => n > 0),
      'Seed populated all five tables',
    );
    assert.ok(
      before.accounts.every((a) => /^\$2[ab]\$/.test(a.password)),
      'Passwords are bcrypt hashes',
    );
    run(['db', 'seed']);
    assert.deepEqual(
      await snapshot(),
      before,
      'Repeat seed preserves counts, accounts and passwords',
    );
    const foreignKeys =
      await prisma.$queryRaw`SELECT CONSTRAINT_NAME FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND DELETE_RULE = 'RESTRICT'`;
    assert.ok(foreignKeys.length >= 5, 'Expected five restricted foreign keys');
    const { NestFactory } = require('@nestjs/core');
    const { AppModule } = require('../dist/app.module');
    const { configureApp } = require('../dist/configure-app');
    const app = await NestFactory.create(AppModule, { logger: false });
    try {
      configureApp(app);
      await app.listen(0, '127.0.0.1');
      const res = await fetch((await app.getUrl()) + '/api/health/database');
      assert.equal(res.status, 200);
    } finally {
      await app.close();
    }
    console.log(
      'PASS MySQL: migration, five populated tables, restricted FKs, repeat seed and database health 200',
    );
  } finally {
    await prisma.$disconnect();
  }
}
main().catch(() => {
  console.error(
    'Local MySQL verification blocked/failed. Check engine, local target and seed settings; secrets suppressed.',
  );
  process.exitCode = 1;
});

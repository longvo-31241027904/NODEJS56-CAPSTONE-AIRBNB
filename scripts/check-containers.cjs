const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
function docker(args) {
  const result = spawnSync('docker', args, { encoding: 'utf8', timeout: 60000 });
  assert.equal(result.status, 0, 'Docker check failed: ' + args[0]);
  return result.stdout.trim();
}
async function main() {
  docker([
    'run',
    '--rm',
    '--entrypoint',
    'node',
    'airbnb-backend:review',
    '-e',
    "const fs=require('fs');if(process.getuid()===0||fs.existsSync('/app/.env')||fs.existsSync('/app/.env.demo.local'))process.exit(1);fs.writeFileSync('/app/uploads/avatars/probe','ok')",
  ]);
  docker([
    'run',
    '--rm',
    '--entrypoint',
    './node_modules/.bin/prisma',
    'airbnb-migrate:review',
    'migrate',
    'diff',
    '--from-empty',
    '--to-schema',
    'prisma/schema.prisma',
    '--script',
    '--output',
    '/tmp/review.sql',
  ]);
  const name = 'airbnb-review-smoke-' + Date.now();
  let id;
  try {
    id = docker([
      'run',
      '--rm',
      '-d',
      '--name',
      name,
      '-p',
      '127.0.0.1:13072:3069',
      '-e',
      'PORT=3069',
      '-e',
      'JWT_SECRET=container-smoke-only-value-at-least-32-bytes',
      '-e',
      'DATABASE_URL=mysql://unused:unused@127.0.0.1:1/airbnb_smoke',
      'airbnb-backend:review',
    ]);
    assert.match(id, /^[a-f0-9]{64}$/);
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      try {
        ready = (await fetch('http://localhost:13072/api/health')).status === 200;
      } catch {}
      if (ready) break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert.ok(ready, 'Container application starts');
    assert.equal((await fetch('http://localhost:13072/api/docs')).status, 200);
    assert.equal((await fetch('http://localhost:13072/api/health/database')).status, 503);
    console.log(
      'PASS containers: non-root runtime, no .env, writable upload directory, migration CLI/schema engine, health/Swagger and sanitized DB503. No live database migration performed.',
    );
  } finally {
    if (id) docker(['stop', id]); // Only the temporary container created by this check; --rm removes it.
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

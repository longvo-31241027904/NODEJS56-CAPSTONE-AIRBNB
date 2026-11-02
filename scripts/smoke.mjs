import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { once } from 'node:events';

const port = 13069;
// A reserved port that accepts no database connections makes the failure check deterministic.
const reserved = net.createServer((socket) => socket.destroy());
reserved.listen(0, '127.0.0.1');
await once(reserved, 'listening');
const dbPort = reserved.address().port;
const child = spawn(process.execPath, ['dist/main.js'], {
  env: {
    ...process.env,
    JWT_SECRET: 'smoke-only-secret-32-bytes-long-value',
    PORT: String(port),
    DATABASE_URL: `mysql://smoke:smoke@127.0.0.1:${dbPort}/airbnb_capstone_local`,
    CORS_ORIGINS: 'http://localhost:3000',
    NODE_ENV: 'test',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let logs = '';
child.stdout.on('data', (data) => {
  logs += data;
});
child.stderr.on('data', (data) => {
  logs += data;
});
const base = `http://localhost:${port}`;
try {
  let ready = false;
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(`${base}/api/health`)).ok) {
        ready = true;
        break;
      }
    } catch {}
    if (child.exitCode !== null) throw new Error('Application exited during startup');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(ready, 'Application starts without database');
  const health = await fetch(`${base}/api/health`, {
    headers: { Origin: 'http://localhost:3000' },
  });
  assert.equal(health.headers.get('access-control-allow-origin'), 'http://localhost:3000');
  assert.deepEqual(await health.json(), {
    status: 'success',
    statusCode: 200,
    data: { application: 'up' },
  });
  const blocked = await fetch(`${base}/api/health`, {
    headers: { Origin: 'http://untrusted.test' },
  });
  assert.equal(blocked.headers.get('access-control-allow-origin'), null);
  assert.equal((await fetch(`${base}/api/docs`)).status, 200);
  const spec = await (await fetch(`${base}/api/docs-json`)).json();
  assert.equal(
    Object.values(spec.paths).reduce((n, p) => n + Object.keys(p).length, 0),
    38,
  );
  const db = await fetch(`${base}/api/health/database`, { signal: AbortSignal.timeout(12000) });
  assert.equal(db.status, 503);
  assert.deepEqual(await db.json(), {
    status: 'error',
    statusCode: 503,
    message: 'Service unavailable',
  });
  assert.equal((await fetch(`${base}/api/users`)).status, 401);
  console.log('PASS: app, Swagger, CORS, sanitized database 503, and protected Users APIs');
} catch (error) {
  console.error(logs);
  throw error;
} finally {
  child.kill();
  await once(child, 'exit');
  reserved.close();
}

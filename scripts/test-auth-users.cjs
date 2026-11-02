// HTTP integration with in-memory Prisma test double. This does NOT verify MySQL.
const assert = require('node:assert/strict');
const { mkdtemp, readdir, rm } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const sharp = require('sharp');
async function main() {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'airbnb-avatar-tests-'));
  process.env.JWT_SECRET = require('node:crypto').randomBytes(32).toString('hex');
  process.env.DATABASE_URL = 'mysql://unused:unused@127.0.0.1:1/airbnb_mock_tests';
  process.env.UPLOAD_DIR = folder;
  process.env.PUBLIC_URL = 'http://localhost:13070';
  const { Test } = require('@nestjs/testing');
  const { AppModule } = require('../dist/app.module');
  const { PrismaService } = require('../dist/modules-system/prisma/prisma.service');
  const { Prisma } = require('../dist/modules-system/prisma/generated/prisma/client');
  const { configureApp } = require('../dist/configure-app');
  const records = new Map();
  let nextId = 1;
  const known = (code) =>
    new Prisma.PrismaClientKnownRequestError('test', { code, clientVersion: '7.10.1' });
  const matching = (where) =>
    [...records.values()].filter((u) => !where?.name || u.name.includes(where.name.contains));
  const mock = {
    nguoiDung: {
      async findUnique({ where }) {
        return where.id
          ? (records.get(where.id) ?? null)
          : ([...records.values()].find((u) => u.email === where.email) ?? null);
      },
      async create({ data }) {
        if ([...records.values()].some((u) => u.email === data.email)) throw known('P2002');
        const u = { id: nextId++, birthday: null, role: 'USER', avatar: null, ...data };
        if (typeof u.birthday === 'string') u.birthday = new Date(u.birthday);
        records.set(u.id, u);
        return u;
      },
      async findMany({ where, skip = 0, take } = {}) {
        const a = matching(where);
        return a.slice(skip, take === undefined ? undefined : skip + take);
      },
      async count({ where }) {
        return matching(where).length;
      },
      async update({ where, data }) {
        const u = records.get(where.id);
        if (!u) throw known('P2025');
        if (
          data.email &&
          [...records.values()].some((x) => x.id !== u.id && x.email === data.email)
        )
          throw known('P2002');
        Object.assign(u, data);
        return u;
      },
      async delete({ where }) {
        const u = records.get(where.id);
        if (!u) throw known('P2025');
        if (u.related) throw known('P2003');
        records.delete(u.id);
        return u;
      },
    },
    async $queryRaw() {
      return [{ id: 1 }];
    },
    async $transaction(work) {
      return typeof work === 'function' ? work(mock) : Promise.all(work);
    },
  };
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue(mock)
    .compile();
  const app = module.createNestApplication({ logger: false });
  configureApp(app);
  await app.listen(13070);
  let checks = 0;
  async function request(method, url, status, body, token, headers = {}) {
    const response = await fetch('http://localhost:13070' + url, {
      method,
      headers: {
        ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { token } : {}),
        ...headers,
      },
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });
    assert.equal(response.status, status, `${method} ${url}: unexpected HTTP status`);
    const data = await response.json();
    assert.ok(
      !JSON.stringify(data).includes('"password"') && !JSON.stringify(data).includes('$2b$'),
      'No password/hash in response',
    );
    checks++;
    return data.data;
  }
  const profile = (email, name = 'Demo') => ({
    name,
    email,
    password: 'Test-password-2026',
    phone: '0901234567',
    birthday: '2000-02-29',
    gender: false,
  });
  try {
    const user = await request('POST', '/api/auth/signup', 201, {
      ...profile(' Person@Example.test '),
      role: 'ADMIN',
      id: 500,
    });
    assert.equal(user.role, 'USER');
    assert.notEqual(user.id, 500);
    assert.equal(user.email, 'person@example.test');
    assert.equal(user.birthday, '2000-02-29');
    assert.ok(await bcrypt.compare('Test-password-2026', records.get(user.id).password));
    await request('POST', '/api/auth/signup', 409, profile('person@example.test'));
    await request('POST', '/api/auth/signup', 400, {
      ...profile('a@example.test'),
      gender: 'false',
    });
    await request('POST', '/api/auth/signup', 400, {
      ...profile('a@example.test'),
      birthday: '2001-02-29',
    });
    await request('POST', '/api/auth/signup', 400, { ...profile('a@example.test'), userId: 99 });
    const concurrent = await Promise.all(
      [1, 2].map(() =>
        fetch('http://localhost:13070/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(profile('race@example.test')),
        }),
      ),
    );
    assert.deepEqual(concurrent.map((r) => r.status).sort(), [201, 409]);
    checks++;
    const pair = await request('POST', '/api/auth/signin', 200, {
      email: ' PERSON@example.test ',
      password: 'Test-password-2026',
    });
    const token = pair.token;
    await request('POST', '/api/auth/signin', 401, {
      email: 'person@example.test',
      password: 'wrong',
    });
    await request('POST', '/api/auth/signin', 401, {
      email: 'missing@example.test',
      password: 'wrong',
    });
    await request('GET', '/api/users', 401);
    await request('GET', '/api/users', 401, undefined, 'invalid');
    await request('GET', '/api/users', 403, undefined, token);
    await request('GET', `/api/users/${user.id}`, 200, undefined, undefined, {
      Authorization: `Bearer ${token}`,
    });
    await request('GET', `/api/users/${user.id}`, 401, undefined, token, {
      Authorization: 'Bearer other',
    });
    const sign = (options) =>
      jwt.sign({}, process.env.JWT_SECRET, {
        subject: String(user.id),
        audience: 'airbnb-api',
        issuer: 'airbnb-backend',
        ...options,
      });
    await request('GET', `/api/users/${user.id}`, 401, undefined, sign({ expiresIn: -1 }));
    await request(
      'GET',
      `/api/users/${user.id}`,
      401,
      undefined,
      sign({ algorithm: 'HS384', expiresIn: 100 }),
    );
    const wrongSignature = jwt.sign({}, 'different-key-for-negative-test', {
      subject: String(user.id),
      expiresIn: 100,
      audience: 'airbnb-api',
      issuer: 'airbnb-backend',
    });
    await request('GET', `/api/users/${user.id}`, 401, undefined, wrongSignature);
    const other = await request('POST', '/api/auth/signup', 201, profile('other@example.test'));
    await request('GET', `/api/users/${other.id}`, 403, undefined, token);
    await request('PUT', `/api/users/${other.id}`, 403, { name: 'hack' }, token);
    await request('PUT', `/api/users/${user.id}`, 403, { role: 'ADMIN' }, token);
    await request('PUT', `/api/users/${user.id}`, 400, { password: 'Another-password' }, token);
    await request('PUT', `/api/users/${user.id}`, 400, { id: other.id }, token);
    await request('PUT', `/api/users/${user.id}`, 400, { gender: null }, token);
    await request('PUT', `/api/users/${user.id}`, 200, { name: 'Updated', gender: true }, token);
    await request('PUT', `/api/users/${user.id}`, 409, { email: 'other@example.test' }, token);
    const admin = await mock.nguoiDung.create({
      data: {
        ...profile('admin@example.test'),
        role: 'ADMIN',
        password: await bcrypt.hash('Test-password-2026', 10),
      },
    });
    const adminToken = jwt.sign({}, process.env.JWT_SECRET, {
      subject: String(admin.id),
      expiresIn: 100,
      audience: 'airbnb-api',
      issuer: 'airbnb-backend',
    });
    await request('GET', '/api/users', 200, undefined, adminToken);
    const page = await request(
      'GET',
      '/api/users/phan-trang-tim-kiem?pageIndex=1&pageSize=1&keyword=Updated',
      200,
      undefined,
      adminToken,
    );
    assert.equal(page.items.length, 1);
    assert.equal(page.totalItems, 1);
    await request('GET', '/api/users/phan-trang-tim-kiem?pageSize=101', 400, undefined, adminToken);
    await request('GET', '/api/users/search/Updated', 200, undefined, adminToken);
    await request('GET', '/api/users/nope', 400, undefined, adminToken);
    await request('GET', '/api/users/2147483647', 404, undefined, adminToken);
    const created = await request(
      'POST',
      '/api/users',
      201,
      { ...profile('created@example.test'), role: 'ADMIN' },
      adminToken,
    );
    await request('PUT', `/api/users/${created.id}`, 200, { role: 'USER' }, adminToken);
    const upload = (data, name = 'image.png') => {
      const form = new FormData();
      form.append('formFile', new Blob([data]), name);
      return form;
    };
    const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'red' } })
      .png()
      .toBuffer();
    await request('POST', '/api/users/upload-avatar', 400, new FormData(), token);
    const avatar = await request(
      'POST',
      '/api/users/upload-avatar',
      201,
      upload(png, '../../evil.html'),
      token,
    );
    const asset = await fetch(avatar.avatar);
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get('content-type'), /image\/webp/);
    await request(
      'POST',
      '/api/users/upload-avatar',
      415,
      upload(Buffer.from('<script>alert(1)</script>')),
      token,
    );
    await request(
      'POST',
      '/api/users/upload-avatar',
      413,
      upload(Buffer.alloc(2 * 1024 * 1024 + 1)),
      token,
    );
    const replacement = await request('POST', '/api/users/upload-avatar', 201, upload(png), token);
    assert.notEqual(avatar.avatar, replacement.avatar);
    assert.equal((await readdir(folder)).length, 1);
    const originalTransaction = mock.$transaction;
    mock.$transaction = async () => {
      throw new Error('private database connection details');
    };
    await request('POST', '/api/users/upload-avatar', 500, upload(png), token);
    assert.equal((await readdir(folder)).length, 1);
    mock.$transaction = originalTransaction;
    records.get(other.id).related = true;
    await request('DELETE', `/api/users?id=${other.id}`, 409, undefined, adminToken);
    await request('DELETE', `/api/users?id=${user.id}`, 200, undefined, adminToken);
    await request('GET', `/api/users/${user.id}`, 401, undefined, token);
    records.get(admin.id).role = 'USER';
    await request('GET', '/api/users', 403, undefined, adminToken);
    await request('POST', '/api/auth/signin', 401, {
      email: 'missing@example.test',
      password: 'wrong',
    });
    await request('POST', '/api/auth/signin', 401, {
      email: 'missing@example.test',
      password: 'wrong',
    });
    await request('POST', '/api/auth/signin', 429, {
      email: 'missing@example.test',
      password: 'wrong',
    });
    console.log(`PASS: ${checks} HTTP checks using Prisma mock (NOT MySQL)`);
  } finally {
    await app.close();
    await rm(folder, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

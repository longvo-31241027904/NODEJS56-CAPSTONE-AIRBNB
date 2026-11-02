require('dotenv/config');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { mkdtemp, rm } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const bcrypt = require('bcrypt');
const sharp = require('sharp');
const jwt = require('jsonwebtoken');
const { requireTestTarget } = require('./database-target.cjs');
async function main() {
  const developmentUrl = process.env.DATABASE_URL;
  const target = requireTestTarget(
    process.env.TEST_DATABASE_URL,
    developmentUrl,
    process.env.TEST_DB_ALLOW_WRITE,
  );
  process.env.DATABASE_URL = target.toString();
  process.env.PUBLIC_URL = 'http://localhost:13071';
  const folder = await mkdtemp(path.join(os.tmpdir(), 'airbnb-real-mysql-'));
  process.env.UPLOAD_DIR = folder;
  const { createClient } = require('../dist/modules-system/prisma/create-client');
  const prisma = createClient(target);
  const runId = randomUUID().replaceAll('-', '');
  const userIds = [],
    locationIds = [],
    roomIds = [],
    bookingIds = [],
    commentIds = [];
  let app,
    checks = 0;
  const covered = new Set();
  try {
    const [identity] = await prisma.$queryRaw`SELECT DATABASE() AS db, CURRENT_USER() AS account`;
    assert.equal(identity.db, 'airbnb_capstone_test');
    assert.ok(identity.account.startsWith('airbnb_test_app@'));
    const result = spawnSync(
      process.execPath,
      ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
      { env: process.env, stdio: 'pipe' },
    );
    assert.equal(result.status, 0, 'Test migration failed; details suppressed');
    const { NestFactory } = require('@nestjs/core');
    const { AppModule } = require('../dist/app.module');
    const { configureApp } = require('../dist/configure-app');
    app = await NestFactory.create(AppModule, { logger: false });
    configureApp(app);
    await app.listen(13071);
    const base = 'http://localhost:13071';
    async function request(method, url, expected, body, token, route = url.split('?')[0]) {
      const response = await fetch(base + url, {
        method,
        headers: {
          ...(token ? { token } : {}),
          ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
      });
      assert.equal(response.status, expected, `${method} ${route}: unexpected status`);
      const json = await response.json();
      assert.ok(
        !JSON.stringify(json).includes('"password"') && !JSON.stringify(json).includes('$2b$'),
        'Sensitive response',
      );
      checks++;
      if (expected < 300) covered.add(`${method} ${route.replace(/\/\d+(?=\/|$)/g, '/{id}')}`);
      return json.data;
    }
    const email = (name) => `${runId}-${name}@example.test`;
    const password = randomUUID() + 'Aa1!';
    const profile = (name) => ({
      name: `${runId}-${name}`,
      email: email(name),
      password,
      phone: '0901234567',
      birthday: '2000-02-29',
      gender: false,
    });
    const admin = await prisma.nguoiDung.create({
      data: {
        ...profile('admin'),
        birthday: new Date('2000-02-29T00:00:00Z'),
        password: await bcrypt.hash(password, 10),
        role: 'ADMIN',
      },
    });
    userIds.push(admin.id);
    const adminToken = (
      await request('POST', '/api/auth/signin', 200, { email: admin.email, password })
    ).token;
    const user = await request('POST', '/api/auth/signup', 201, {
      ...profile('user'),
      role: 'ADMIN',
    });
    userIds.push(user.id);
    assert.equal(user.role, 'USER');
    const token = (await request('POST', '/api/auth/signin', 200, { email: user.email, password }))
      .token;
    await request('POST', '/api/auth/signup', 409, profile('user'));
    const concurrent = await Promise.all(
      [1, 2].map(() =>
        fetch(base + '/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(profile('race')),
        }),
      ),
    );
    assert.deepEqual(concurrent.map((r) => r.status).sort(), [201, 409]);
    checks++;
    const race = await prisma.nguoiDung.findUnique({ where: { email: email('race') } });
    userIds.push(race.id);
    await request('POST', '/api/auth/signin', 401, { email: user.email, password: 'wrong' });
    await request('GET', '/api/users', 401);
    await request('GET', '/api/users', 401, undefined, 'invalid');
    const expired = jwt.sign({}, process.env.JWT_SECRET, {
      subject: String(user.id),
      expiresIn: -1,
      issuer: 'airbnb-backend',
      audience: 'airbnb-api',
    });
    await request('GET', '/api/users', 401, undefined, expired);
    await request('GET', '/api/users', 403, undefined, token);
    await request('GET', `/api/users/${admin.id}`, 403, undefined, token);
    await request('PUT', `/api/users/${admin.id}`, 403, { name: 'invalid' }, token);
    await request('PUT', `/api/users/${user.id}`, 403, { role: 'ADMIN' }, token);
    await request('PUT', `/api/users/${user.id}`, 400, { password }, token);
    await request(
      'PUT',
      `/api/users/${user.id}`,
      200,
      { name: `${runId}-updated` },
      token,
      '/api/users/{id}',
    );
    await request('GET', `/api/users/${user.id}`, 200, undefined, token, '/api/users/{id}');
    await request('GET', '/api/users', 200, undefined, adminToken);
    const page = await request(
      'GET',
      `/api/users/phan-trang-tim-kiem?pageIndex=1&pageSize=2&keyword=${runId}`,
      200,
      undefined,
      adminToken,
    );
    assert.ok(page.items.length <= 2 && page.totalItems >= 3);
    await request(
      'GET',
      `/api/users/search/${runId}`,
      200,
      undefined,
      adminToken,
      '/api/users/search/{TenNguoiDung}',
    );
    await request('GET', '/api/users/phan-trang-tim-kiem?pageSize=101', 400, undefined, adminToken);
    await request('GET', '/api/users/invalid', 400, undefined, adminToken);
    const created = await request('POST', '/api/users', 201, profile('created'), adminToken);
    userIds.push(created.id);
    const upload = (data) => {
      const f = new FormData();
      f.append('formFile', new Blob([data]), 'avatar.png');
      return f;
    };
    const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: 'red' } })
      .png()
      .toBuffer();
    const avatar = await request('POST', '/api/users/upload-avatar', 201, upload(png), token);
    assert.equal((await fetch(avatar.avatar)).status, 200);
    await request('POST', '/api/users/upload-avatar', 415, upload(Buffer.from('invalid')), token);
    await request(
      'POST',
      '/api/users/upload-avatar',
      413,
      upload(Buffer.alloc(2 * 1024 * 1024 + 1)),
      token,
    );
    const location = await prisma.viTri.create({
      data: { tenViTri: runId, tinhThanh: 'Demo', quocGia: 'VN' },
    });
    locationIds.push(location.id);
    const room = await prisma.phong.create({
      data: {
        tenPhong: runId,
        khach: 2,
        phongNgu: 1,
        giuong: 1,
        phongTam: 1,
        moTa: runId,
        giaTien: 1,
        maViTri: location.id,
      },
    });
    roomIds.push(room.id);
    const booking = await prisma.datPhong.create({
      data: {
        maPhong: room.id,
        maNguoiDung: created.id,
        ngayDen: new Date('2031-01-01Z'),
        ngayDi: new Date('2031-01-02Z'),
        soLuongKhach: 1,
      },
    });
    bookingIds.push(booking.id);
    await request('DELETE', `/api/users?id=${created.id}`, 409, undefined, adminToken);
    // Catalog HTTP tests use the same real MySQL test schema and isolated run IDs.
    const loc = await request(
      'POST',
      '/api/vi-tri',
      201,
      { tenViTri: runId + '-loc', tinhThanh: 'Da Nang', quocGia: 'VN' },
      adminToken,
    );
    locationIds.push(loc.id);
    await request('GET', '/api/vi-tri', 200);
    await request('GET', `/api/vi-tri/${loc.id}`, 200, undefined, undefined, '/api/vi-tri/{id}');
    const locPage = await request(
      'GET',
      `/api/vi-tri/phan-trang-tim-kiem?keyword=${runId}&pageSize=1`,
      200,
    );
    assert.ok(locPage.items.some((x) => x.id === location.id || x.id === loc.id));
    await request(
      'PUT',
      `/api/vi-tri/${loc.id}`,
      200,
      { tinhThanh: 'Hue' },
      adminToken,
      '/api/vi-tri/{id}',
    );
    await request(
      'POST',
      '/api/vi-tri',
      403,
      { tenViTri: 'invalid', tinhThanh: 'x', quocGia: 'VN' },
      token,
    );
    await request('POST', '/api/vi-tri', 401, {
      tenViTri: 'invalid',
      tinhThanh: 'x',
      quocGia: 'VN',
    });
    await request(
      'POST',
      `/api/vi-tri/upload-hinh-vitri?maViTri=${loc.id}`,
      201,
      upload(png),
      adminToken,
      '/api/vi-tri/upload-hinh-vitri',
    );
    const roomData = {
      tenPhong: runId + '-api',
      khach: 2,
      phongNgu: 1,
      giuong: 1,
      phongTam: 1,
      moTa: 'Test room',
      giaTien: 500000,
      maViTri: loc.id,
      mayGiat: false,
      banLa: true,
      tivi: false,
      dieuHoa: false,
      wifi: true,
      bep: false,
      doXe: false,
      hoBoi: false,
      banUi: false,
    };
    const apiRoom = await request('POST', '/api/phong-thue', 201, roomData, adminToken);
    roomIds.push(apiRoom.id);
    assert.equal(apiRoom.banLa, true);
    assert.equal(apiRoom.banUi, false);
    await request('GET', '/api/phong-thue', 200);
    await request(
      'GET',
      `/api/phong-thue/${apiRoom.id}`,
      200,
      undefined,
      undefined,
      '/api/phong-thue/{id}',
    );
    const filtered = await request(
      'GET',
      `/api/phong-thue/lay-phong-theo-vi-tri?maViTri=${loc.id}`,
      200,
    );
    assert.ok(filtered.every((x) => x.maViTri === loc.id));
    await request('GET', `/api/phong-thue/phan-trang-tim-kiem?keyword=${runId}&pageSize=2`, 200);
    await request(
      'PUT',
      `/api/phong-thue/${apiRoom.id}`,
      200,
      { maViTri: location.id, giaTien: 0 },
      adminToken,
      '/api/phong-thue/{id}',
    );
    const image = await request(
      'POST',
      `/api/phong-thue/upload-hinh-phong?maPhong=${apiRoom.id}`,
      201,
      upload(png),
      adminToken,
      '/api/phong-thue/upload-hinh-phong',
    );
    assert.equal((await fetch(image.hinhAnh)).status, 200);
    const nextImage = await request(
      'POST',
      `/api/phong-thue/upload-hinh-phong?maPhong=${apiRoom.id}`,
      201,
      upload(png),
      adminToken,
      '/api/phong-thue/upload-hinh-phong',
    );
    assert.equal((await fetch(image.hinhAnh)).status, 404);
    assert.equal((await fetch(nextImage.hinhAnh)).status, 200);
    await request(
      'POST',
      `/api/phong-thue/upload-hinh-phong?maPhong=${apiRoom.id}`,
      415,
      upload(Buffer.from('invalid')),
      adminToken,
    );
    await request(
      'POST',
      `/api/phong-thue/upload-hinh-phong?maPhong=${apiRoom.id}`,
      413,
      upload(Buffer.alloc(2097153)),
      adminToken,
    );
    await request(
      'POST',
      `/api/phong-thue/upload-hinh-phong?maPhong=${apiRoom.id}`,
      403,
      upload(png),
      token,
    );
    await request('POST', '/api/phong-thue', 400, { ...roomData, khach: 0 }, adminToken);
    await request('POST', '/api/phong-thue', 400, { ...roomData, wifi: 'false' }, adminToken);
    await request('POST', '/api/phong-thue', 400, { ...roomData, giaTien: -1 }, adminToken);
    await request('POST', '/api/phong-thue', 400, { ...roomData, extra: 1 }, adminToken);
    await request('POST', '/api/phong-thue', 404, { ...roomData, maViTri: 2147483647 }, adminToken);
    await request('PUT', `/api/phong-thue/${apiRoom.id}`, 400, { id: room.id }, adminToken);
    await request('GET', '/api/vi-tri/phan-trang-tim-kiem?pageSize=101', 400);
    await request('GET', '/api/phong-thue/lay-phong-theo-vi-tri?maViTri=bad', 400);
    await request('DELETE', `/api/vi-tri/${location.id}`, 409, undefined, adminToken);
    await request('DELETE', `/api/phong-thue/${room.id}`, 409, undefined, adminToken);
    // Real FK failure after image write: new image must be removed and old URL stay valid.
    const { ImageStorage } = require('../dist/common/helpers/image-storage');
    const imageStorage = app.get(ImageStorage);
    const { readdir } = require('node:fs/promises');
    const beforeFiles = (await readdir(folder)).length;
    await assert.rejects(
      imageStorage.replace({ buffer: png }, async (url) => {
        await prisma.phong.update({
          where: { id: apiRoom.id },
          data: { maViTri: 2147483647, hinhAnh: url },
        });
        return { oldUrl: nextImage.hinhAnh, data: null };
      }),
    );
    assert.equal((await readdir(folder)).length, beforeFiles);
    assert.equal((await fetch(nextImage.hinhAnh)).status, 200);
    checks++;
    await request(
      'DELETE',
      `/api/phong-thue/${apiRoom.id}`,
      200,
      undefined,
      adminToken,
      '/api/phong-thue/{id}',
    );
    await request(
      'DELETE',
      `/api/vi-tri/${loc.id}`,
      200,
      undefined,
      adminToken,
      '/api/vi-tri/{id}',
    );
    await require('./test-admin-mysql.cjs')({
      prisma,
      request,
      admin,
      adminToken,
      profile,
      userIds,
    });
    const concurrentChecks = await require('./test-stays-mysql.cjs')({
      prisma,
      request,
      token,
      adminToken,
      user,
      admin,
      created,
      runId,
      location,
      roomIds,
      bookingIds,
      commentIds,
    });
    checks += concurrentChecks;
    await request('DELETE', `/api/users?id=${user.id}`, 200, undefined, adminToken, '/api/users');
    await request('GET', `/api/users/${user.id}`, 401, undefined, token);
    console.log(
      `PASS real MySQL: ${checks} HTTP/assertion checks; ${covered.size} business operations covered`,
    );
  } finally {
    if (app) await app.close();
    // Guard again; only IDs created by this run, child rows first, no schema reset.
    requireTestTarget(target.toString(), developmentUrl, process.env.TEST_DB_ALLOW_WRITE);
    if (commentIds.length) await prisma.binhLuan.deleteMany({ where: { id: { in: commentIds } } });
    if (bookingIds.length) await prisma.datPhong.deleteMany({ where: { id: { in: bookingIds } } });
    if (roomIds.length) await prisma.phong.deleteMany({ where: { id: { in: roomIds } } });
    if (locationIds.length) await prisma.viTri.deleteMany({ where: { id: { in: locationIds } } });
    if (userIds.length) await prisma.nguoiDung.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
    await rm(folder, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(
    'MySQL integration failed:',
    error instanceof assert.AssertionError ? error.message : (error.code ?? error.name),
  );
  process.exitCode = 1;
});

// Opt-in smoke test for this project's deployment only. Never run the local DB test cleanup here.
const fs = require('node:fs');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const dotenv = require('dotenv');
Object.assign(process.env, dotenv.parse(fs.readFileSync('.env.cloud.local')));
const base = process.env.PUBLIC_URL;
const journalPath = '.env.cloud-verification.local';
const mode = process.argv[2];
if (
  process.env.CLOUD_PUBLIC_VERIFY !== 'true' ||
  !base ||
  new URL(base).protocol !== 'https:' ||
  !new URL(base).hostname.endsWith('.onrender.com') ||
  new URL(process.env.DATABASE_URL).pathname !== '/airbnb_capstone_deploy' ||
  !['prepare', 'after-redeploy'].includes(mode)
)
  throw Error('Explicit verified deployment target required');
const admin = dotenv.parse(fs.readFileSync('.env.cloud-admin.local'));
let checks = 0;
let journal;
const save = () => fs.writeFileSync(journalPath, JSON.stringify(journal, null, 2), { mode: 0o600 });
async function request(method, path, body, token, expected = 200) {
  const response = await fetch(base + path, {
    method,
    signal: AbortSignal.timeout(60000),
    headers: {
      ...(token ? { token } : {}),
      ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
  });
  if (response.status !== expected)
    throw Error(`Unexpected HTTP status for ${method} ${path}: ${response.status}`);
  checks++;
  return response.json();
}
async function signin(email, password) {
  return (await request('POST', '/api/auth/signin', { email, password })).data;
}
async function main() {
  if (mode === 'prepare') {
    if (fs.existsSync(journalPath))
      throw Error('Inspect existing journal before starting another run');
    journal = { base, marker: 'cloud-review-' + crypto.randomUUID(), users: [] };
    fs.writeFileSync(journalPath, JSON.stringify(journal), { flag: 'wx', mode: 0o600 });
  } else {
    journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
    assert.equal(journal.base, base);
    assert.ok(journal.ready && !journal.cleaned);
  }
  await request('GET', '/api/health');
  await request('GET', '/api/health/database');
  const spec = await request('GET', '/api/docs-json');
  assert.equal(
    Object.values(spec.paths).reduce(
      (n, path) =>
        n + Object.keys(path).filter((x) => ['get', 'post', 'put', 'delete'].includes(x)).length,
      0,
    ),
    38,
  );
  const swagger = await fetch(base + '/api/docs', { signal: AbortSignal.timeout(60000) });
  assert.equal(swagger.status, 200);
  checks++;
  const signedAdmin = await signin(admin.ADMIN_EMAIL, admin.ADMIN_PASSWORD);
  assert.equal(signedAdmin.user.role, 'ADMIN');
  const adminToken = signedAdmin.token;
  if (mode === 'prepare') {
    for (let n = 0; n < 2; n++) {
      const password = crypto.randomBytes(24).toString('base64url');
      const email = `${journal.marker}-${n}@example.test`;
      const body = {
        name: journal.marker,
        email,
        password,
        phone: '0901234567',
        gender: false,
        role: 'ADMIN',
      };
      const user = (await request('POST', '/api/auth/signup', body, undefined, 201)).data;
      journal.users.push({ id: user.id, email, password });
      save();
      assert.equal(user.role, 'USER');
      await request('POST', '/api/auth/signup', body, undefined, 409);
    }
    const first = await signin(journal.users[0].email, journal.users[0].password);
    const second = await signin(journal.users[1].email, journal.users[1].password);
    await request(
      'POST',
      '/api/vi-tri',
      { tenViTri: journal.marker, tinhThanh: 'Demo', quocGia: 'Demo' },
      first.token,
      403,
    );
    journal.location = (
      await request(
        'POST',
        '/api/vi-tri',
        { tenViTri: journal.marker, tinhThanh: 'Demo', quocGia: 'Demo' },
        adminToken,
        201,
      )
    ).data.id;
    save();
    const room = {
      tenPhong: journal.marker,
      moTa: journal.marker,
      khach: 2,
      phongNgu: 1,
      giuong: 1,
      phongTam: 1,
      giaTien: 100000,
      maViTri: journal.location,
    };
    for (const key of [
      'mayGiat',
      'banLa',
      'tivi',
      'dieuHoa',
      'wifi',
      'bep',
      'doXe',
      'hoBoi',
      'banUi',
    ])
      room[key] = false;
    journal.room = (await request('POST', '/api/phong-thue', room, adminToken, 201)).data.id;
    save();
    const booking = {
      maPhong: journal.room,
      maNguoiDung: first.user.id,
      soLuongKhach: 1,
      ngayDen: '2040-05-01T00:00:00Z',
      ngayDi: '2040-05-03T00:00:00Z',
    };
    journal.booking = (await request('POST', '/api/dat-phong', booking, first.token, 201)).data.id;
    save();
    await request('POST', '/api/dat-phong', booking, first.token, 409);
    await request('GET', '/api/dat-phong/' + journal.booking, undefined, second.token, 403);
    await request('GET', '/api/dat-phong', undefined, first.token, 403);
    await request('DELETE', '/api/phong-thue/' + journal.room, undefined, adminToken, 409);
    journal.comment = (
      await request(
        'POST',
        '/api/binh-luan',
        {
          maPhong: journal.room,
          maNguoiBinhLuan: first.user.id,
          noiDung: journal.marker,
          saoBinhLuan: 5,
        },
        first.token,
        201,
      )
    ).data.id;
    save();
    await request(
      'PUT',
      '/api/binh-luan/' + journal.comment,
      { noiDung: 'forbidden' },
      second.token,
      403,
    );
    const png = await require('sharp')({
      create: { width: 4, height: 4, channels: 3, background: 'green' },
    })
      .png()
      .toBuffer();
    const form = new FormData();
    form.append('formFile', new Blob([png], { type: 'image/png' }), 'generated-test.png');
    journal.image = (
      await request(
        'POST',
        '/api/phong-thue/upload-hinh-phong?maPhong=' + journal.room,
        form,
        adminToken,
        201,
      )
    ).data.hinhAnh;
    save();
    assert.equal(new URL(journal.image).hostname, 'res.cloudinary.com');
    assert.equal((await fetch(journal.image, { signal: AbortSignal.timeout(30000) })).status, 200);
    checks++;
    journal.ready = true;
    journal.prepareChecks = checks;
    save();
    console.log(
      `PASS public prepare: ${checks} HTTPS checks; own fixture IDs persisted locally for redeploy verification/cleanup. No credentials printed.`,
    );
  } else {
    const room = (await request('GET', '/api/phong-thue/' + journal.room)).data;
    assert.equal(room.tenPhong, journal.marker);
    assert.equal(room.hinhAnh, journal.image);
    assert.equal((await fetch(journal.image, { signal: AbortSignal.timeout(30000) })).status, 200);
    checks++;
    // Each deletion is gated by the marker or relationship of this exact run.
    const comments = (
      await request('GET', '/api/binh-luan/lay-binh-luan-theo-phong/' + journal.room)
    ).data;
    assert.ok(comments.some((c) => c.id === journal.comment && c.noiDung === journal.marker));
    const booking = (
      await request('GET', '/api/dat-phong/' + journal.booking, undefined, adminToken)
    ).data;
    assert.equal(booking.maPhong, journal.room);
    assert.equal(booking.maNguoiDung, journal.users[0].id);
    await request('DELETE', '/api/binh-luan/' + journal.comment, undefined, adminToken);
    await request('DELETE', '/api/dat-phong/' + journal.booking, undefined, adminToken);
    await request('DELETE', '/api/phong-thue/' + journal.room, undefined, adminToken);
    const location = (await request('GET', '/api/vi-tri/' + journal.location)).data;
    assert.equal(location.tenViTri, journal.marker);
    await request('DELETE', '/api/vi-tri/' + journal.location, undefined, adminToken);
    for (const fixture of journal.users) {
      const user = (await request('GET', '/api/users/' + fixture.id, undefined, adminToken)).data;
      assert.equal(user.email, fixture.email);
      assert.equal(user.name, journal.marker);
      await request('DELETE', '/api/users?id=' + fixture.id, undefined, adminToken);
    }
    const { removeCloud, managedCloudId } = require('../dist/common/helpers/cloud-assets');
    assert.ok(managedCloudId(journal.image));
    await removeCloud(journal.image);
    journal.cleaned = true;
    journal.afterChecks = checks;
    save();
    console.log(
      `PASS after redeploy: image and DB persisted, ${checks} checks; cleanup limited to this run's records and signed asset.`,
    );
  }
}
main().catch(() => {
  console.error(
    'Public verification failed; inspect ignored local journal. No broad cleanup or reset attempted.',
  );
  process.exitCode = 1;
});

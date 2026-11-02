const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
module.exports = async function testAdministrators({
  prisma,
  request,
  admin,
  adminToken,
  profile,
  userIds,
}) {
  // Never modify pre-existing test accounts to manufacture a last-admin scenario.
  assert.equal(
    await prisma.nguoiDung.count({ where: { role: 'ADMIN' } }),
    1,
    'Last-admin test requires no pre-existing ADMIN fixtures',
  );
  await request('PUT', `/api/users/${admin.id}`, 409, { role: 'USER' }, adminToken);
  await request('DELETE', `/api/users?id=${admin.id}`, 409, undefined, adminToken);
  const other = await request(
    'POST',
    '/api/users',
    201,
    { ...profile('admin-last-test'), role: 'ADMIN' },
    adminToken,
  );
  userIds.push(other.id);
  const token = (id) =>
    jwt.sign({}, process.env.JWT_SECRET, {
      subject: String(id),
      issuer: 'airbnb-backend',
      audience: 'airbnb-api',
      expiresIn: 300,
    });
  async function race(method, targets) {
    const statuses = await Promise.all(
      targets.map(async ([actor, id]) => {
        const response = await fetch(
          'http://localhost:13071/api/users' + (method === 'PUT' ? '/' + id : '?id=' + id),
          {
            method,
            headers: { token: token(actor), 'Content-Type': 'application/json' },
            ...(method === 'PUT' ? { body: JSON.stringify({ role: 'USER' }) } : {}),
          },
        );
        return response.status;
      }),
    );
    assert.equal(statuses.filter((x) => x === 200).length, 1);
    assert.ok(statuses.every((x) => [200, 403, 409].includes(x)));
    assert.equal(await prisma.nguoiDung.count({ where: { role: 'ADMIN' } }), 1);
  }
  await race('PUT', [
    [admin.id, other.id],
    [other.id, admin.id],
  ]);
  const survivor = await prisma.nguoiDung.findFirst({ where: { role: 'ADMIN' } });
  await request('PUT', `/api/users/${admin.id}`, 200, { role: 'ADMIN' }, token(survivor.id));
  await request('PUT', `/api/users/${other.id}`, 200, { role: 'ADMIN' }, adminToken);
  await race('PUT', [
    [admin.id, admin.id],
    [other.id, other.id],
  ]);
  const remaining = await prisma.nguoiDung.findFirst({ where: { role: 'ADMIN' } });
  await request('PUT', `/api/users/${admin.id}`, 200, { role: 'ADMIN' }, token(remaining.id));
  await request('PUT', `/api/users/${other.id}`, 200, { role: 'ADMIN' }, adminToken);
  await race('DELETE', [
    [admin.id, other.id],
    [other.id, admin.id],
  ]);
  // If the main fixture was deleted, recreate only that fixture for subsequent regression checks.
  if (!(await prisma.nguoiDung.findUnique({ where: { id: admin.id } }))) {
    const remainingAdmin = await prisma.nguoiDung.findFirst({ where: { role: 'ADMIN' } });
    await prisma.nguoiDung.create({
      data: {
        id: admin.id,
        ...profile('admin-restored'),
        birthday: new Date('2000-02-29Z'),
        password: await require('bcrypt').hash('Test-password-2026', 10),
        role: 'ADMIN',
      },
    });
    await request('DELETE', `/api/users?id=${remainingAdmin.id}`, 200, undefined, adminToken);
  }
  console.log(
    'PASS MySQL last ADMIN: delete/demotion blocked; cross-demotion, self-demotion and cross-deletion races preserve an ADMIN',
  );
};

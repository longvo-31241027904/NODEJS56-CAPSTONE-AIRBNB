const assert = require('node:assert/strict');
module.exports = async function testStays(c) {
  const {
    prisma,
    request: r,
    token,
    adminToken,
    user,
    created,
    runId,
    location,
    roomIds,
    bookingIds,
    commentIds,
  } = c;
  const localBookings = [],
    localComments = [];
  let concurrentChecks = 0;
  const rooms = [];
  for (let i = 0; i < 2; i++) {
    const room = await prisma.phong.create({
      data: {
        tenPhong: `${runId}-stay-${i}`,
        khach: 2,
        phongNgu: 1,
        giuong: 1,
        phongTam: 1,
        moTa: 'Stays fixture',
        giaTien: 1,
        maViTri: location.id,
      },
    });
    rooms.push(room);
    roomIds.push(room.id);
  }
  const dates = (start = 10, end = 12) => ({
    ngayDen: `2040-01-${String(start).padStart(2, '0')}T00:00:00Z`,
    ngayDi: `2040-01-${String(end).padStart(2, '0')}T00:00:00Z`,
  });
  const data = (room = rooms[0], start = 10, end = 12) => ({
    maPhong: room.id,
    maNguoiDung: user.id,
    soLuongKhach: 1,
    ...dates(start, end),
  });
  async function book(body, status = 201, t = token) {
    const value = await r('POST', '/api/dat-phong', status, body, t);
    if (status === 201) {
      bookingIds.push(value.id);
      localBookings.push(value.id);
    }
    return value;
  }
  const update = (id, body, status = 200, t = token) =>
    r('PUT', `/api/dat-phong/${id}`, status, body, t, '/api/dat-phong/{id}');
  async function race(requests) {
    const replies = await Promise.all(
      requests.map(async ({ method = 'POST', body, id }) => {
        const res = await fetch('http://localhost:13071/api/dat-phong' + (id ? '/' + id : ''), {
          method,
          headers: { token, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const json = await res.json();
        if (res.status === 201) {
          bookingIds.push(json.data.id);
          localBookings.push(json.data.id);
        }
        return res.status;
      }),
    );
    concurrentChecks += replies.length;
    return replies;
  }
  try {
    await r('GET', '/api/dat-phong', 401);
    await r('GET', '/api/dat-phong', 401, undefined, 'bad');
    await r('GET', '/api/dat-phong', 403, undefined, token);
    await r('GET', '/api/dat-phong/invalid', 400, undefined, token);
    await r('GET', '/api/binh-luan/lay-binh-luan-theo-phong/invalid', 400);
    await r('GET', '/api/dat-phong', 200, undefined, adminToken);
    await book({ ...data(), maNguoiDung: created.id }, 403);
    await book({ ...data(), maPhong: 2147483647 }, 404);
    await book({ ...data(), maNguoiDung: 2147483647 }, 404, adminToken);
    for (const patch of [
      { ngayDen: '2040-02-30T00:00:00Z' },
      { ngayDen: '2040-01-10T00:00:00' },
      { ngayDen: 'bad' },
      dates(12, 12),
      dates(13, 12),
      { soLuongKhach: 0 },
      { soLuongKhach: 3 },
      { soLuongKhach: 1.5 },
    ])
      await book({ ...data(), ...patch }, 400);
    const first = await book(data());
    await r('GET', `/api/dat-phong/${first.id}`, 200, undefined, token, '/api/dat-phong/{id}');
    await r('GET', `/api/dat-phong/${first.id}`, 200, undefined, adminToken, '/api/dat-phong/{id}');
    const other = await book({ ...data(rooms[1]), maNguoiDung: created.id }, 201, adminToken);
    await r('GET', `/api/dat-phong/${other.id}`, 403, undefined, token);
    await update(other.id, { soLuongKhach: 1 }, 403);
    await r('DELETE', `/api/dat-phong/${other.id}`, 403, undefined, token);
    await r(
      'GET',
      `/api/dat-phong/lay-theo-nguoi-dung/${user.id}`,
      200,
      undefined,
      token,
      '/api/dat-phong/lay-theo-nguoi-dung/{MaNguoiDung}',
    );
    await r('GET', `/api/dat-phong/lay-theo-nguoi-dung/${created.id}`, 403, undefined, token);
    await update(first.id, { maNguoiDung: created.id }, 403);
    await update(first.id, { soLuongKhach: 1 });
    for (const [start, end] of [
      [10, 12],
      [9, 11],
      [11, 13],
      [9, 13],
      [10, 11],
      [11, 12],
    ])
      await book(data(rooms[0], start, end), 409);
    const adjacent = await book(data(rooms[0], 12, 14));
    await update(adjacent.id, dates(11, 14), 409);
    await update(adjacent.id, { maPhong: rooms[1].id, ...dates(10, 12) }, 409);
    await update(adjacent.id, { maPhong: rooms[1].id, ...dates(12, 14) });
    await update(adjacent.id, { soLuongKhach: 3 }, 400);
    const offset = await book({
      ...data(rooms[0], 14, 15),
      ngayDen: '2040-01-14T07:00:00+07:00',
      ngayDi: '2040-01-15T07:00:00+07:00',
    });
    assert.equal(offset.ngayDen, '2040-01-14T00:00:00.000Z');
    const past = await book({
      ...data(rooms[0]),
      ngayDen: '2000-01-01T00:00:00Z',
      ngayDi: '2000-01-02T00:00:00Z',
    });
    assert.ok(past.id);
    // Repeat same-room races with fresh intervals: exactly one commit each time.
    for (let round = 0; round < 3; round++) {
      const body = {
        ...data(),
        ngayDen: `2041-0${round + 1}-01T00:00:00Z`,
        ngayDi: `2041-0${round + 1}-02T00:00:00Z`,
      };
      const statuses = await race(Array.from({ length: 6 }, () => ({ body })));
      assert.equal(statuses.filter((s) => s === 201).length, 1);
      assert.equal(statuses.filter((s) => s === 409).length, 5);
      assert.equal(
        await prisma.datPhong.count({
          where: { maPhong: body.maPhong, ngayDen: new Date(body.ngayDen) },
        }),
        1,
      );
      concurrentChecks++;
    }
    // Create vs update contend for the same destination room and interval.
    const moving = await book({
      ...data(rooms[1]),
      ngayDen: '2042-01-01T00:00:00Z',
      ngayDi: '2042-01-02T00:00:00Z',
    });
    const destination = {
      ...data(),
      ngayDen: '2042-02-01T00:00:00Z',
      ngayDi: '2042-02-02T00:00:00Z',
    };
    const competition = await race([
      { body: destination },
      { method: 'PUT', id: moving.id, body: destination },
    ]);
    assert.equal(competition.filter((s) => s === 200 || s === 201).length, 1);
    assert.equal(competition.filter((s) => s === 409).length, 1);
    assert.equal(
      await prisma.datPhong.count({
        where: { maPhong: destination.maPhong, ngayDen: new Date(destination.ngayDen) },
      }),
      1,
    );
    concurrentChecks++;
    const independent = await race(
      rooms.map((room) => ({
        body: { ...data(room), ngayDen: '2043-01-01T00:00:00Z', ngayDi: '2043-01-02T00:00:00Z' },
      })),
    );
    assert.deepEqual(independent, [201, 201]);
    await r('DELETE', `/api/dat-phong/${first.id}`, 200, undefined, token, '/api/dat-phong/{id}');
    await r('GET', `/api/dat-phong/${first.id}`, 404, undefined, token);
    const commentData = {
      maPhong: rooms[0].id,
      maNguoiBinhLuan: user.id,
      noiDung: '  Great room  ',
      saoBinhLuan: 5,
      ngayBinhLuan: '1900-01-01',
    };
    await r('POST', '/api/binh-luan', 401, commentData);
    await r('POST', '/api/binh-luan', 403, { ...commentData, maNguoiBinhLuan: created.id }, token);
    await r('POST', '/api/binh-luan', 404, { ...commentData, maPhong: 2147483647 }, token);
    for (const patch of [
      { noiDung: '   ' },
      { saoBinhLuan: 0 },
      { saoBinhLuan: 6 },
      { saoBinhLuan: 1.2 },
    ])
      await r('POST', '/api/binh-luan', 400, { ...commentData, ...patch }, token);
    const comment = await r('POST', '/api/binh-luan', 201, commentData, token);
    commentIds.push(comment.id);
    localComments.push(comment.id);
    assert.equal(comment.noiDung, 'Great room');
    assert.notEqual(comment.ngayBinhLuan.slice(0, 4), '1900');
    const publicComments = await r('GET', '/api/binh-luan', 200);
    const roomComments = await r(
      'GET',
      `/api/binh-luan/lay-binh-luan-theo-phong/${rooms[0].id}`,
      200,
      undefined,
      undefined,
      '/api/binh-luan/lay-binh-luan-theo-phong/{MaPhong}',
    );
    for (const values of [publicComments, roomComments]) {
      assert.ok(!/"(email|phone|password)"/.test(JSON.stringify(values)));
      assert.ok(values.some((x) => x.id === comment.id));
    }
    const adminComment = await r(
      'POST',
      '/api/binh-luan',
      201,
      { ...commentData, maNguoiBinhLuan: c.admin.id },
      adminToken,
    );
    commentIds.push(adminComment.id);
    localComments.push(adminComment.id);
    await r('PUT', `/api/binh-luan/${adminComment.id}`, 403, { noiDung: 'not allowed' }, token);
    await r('DELETE', `/api/binh-luan/${adminComment.id}`, 403, undefined, token);
    await r(
      'PUT',
      `/api/binh-luan/${comment.id}`,
      403,
      { maNguoiBinhLuan: created.id },
      adminToken,
    );
    const updated = await r(
      'PUT',
      `/api/binh-luan/${comment.id}`,
      200,
      { noiDung: 'Updated', ngayBinhLuan: 'ignored' },
      token,
      '/api/binh-luan/{id}',
    );
    assert.equal(updated.ngayBinhLuan, comment.ngayBinhLuan);
    await r(
      'DELETE',
      `/api/binh-luan/${comment.id}`,
      200,
      undefined,
      adminToken,
      '/api/binh-luan/{id}',
    );
    console.log(
      'PASS concurrency: 3 x 6 same-room creates each yielded 1 success + 5 conflicts; create/update race yielded 1 success + 1 conflict; different rooms both succeeded. DB counts verified.',
    );
    return concurrentChecks;
  } finally {
    if (localComments.length)
      await prisma.binhLuan.deleteMany({ where: { id: { in: localComments } } });
    if (localBookings.length)
      await prisma.datPhong.deleteMany({ where: { id: { in: localBookings } } });
  }
};

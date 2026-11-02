import 'dotenv/config';
import bcrypt from 'bcrypt';
import { createClient } from '../src/modules-system/prisma/create-client';

async function seed() {
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (
    process.env.SEED_ALLOW_LOCAL !== 'true' ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    url.pathname !== '/airbnb_capstone_local'
  )
    throw new Error('Seed requires opt-in and dedicated local database');
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const userPassword = process.env.SEED_USER_PASSWORD;
  if (
    !email ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !adminPassword ||
    adminPassword.length < 12 ||
    !userPassword ||
    userPassword.length < 12 ||
    Buffer.byteLength(adminPassword) > 72 ||
    Buffer.byteLength(userPassword) > 72
  ) {
    throw new Error('Set seed admin email and both seed passwords (at least 12 characters)');
  }
  if (email.toLowerCase() === 'demo-user@example.test')
    throw new Error('Admin email must differ from demo user');
  const prisma = createClient(url);
  try {
    const hashes = await Promise.all([
      bcrypt.hash(adminPassword, 10),
      bcrypt.hash(userPassword, 10),
    ]);
    await prisma.$transaction(async (tx) => {
      const admin = await tx.nguoiDung.findUnique({ where: { email } });
      if (admin && admin.role !== 'ADMIN')
        throw new Error('Existing account is not ADMIN; seed will not elevate it');
      await tx.nguoiDung.upsert({
        where: { email },
        update: {},
        create: {
          name: 'Demo Admin',
          email,
          password: hashes[0],
          phone: '0900000000',
          gender: true,
          role: 'ADMIN',
        },
      });
      const user = await tx.nguoiDung.upsert({
        where: { email: 'demo-user@example.test' },
        update: {},
        create: {
          name: 'Demo User',
          email: 'demo-user@example.test',
          password: hashes[1],
          phone: '0900000001',
          gender: false,
          birthday: new Date('2000-01-01T00:00:00Z'),
        },
      });
      // Match dedicated demo records without changing existing rows or resetting passwords.
      let location = await tx.viTri.findFirst({
        where: { tenViTri: 'Demo - Da Nang', tinhThanh: 'Da Nang', quocGia: 'Viet Nam' },
      });
      location ??= await tx.viTri.create({
        data: { tenViTri: 'Demo - Da Nang', tinhThanh: 'Da Nang', quocGia: 'Viet Nam' },
      });
      let room = await tx.phong.findFirst({
        where: { maViTri: location.id, tenPhong: 'Demo - Studio' },
      });
      room ??= await tx.phong.create({
        data: {
          tenPhong: 'Demo - Studio',
          maViTri: location.id,
          khach: 2,
          phongNgu: 1,
          giuong: 1,
          phongTam: 1,
          moTa: 'Demo seed room',
          giaTien: 500000,
          wifi: true,
        },
      });
      const ngayDen = new Date('2030-01-10T07:00:00Z');
      if (
        !(await tx.datPhong.findFirst({
          where: { maPhong: room.id, maNguoiDung: user.id, ngayDen },
        }))
      ) {
        await tx.datPhong.create({
          data: {
            maPhong: room.id,
            maNguoiDung: user.id,
            ngayDen,
            ngayDi: new Date('2030-01-12T07:00:00Z'),
            soLuongKhach: 2,
          },
        });
      }
      if (
        !(await tx.binhLuan.findFirst({
          where: { maPhong: room.id, maNguoiBinhLuan: user.id, noiDung: 'Demo seed comment' },
        }))
      ) {
        await tx.binhLuan.create({
          data: {
            maPhong: room.id,
            maNguoiBinhLuan: user.id,
            noiDung: 'Demo seed comment',
            saoBinhLuan: 5,
          },
        });
      }
    });
    console.log('Local demo seed completed; existing records and passwords preserved.');
  } finally {
    await prisma.$disconnect();
  }
}
seed().catch(() => {
  console.error('Seed failed; verify local target and seed configuration. No credentials printed.');
  process.exitCode = 1;
});

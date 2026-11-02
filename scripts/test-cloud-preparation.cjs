const assert = require('node:assert/strict');
const { Writable } = require('node:stream');
const sharp = require('sharp');
process.env.JWT_SECRET = 'cloud-unit-test-only-key-over-32-bytes';
process.env.DATABASE_URL = 'mysql://unused:unused@localhost:3306/airbnb_unit';
process.env.IMAGE_STORAGE = 'cloudinary';
process.env.CLOUDINARY_CLOUD_NAME = 'unit-cloud';
process.env.CLOUDINARY_API_KEY = 'unit-key';
process.env.CLOUDINARY_API_SECRET = 'unit-secret';
const {
  parseDatabase,
  databaseTls,
  migrationDatabaseUrl,
} = require('../dist/common/config/database');
const url = parseDatabase(
  'mysql://user:unused@db.example.test:25000/airbnb_capstone_deploy?ssl-mode=REQUIRED',
);
assert.throws(() => databaseTls(url));
process.env.DB_CA_CERT_BASE64 = Buffer.from(require('node:tls').rootCertificates[0]).toString(
  'base64',
);
const ssl = databaseTls(url);
assert.equal(ssl.rejectUnauthorized, true);
assert.equal(ssl.servername, 'db.example.test');
const cli = new URL(migrationDatabaseUrl(url.toString()));
assert.equal(cli.searchParams.get('sslaccept'), 'strict');
assert.ok(require('node:fs').existsSync(cli.searchParams.get('sslcert')));
assert.throws(() =>
  parseDatabase('mysql://user:unused@db.example.test/db?sslaccept=accept_invalid_certs'),
);
assert.throws(() => parseDatabase('mysql://user:unused@db.example.test/db?ssl-mode=DISABLED'));
assert.throws(() => parseDatabase('mysql://user:unused@db.example.test/db?unknown=1'));
delete process.env.DB_CA_CERT_BASE64;
const sdk = require('cloudinary').v2;
const removed = [];
let failUpload = false;
sdk.uploader.upload_stream = (options, callback) =>
  new Writable({
    write(_chunk, _encoding, done) {
      done();
    },
    final(done) {
      if (failUpload) callback(new Error('simulated upload failure'));
      else
        callback(null, {
          public_id: options.public_id,
          secure_url: `https://res.cloudinary.com/unit-cloud/image/upload/v1/${options.public_id}.webp`,
        });
      done();
    },
  });
sdk.uploader.destroy = async (id) => {
  removed.push(id);
  return { result: 'ok' };
};
const { ImageStorage } = require('../dist/common/helpers/image-storage');
const { managedCloudId } = require('../dist/common/helpers/cloud-assets');
async function main() {
  const service = new ImageStorage();
  const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'red' } })
    .png()
    .toBuffer();
  let old;
  await service.replace({ buffer: png }, async (url) => {
    old = url;
    return { oldUrl: null, data: true };
  });
  assert.ok(managedCloudId(old));
  await service.replace({ buffer: png }, async () => ({ oldUrl: old, data: true }));
  assert.equal(removed.length, 1);
  await assert.rejects(
    service.replace({ buffer: png }, async () => {
      throw new Error('database failed');
    }),
  );
  assert.equal(removed.length, 2);
  await service.replace({ buffer: png }, async () => ({
    oldUrl: old.replace('airbnb_sig=', 'airbnb_sig=x'),
    data: true,
  }));
  assert.equal(removed.length, 2);
  await service.replace({ buffer: png }, async () => ({
    oldUrl: 'https://res.cloudinary.com/unit-cloud/image/upload/v1/personal/photo.webp',
    data: true,
  }));
  assert.equal(removed.length, 2);
  failUpload = true;
  let called = false;
  await assert.rejects(
    service.replace({ buffer: png }, async () => {
      called = true;
      return { oldUrl: old, data: true };
    }),
  );
  assert.equal(called, false);
  assert.equal(removed.length, 2);
  console.log(
    'PASS cloud preparation: strict CA/TLS and CLI URL configuration; Cloudinary mocked success/rollback/ownership/upload failure. NOT a live cloud test.',
  );
}
main().catch(() => {
  console.error('Cloud preparation tests failed (details suppressed)');
  process.exitCode = 1;
});

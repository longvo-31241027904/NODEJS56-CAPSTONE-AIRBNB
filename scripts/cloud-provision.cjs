// One-time provisioning of a NEW Airbnb namespace only. No changes to existing schemas/users.
const fs = require('node:fs');
const crypto = require('node:crypto');
const dotenv = require('dotenv');
const mariadb = require('mariadb');
async function main() {
  if (process.env.CLOUD_PROVISION_NEW !== 'true') throw Error('Explicit opt-in required');
  const env = dotenv.parse(fs.readFileSync('.env.cloud-provision.local'));
  const database = 'airbnb_capstone_deploy';
  const username = 'airbnb_deploy_app';
  if (!env.AIVEN_ADMIN_HOST?.endsWith('.aivencloud.com') || fs.existsSync('.env.cloud.local'))
    throw Error('Inspect target/existing cloud configuration first');
  const ca = fs.readFileSync(env.DB_CA_CERT_PATH, 'utf8');
  const connection = await mariadb.createConnection({
    host: env.AIVEN_ADMIN_HOST,
    port: Number(env.AIVEN_ADMIN_PORT),
    user: env.AIVEN_ADMIN_USER,
    password: env.AIVEN_ADMIN_PASSWORD,
    ssl: { ca, rejectUnauthorized: true, servername: env.AIVEN_ADMIN_HOST, minVersion: 'TLSv1.2' },
    connectTimeout: 15000,
  });
  try {
    const [tls] = await connection.query("SHOW SESSION STATUS LIKE 'Ssl_cipher'");
    if (!tls?.Value) throw Error('TLS required');
    const schemas = await connection.query(
      'SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?',
      [database],
    );
    if (schemas.length) throw Error('Database exists; ownership must be investigated');
    const users = await connection.query('SELECT User FROM mysql.user WHERE User = ?', [username]);
    if (users.length) throw Error('User exists; will not alter it');
    const password = crypto.randomBytes(32).toString('base64url');
    const url = new URL(
      'mysql://' + env.AIVEN_ADMIN_HOST + ':' + env.AIVEN_ADMIN_PORT + '/' + database,
    );
    url.username = username;
    url.password = password;
    // Preserve generated credentials before nontransactional DDL. Never overwrite this file on rerun.
    fs.writeFileSync(
      '.env.cloud.local',
      [
        'DATABASE_URL=' + url.toString(),
        'DB_TLS_REQUIRED=true',
        'DB_CA_CERT_PATH=' + env.DB_CA_CERT_PATH,
        'DB_CA_CERT_BASE64=' + Buffer.from(ca).toString('base64'),
        'CLOUD_ALLOW_WRITE=true',
        'CLOUD_DB_OWNERSHIP_CONFIRMED=true',
        'CLOUD_DB_EXPECTED_HOST=' + env.AIVEN_ADMIN_HOST,
        'CLOUD_DB_EXPECTED_DATABASE=' + database,
        'CLOUD_BOOTSTRAP_ADMIN=false',
        'IMAGE_STORAGE=cloudinary',
        'JWT_SECRET=' + crypto.randomBytes(48).toString('base64url'),
        'CLOUDINARY_ASSET_SIGNING_KEY=' + crypto.randomBytes(48).toString('base64url'),
        'TRUST_PROXY_HOPS=1',
        '',
      ].join('\n'),
      { flag: 'wx', mode: 0o600 },
    );
    await connection.query(
      'CREATE DATABASE `airbnb_capstone_deploy` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci',
    );
    await connection.query('CREATE USER ?@? IDENTIFIED BY ? REQUIRE SSL', [
      username,
      '%',
      password,
    ]);
    const [settings] = await connection.query('SELECT @@partial_revokes AS enabled');
    const grantTarget = Number(settings.enabled) ? database : database.replaceAll('_', '\\_');
    await connection.query(
      'GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES ON ' +
        connection.escapeId(grantTarget) +
        '.* TO ?@?',
      [username, '%'],
    );
    const grants = await connection.query('SHOW GRANTS FOR ?@?', [username, '%']);
    const text = grants.map((row) => Object.values(row)[0]).join('\n');
    if (
      /ALL PRIVILEGES|GRANT OPTION/.test(text) ||
      text.split('\n').some((line) => / ON \*\.\*/.test(line) && !/GRANT USAGE ON/.test(line))
    )
      throw Error('Unexpected account scope');
    console.log(
      'Created NEW Airbnb database and dedicated TLS-only account; schema-scoped grants verified. Credentials saved locally (ignored).',
    );
  } finally {
    await connection.end();
  }
}
main().catch((error) => {
  console.error(
    JSON.stringify({
      provisioned: false,
      code: error.code || 'PROVISION_STOPPED',
      errno: error.errno,
    }),
  );
  process.exitCode = 1;
});

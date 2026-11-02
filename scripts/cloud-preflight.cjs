// Read-only Aiven connectivity/ownership preflight. Never prints credentials.
const fs = require('node:fs');
const dotenv = require('dotenv');
const mariadb = require('mariadb');

async function main() {
  const env = dotenv.parse(fs.readFileSync('.env.cloud-provision.local'));
  if (!env.AIVEN_ADMIN_HOST?.endsWith('.aivencloud.com')) throw Error('Unexpected host');
  const connection = await mariadb.createConnection({
    host: env.AIVEN_ADMIN_HOST,
    port: Number(env.AIVEN_ADMIN_PORT),
    user: env.AIVEN_ADMIN_USER,
    password: env.AIVEN_ADMIN_PASSWORD,
    ssl: {
      ca: fs.readFileSync(env.DB_CA_CERT_PATH, 'utf8'),
      rejectUnauthorized: true,
      servername: env.AIVEN_ADMIN_HOST,
      minVersion: 'TLSv1.2',
    },
    connectTimeout: 15000,
  });
  try {
    const [server] = await connection.query('SELECT VERSION() AS version');
    const [tls] = await connection.query("SHOW SESSION STATUS LIKE 'Ssl_cipher'");
    const schemas = await connection.query(
      'SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?',
      ['airbnb_capstone_deploy'],
    );
    console.log(
      JSON.stringify({
        connected: true,
        version: server.version,
        tls: !!tls?.Value,
        airbnbDatabaseExists: schemas.length > 0,
      }),
    );
    if (fs.existsSync('.env.cloud.local')) {
      const app = dotenv.parse(fs.readFileSync('.env.cloud.local'));
      const url = new URL(app.DATABASE_URL);
      const [setting] = await connection.query('SELECT @@partial_revokes AS partialRevokes');
      const grants = await connection.query('SHOW GRANTS FOR ?@?', [
        decodeURIComponent(url.username),
        '%',
      ]);
      console.log(
        JSON.stringify({
          partialRevokes: String(setting.partialRevokes),
          grants: grants.map((row) => Object.values(row)[0]),
        }),
      );
    }
  } finally {
    await connection.end();
  }
}
main().catch((error) => {
  console.error(
    JSON.stringify({
      connected: false,
      code: error.code || 'PREFLIGHT_FAILED',
      errno: error.errno,
    }),
  );
  process.exitCode = 1;
});

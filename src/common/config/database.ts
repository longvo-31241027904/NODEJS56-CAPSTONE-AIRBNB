import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { X509Certificate } from 'node:crypto';
export function parseDatabase(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('DATABASE_URL is invalid');
  }
  if (
    url.protocol !== 'mysql:' ||
    !url.username ||
    !url.hostname ||
    url.pathname.length < 2 ||
    url.hash
  )
    throw new Error('Invalid MySQL connection URL');
  for (const [key, value] of url.searchParams) {
    if (key === 'sslaccept' && value === 'strict') continue;
    if (key === 'sslcert' && value) continue;
    if (
      ['ssl-mode', 'sslmode'].includes(key) &&
      ['REQUIRED', 'VERIFY_CA', 'VERIFY_IDENTITY', 'require'].includes(value)
    )
      continue;
    throw new Error('Unsupported or insecure database URL option');
  }
  return url;
}
export function databaseTls(url: URL) {
  const required = process.env.DB_TLS_REQUIRED === 'true' || !!url.search;
  if (!required) return undefined;
  const certPath = process.env.DB_CA_CERT_PATH || url.searchParams.get('sslcert');
  const ca = process.env.DB_CA_CERT_BASE64
    ? Buffer.from(process.env.DB_CA_CERT_BASE64, 'base64').toString('utf8')
    : certPath
      ? readFileSync(certPath, 'utf8')
      : '';
  if (!ca.includes('-----BEGIN CERTIFICATE-----') || ca.includes('PRIVATE KEY'))
    throw new Error('Database TLS requires a PEM CA certificate');
  try {
    new X509Certificate(ca);
  } catch {
    throw new Error('Invalid database CA certificate');
  }
  return {
    ca,
    rejectUnauthorized: true as const,
    servername: url.hostname,
    minVersion: 'TLSv1.2' as const,
  };
}
export function migrationDatabaseUrl(raw: string) {
  if (!raw) return '';
  const url = parseDatabase(raw);
  const tls = databaseTls(url);
  url.search = '';
  if (tls) {
    const caFile = path.join(mkdtempSync(path.join(tmpdir(), 'airbnb-ca-')), 'ca.pem');
    writeFileSync(caFile, tls.ca, { mode: 0o600 });
    url.searchParams.set('sslcert', caFile);
    url.searchParams.set('sslaccept', 'strict');
  }
  return url.toString();
}

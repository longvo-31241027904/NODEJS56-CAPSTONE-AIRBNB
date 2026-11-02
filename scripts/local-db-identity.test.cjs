const { test } = require('node:test');
const assert = require('node:assert/strict');
const { verifyLocalIdentity } = require('./local-db-identity.cjs');
test('allows local direct and host-mapped connections without equating ports', () => {
  for (const port of [3306, 3308])
    assert.equal(
      verifyLocalIdentity(new URL(`mysql://app:unused@127.0.0.1:${port}/airbnb_capstone_local`), {
        database_name: 'airbnb_capstone_local',
        server_port: 3306,
      }).clientPort,
      port,
    );
});
test('mapped port does not bypass database/host checks', () => {
  assert.throws(() =>
    verifyLocalIdentity(new URL('mysql://app:unused@remote.test:3308/airbnb_capstone_local'), {
      database_name: 'airbnb_capstone_local',
      server_port: 3306,
    }),
  );
  assert.throws(() =>
    verifyLocalIdentity(new URL('mysql://app:unused@localhost:3308/airbnb_capstone_local'), {
      database_name: 'another_project',
      server_port: 3306,
    }),
  );
});

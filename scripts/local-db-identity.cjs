const assert = require('node:assert/strict');
function verifyLocalIdentity(url, identity) {
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), 'Requires loopback host');
  assert.equal(url.protocol, 'mysql:');
  assert.equal(url.pathname, '/airbnb_capstone_local');
  assert.ok(
    !url.search && !url.hash && url.username && url.password,
    'Invalid local database configuration',
  );
  assert.equal(
    identity.database_name,
    'airbnb_capstone_local',
    'Unexpected connected database; no writes allowed',
  );
  assert.ok(
    Number.isInteger(Number(identity.server_port)) &&
      Number(identity.server_port) > 0 &&
      Number(identity.server_port) <= 65535,
    'Invalid server port',
  );
  // The URL port is the client endpoint; @@port belongs to MySQL inside its network namespace.
  return { clientPort: Number(url.port || 3306), serverPort: Number(identity.server_port) };
}
module.exports = { verifyLocalIdentity };

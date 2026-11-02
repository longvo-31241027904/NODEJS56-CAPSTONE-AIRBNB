// Test runners must call this BEFORE migration or any write/cleanup.
function requireTestTarget(testUrl, developmentUrl, optIn) {
  if (optIn !== 'true')
    throw new Error(
      'Set TEST_DB_ALLOW_WRITE=true only after confirming the test schema belongs to this project',
    );
  let test, development;
  try {
    test = new URL(testUrl);
    development = new URL(developmentUrl);
  } catch {
    throw new Error('Invalid database configuration');
  }
  if (
    test.protocol !== 'mysql:' ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(test.hostname) ||
    test.pathname !== '/airbnb_capstone_test' ||
    test.search ||
    test.hash ||
    decodeURIComponent(test.username) !== 'airbnb_test_app'
  )
    throw new Error('Expected dedicated local test database and test account');
  if (development.pathname === test.pathname || development.username === test.username) {
    throw new Error('Development and test must use separate database names and accounts');
  }
  return test;
}
module.exports = { requireTestTarget };

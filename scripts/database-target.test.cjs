const { test } = require('node:test');
const assert = require('node:assert/strict');
const { requireTestTarget } = require('./database-target.cjs');
const dev = 'mysql://airbnb_local_app:unused@127.0.0.1:3306/airbnb_capstone_local';
const target = 'mysql://airbnb_test_app:unused@127.0.0.1:3306/airbnb_capstone_test';
test('accepts explicit opt-in for separate local test database/account', () => {
  assert.equal(requireTestTarget(target, dev, 'true').pathname, '/airbnb_capstone_test');
});
test('rejects unsafe cleanup targets before a connection or write', () => {
  for (const value of [
    dev,
    target.replace('127.0.0.1', 'remote.example.test'),
    target.replace('airbnb_capstone_test', 'another_project'),
    target.replace('airbnb_test_app', 'root'),
    target + '?option=1',
    'invalid',
  ]) {
    assert.throws(() => requireTestTarget(value, dev, 'true'));
  }
  assert.throws(() => requireTestTarget(target, dev, 'false'));
  assert.throws(() => requireTestTarget(target, target, 'true'));
});

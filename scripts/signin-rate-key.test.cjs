const test = require('node:test');
const assert = require('node:assert/strict');
const { signinRateKey } = require('../dist/common/helpers/signin-rate-key');
test('trusts Cloudflare client header only at Render ingress; ignores spoofed XFF', () => {
  const previous = process.env.RENDER;
  const req = {
    ip: '192.0.2.10',
    socket: {},
    get: (name) => (name === 'cf-connecting-ip' ? '198.51.100.20' : '203.0.113.5'),
  };
  try {
    delete process.env.RENDER;
    assert.equal(signinRateKey(req), '192.0.2.10');
    process.env.RENDER = 'true';
    assert.equal(signinRateKey(req), '198.51.100.20');
    req.get = () => 'invalid, forwarded value';
    assert.equal(signinRateKey(req), '192.0.2.10');
  } finally {
    if (previous === undefined) delete process.env.RENDER;
    else process.env.RENDER = previous;
  }
});

const fs = require('node:fs');
const assert = require('node:assert/strict');
const spec = JSON.parse(fs.readFileSync('docs/airbnb-reference.swagger.json', 'utf8'));
const collection = JSON.parse(
  fs.readFileSync('docs/postman/airbnb.postman_collection.json', 'utf8'),
);
const environment = JSON.parse(
  fs.readFileSync('docs/postman/airbnb.postman_environment.json', 'utf8'),
);
assert.equal(
  collection.info.schema,
  'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
);
const expected = new Set(
  Object.entries(spec.paths).flatMap(([path, ops]) =>
    Object.keys(ops).map((method) => method.toUpperCase() + ' ' + path),
  ),
);
const actual = new Set();
for (const folder of collection.item)
  for (const item of folder.item) {
    assert.ok(expected.has(item.name), 'Unknown method/path');
    assert.equal(item.request.method, item.name.split(' ')[0]);
    const referencePath = item.name.slice(item.request.method.length + 1);
    const normalize = (s) =>
      s
        .replace(/\{\{[^}]+\}\}/g, '{value}')
        .replace(/\{(id|MaPhong|MaNguoiDung|TenNguoiDung)\}/g, '{value}')
        .replace(/\/[^/]*\{value\}[^/]*(?=\/|$)/g, '/{value}');
    assert.equal(
      normalize(item.request.url.raw.replace('{{baseUrl}}', '').split('?')[0]),
      normalize(referencePath),
    );
    actual.add(item.name);
    if (item.request.body?.mode === 'raw')
      JSON.parse(item.request.body.raw.replace(/\{\{[^}]+\}\}/g, '1'));
    for (const event of item.event) new Function('pm', event.script.exec.join('\n'));
    if (item.request.method === 'DELETE')
      assert.ok(
        item.event.some(
          (e) =>
            e.listen === 'prerequest' &&
            e.script.exec.join('\n').includes('pm.execution.skipRequest()') &&
            e.script.exec.join('\n').includes('created_'),
        ),
      );
    if (item.request.body?.mode === 'formdata')
      assert.equal(item.request.body.formdata[0].key, 'formFile');
  }
assert.equal(actual.size, 36);
assert.deepEqual(actual, expected);
for (const item of environment.values)
  if (item.key.includes('Password')) assert.equal(item.value, '');
console.log(
  'PASS Postman static validation: 36 method/paths, JSON bodies, script syntax, upload and DELETE guards. Collection NOT executed.',
);

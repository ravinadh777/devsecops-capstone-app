'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateTitle, validateId, validatePatch, HttpError } = require('../../src/validation');

test('validateTitle trims and accepts a normal title', () => {
  assert.equal(validateTitle('  Learn Helm  '), 'Learn Helm');
});

test('validateTitle rejects empty, whitespace, non-string and over-long titles', () => {
  for (const bad of ['', '   ', undefined, null, 42, {}, 'x'.repeat(121)]) {
    assert.throws(() => validateTitle(bad), (e) => e instanceof HttpError && e.statusCode === 400);
  }
  assert.equal(validateTitle('x'.repeat(120)).length, 120);
});

test('validateId accepts positive integers only', () => {
  assert.equal(validateId('7'), 7);
  for (const bad of ['0', '-1', 'abc', '1.5', '1e3', '9999999999', '1;DROP TABLE']) {
    assert.throws(() => validateId(bad), { statusCode: 400 });
  }
});

test('validatePatch enforces types and requires a field', () => {
  assert.deepEqual(validatePatch({ completed: true }), { completed: true });
  assert.deepEqual(validatePatch({ title: ' a ' }), { title: 'a' });
  assert.throws(() => validatePatch({}), { statusCode: 400 });
  assert.throws(() => validatePatch({ completed: 'yes' }), { statusCode: 400 });
  assert.throws(() => validatePatch([]), { statusCode: 400 });
  assert.throws(() => validatePatch(null), { statusCode: 400 });
});

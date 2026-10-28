'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createMemoryStore } = require('../../src/store/memory-store');

test('memory store supports full CRUD lifecycle', async () => {
  const store = createMemoryStore(false);
  assert.equal(await store.ping(), true);
  const created = await store.create('Write tests');
  assert.equal(created.id, 1);
  assert.equal(created.completed, false);
  assert.deepEqual((await store.get(1)).title, 'Write tests');
  assert.equal((await store.update(1, { completed: true })).completed, true);
  assert.equal(await store.update(99, { completed: true }), null);
  assert.equal(await store.remove(1), true);
  assert.equal(await store.remove(1), false);
  assert.deepEqual(await store.list(), []);
});

test('memory store returns copies so callers cannot mutate internal state', async () => {
  const store = createMemoryStore(true);
  const [first] = await store.list();
  first.title = 'mutated';
  assert.notEqual((await store.get(first.id)).title, 'mutated');
});

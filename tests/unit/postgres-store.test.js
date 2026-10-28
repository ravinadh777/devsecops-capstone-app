'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createPostgresStore } = require('../../src/store/postgres-store');

// Regression test: a database restart used to crash the app (unhandled pool 'error').
test('postgres store survives idle-client errors from the pool', () => {
  let pool;
  const Pool = function () { pool = Object.assign(new EventEmitter(), { query() {}, end() {} }); return pool; };
  createPostgresStore({ Pool });
  const original = console.error;
  console.error = () => {};
  try {
    assert.doesNotThrow(() => pool.emit('error', Object.assign(new Error('terminating connection'), { code: '57P01' })));
  } finally {
    console.error = original;
  }
});

test('postgres store maps rows and uses parameterised queries', async () => {
  const calls = [];
  const Pool = function () {
    return Object.assign(new EventEmitter(), {
      async query(sql, params) {
        calls.push({ sql, params });
        return { rows: [{ id: '3', title: 't', completed: false, created_at: '2026-01-01T00:00:00Z' }], rowCount: 1 };
      },
      async end() {}
    });
  };
  const store = createPostgresStore({ Pool });
  const task = await store.get(3);
  assert.deepEqual(task, { id: 3, title: 't', completed: false, createdAt: '2026-01-01T00:00:00.000Z' });
  await store.create("x'); DROP TABLE tasks;--");
  const insert = calls.find((c) => c.sql.startsWith('INSERT'));
  assert.deepEqual(insert.params, ["x'); DROP TABLE tasks;--"]);
  assert.doesNotMatch(insert.sql, /DROP/);
});

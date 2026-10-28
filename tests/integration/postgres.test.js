'use strict';

/**
 * Runs only when TEST_PG=1 and PGHOST/PGUSER/PGPASSWORD/PGDATABASE point to a
 * disposable database. CI runs it against a postgres service container.
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const enabled = process.env.TEST_PG === '1';

let store;
let srv;
before(async () => {
  if (!enabled) return;
  const { createPostgresStore } = require('../../src/store/postgres-store');
  const { startTestServer } = require('../helpers');
  store = createPostgresStore();
  await store.init();
  srv = await startTestServer({ store });
});
after(async () => {
  if (srv) await srv.close();
  if (store) await store.close();
});

test('postgres store persists tasks through the API', { skip: !enabled && 'set TEST_PG=1 to run' }, async () => {
  const ready = await (await fetch(`${srv.baseUrl}/ready`)).json();
  assert.deepEqual(ready, { status: 'ready', store: 'postgres' });
  const created = await (await fetch(`${srv.baseUrl}/api/tasks`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: "Robert'); DROP TABLE tasks;--" })
  })).json();
  assert.equal(created.title, "Robert'); DROP TABLE tasks;--"); // parameterised query: stored literally
  const updated = await store.update(created.id, { completed: true });
  assert.equal(updated.completed, true);
  assert.equal(updated.title, created.title);
  const list = await store.list();
  assert.ok(list.some((t) => t.id === created.id));
  assert.equal(await store.remove(created.id), true);
  assert.equal(await store.get(created.id), null);
});

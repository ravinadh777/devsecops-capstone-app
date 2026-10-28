'use strict';

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, json } = require('../helpers');

let srv;
before(async () => { srv = await startTestServer(); });
after(async () => { await srv.close(); });
const get = (p, o) => fetch(`${srv.baseUrl}${p}`, o);

describe('health, readiness and version', () => {
  test('GET /health returns ok', async () => {
    const r = await get('/health');
    assert.equal(r.status, 200);
    assert.equal((await r.json()).status, 'ok');
  });

  test('GET /ready returns ready with the store kind', async () => {
    const r = await get('/ready');
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { status: 'ready', store: 'memory' });
  });

  test('GET /ready returns 503 while draining (graceful shutdown)', async () => {
    srv.app.state.draining = true;
    const r = await get('/ready');
    srv.app.state.draining = false;
    assert.equal(r.status, 503);
  });

  test('GET /version exposes git SHA for release traceability', async () => {
    const body = await (await get('/version')).json();
    assert.equal(body.gitSha, 'test123');
    assert.equal(body.version, '9.9.9');
    assert.equal(body.pod, 'test-pod');
  });
});

describe('task API', () => {
  test('lists seeded tasks', async () => {
    const body = await (await get('/api/tasks')).json();
    assert.ok(Array.isArray(body.items));
    assert.ok(body.items.length >= 2);
  });

  test('creates, reads, updates and deletes a task', async () => {
    const created = await get('/api/tasks', json({ title: 'Capstone test task' }));
    assert.equal(created.status, 201);
    const task = await created.json();
    assert.equal(task.title, 'Capstone test task');
    assert.equal(created.headers.get('location'), `/api/tasks/${task.id}`);

    assert.equal((await (await get(`/api/tasks/${task.id}`)).json()).id, task.id);

    const patched = await get(`/api/tasks/${task.id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ completed: true })
    });
    assert.equal(patched.status, 200);
    assert.equal((await patched.json()).completed, true);

    assert.equal((await get(`/api/tasks/${task.id}`, { method: 'DELETE' })).status, 204);
    assert.equal((await get(`/api/tasks/${task.id}`)).status, 404);
  });

  test('rejects missing, blank and over-long titles with 400', async () => {
    for (const body of [{}, { title: '   ' }, { title: 'x'.repeat(121) }, { title: 5 }]) {
      const r = await get('/api/tasks', json(body));
      assert.equal(r.status, 400, JSON.stringify(body));
      assert.ok((await r.json()).error);
    }
  });

  test('rejects malformed JSON with 400', async () => {
    const r = await get('/api/tasks', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{bad' });
    assert.equal(r.status, 400);
  });

  test('rejects wrong content type with 415', async () => {
    const r = await get('/api/tasks', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'title=x' });
    assert.equal(r.status, 415);
  });

  test('rejects oversized bodies with 413', async () => {
    const r = await get('/api/tasks', json({ title: 'a', pad: 'x'.repeat(20_000) }));
    assert.equal(r.status, 413);
  });

  test('rejects invalid ids and unknown methods', async () => {
    assert.equal((await get('/api/tasks/abc')).status, 400);
    assert.equal((await get('/api/tasks/999999')).status, 404);
    assert.equal((await get('/api/tasks', { method: 'PUT' })).status, 405);
    assert.equal((await get('/api/tasks/1', { method: 'POST' })).status, 405);
  });

  test('stores script payloads as plain text (no server-side execution or HTML)', async () => {
    const payload = '<script>alert(1)</script>';
    const r = await get('/api/tasks', json({ title: payload }));
    assert.equal(r.status, 201);
    assert.match(r.headers.get('content-type'), /application\/json/);
    assert.equal((await r.json()).title, payload);
  });
});

describe('security, metrics and load endpoint', () => {
  test('every response carries security headers', async () => {
    for (const p of ['/health', '/api/tasks', '/', '/does-not-exist']) {
      const r = await get(p);
      assert.equal(r.headers.get('x-content-type-options'), 'nosniff', p);
      assert.equal(r.headers.get('x-frame-options'), 'DENY', p);
      assert.match(r.headers.get('content-security-policy'), /default-src 'self'/, p);
    }
  });

  test('unknown routes return JSON 404 without stack traces', async () => {
    const r = await get('/../../etc/passwd');
    assert.equal(r.status, 404);
    const body = await r.text();
    assert.doesNotMatch(body, /at .*\.js/);
  });

  test('serves the frontend shell and assets', async () => {
    const r = await get('/');
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type'), /text\/html/);
    assert.match(await r.text(), /Student Task Manager/);
    assert.equal((await get('/app.js')).status, 200);
    assert.equal((await get('/styles.css')).status, 200);
  });

  test('/metrics exposes request counters used by KEDA', async () => {
    await get('/api/tasks');
    const text = await (await get('/metrics')).text();
    assert.match(text, /http_requests_total\{method="GET",route="\/api\/tasks",status="200"\} \d+/);
    assert.match(text, /app_build_info\{version="9.9.9",git_sha="test123"\} 1/);
  });

  test('/load is bounded to 250 ms and tolerates bad input', async () => {
    assert.equal((await (await get('/load?ms=100000')).json()).workMs, 250);
    assert.equal((await (await get('/load?ms=-5')).json()).workMs, 0);
    assert.equal((await (await get('/load?ms=abc')).json()).workMs, 50);
  });
});

describe('dependency failure handling', () => {
  test('/ready returns 503 and API returns generic 500 when the store fails', async () => {
    const broken = {
      kind: 'postgres',
      ping: async () => { const e = new Error('connect ECONNREFUSED'); e.code = 'ECONNREFUSED'; throw e; },
      list: async () => { throw new Error('relation "tasks" does not exist'); }
    };
    const s = await startTestServer({ store: broken });
    const origError = console.error;
    console.error = () => {};
    try {
      const ready = await fetch(`${s.baseUrl}/ready`);
      assert.equal(ready.status, 503);
      assert.equal((await ready.json()).reason, 'ECONNREFUSED');
      const r = await fetch(`${s.baseUrl}/api/tasks`);
      assert.equal(r.status, 500);
      assert.deepEqual(await r.json(), { error: 'internal server error' }); // SQL detail not leaked
    } finally {
      console.error = origError;
      await s.close();
    }
  });
});

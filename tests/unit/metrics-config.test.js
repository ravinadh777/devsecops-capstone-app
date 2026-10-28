'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createMetrics } = require('../../src/metrics');
const { loadConfig } = require('../../src/config');
const { routeLabel } = require('../../src/app');

test('metrics render Prometheus text format with counters and histogram', () => {
  const m = createMetrics({ appVersion: '1.2.3', gitSha: 'abc1234' });
  m.observeRequest({ method: 'GET', route: '/api/tasks', status: 200, seconds: 0.003 });
  m.observeRequest({ method: 'GET', route: '/api/tasks', status: 200, seconds: 0.2 });
  m.incTasksCreated();
  const out = m.render();
  assert.match(out, /http_requests_total\{method="GET",route="\/api\/tasks",status="200"\} 2/);
  assert.match(out, /http_request_duration_seconds_bucket\{route="\/api\/tasks",le="0.005"\} 1/);
  assert.match(out, /http_request_duration_seconds_bucket\{route="\/api\/tasks",le="\+Inf"\} 2/);
  assert.match(out, /tasks_created_total 1/);
  assert.match(out, /app_build_info\{version="1.2.3",git_sha="abc1234"\} 1/);
});

test('route labels stay low-cardinality (no raw ids or attacker paths)', () => {
  assert.equal(routeLabel('/api/tasks/123'), '/api/tasks/:id');
  assert.equal(routeLabel('/../../etc/passwd'), 'unmatched');
  assert.equal(routeLabel('/'), 'static');
});

test('config validates PORT and STORE', () => {
  assert.equal(loadConfig({}).port, 3000);
  assert.equal(loadConfig({ STORE: 'POSTGRES' }).store, 'postgres');
  assert.throws(() => loadConfig({ PORT: 'abc' }));
  assert.throws(() => loadConfig({ PORT: '70000' }));
  assert.throws(() => loadConfig({ STORE: 'mongo' }));
});

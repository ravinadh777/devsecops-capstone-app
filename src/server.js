'use strict';

const http = require('node:http');
const { loadConfig } = require('./config');
const { createStore } = require('./store');
const { createMetrics } = require('./metrics');
const { createApp } = require('./app');

function log(level, msg, extra = {}) {
  console.log(JSON.stringify({ time: new Date().toISOString(), level, msg, ...extra }));
}

async function start(env = process.env) {
  const config = loadConfig(env);
  const store = createStore(config);
  await store.init();
  const metrics = createMetrics(config);
  const app = createApp({ config, store, metrics });
  const server = http.createServer(app.handler);
  server.headersTimeout = 10_000;
  server.requestTimeout = 15_000;
  server.keepAliveTimeout = 5_000;

  await new Promise((resolve) => server.listen(config.port, '0.0.0.0', resolve));
  log('info', 'student-task-manager listening', {
    port: server.address().port, store: store.kind, version: config.appVersion, gitSha: config.gitSha
  });

  let stopping = false;
  async function shutdown(signal) {
    if (stopping) return;
    stopping = true;
    log('info', 'shutdown requested', { signal });
    app.state.draining = true; // readiness now fails so Kubernetes stops routing traffic
    const timer = setTimeout(() => process.exit(1), config.shutdownTimeoutMs);
    timer.unref();
    server.close(async () => {
      await store.close().catch(() => {});
      log('info', 'shutdown complete');
      process.exit(0);
    });
    server.closeIdleConnections();
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  return { server, store, config };
}

if (require.main === module) {
  start().catch((error) => {
    log('fatal', 'failed to start', { error: error.message });
    process.exit(1);
  });
}

module.exports = { start };

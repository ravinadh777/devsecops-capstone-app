'use strict';

const http = require('node:http');
const { createApp } = require('../src/app');
const { createMetrics } = require('../src/metrics');
const { createMemoryStore } = require('../src/store/memory-store');
const { loadConfig } = require('../src/config');

/** Start the app in-process on a random free port. */
async function startTestServer({ store = createMemoryStore(), env = {} } = {}) {
  const config = loadConfig({ GIT_SHA: 'test123', APP_VERSION: '9.9.9', POD_NAME: 'test-pod', ...env });
  const metrics = createMetrics(config);
  const app = createApp({ config, store, metrics });
  const server = http.createServer(app.handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  return {
    baseUrl,
    app,
    close: () => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); })
  };
}

const json = (body) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body)
});

module.exports = { startTestServer, json };

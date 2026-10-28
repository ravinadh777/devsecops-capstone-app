'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { send, sendJson, sendNoContent, readJson } = require('./http-utils');
const { HttpError, validateTitle, validateId, validatePatch } = require('./validation');

// Explicit allow-list of static files: no filesystem path is ever built from user input.
const STATIC_FILES = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
  '/favicon.svg': ['favicon.svg', 'image/svg+xml']
};

function loadStatic(dir) {
  const cache = new Map();
  for (const [route, [file, type]] of Object.entries(STATIC_FILES)) {
    const full = path.join(dir, file);
    if (fs.existsSync(full)) cache.set(route, { body: fs.readFileSync(full), type });
  }
  return cache;
}

const TASK_ID_ROUTE = /^\/api\/tasks\/([^/]+)$/;

/** Map a raw path to a low-cardinality route label for metrics. */
function routeLabel(pathname) {
  if (STATIC_FILES[pathname]) return 'static';
  if (TASK_ID_ROUTE.test(pathname)) return '/api/tasks/:id';
  if (['/health', '/ready', '/metrics', '/version', '/load', '/api/tasks'].includes(pathname)) return pathname;
  return 'unmatched';
}

function createApp({ config, store, metrics, publicDir = path.join(__dirname, '..', 'public') }) {
  const staticFiles = loadStatic(publicDir);
  const state = { draining: false };

  async function route(req, res, url) {
    const { pathname } = url;
    const method = req.method;

    if (method === 'GET' && pathname === '/health') {
      return sendJson(res, 200, { status: 'ok', uptimeSeconds: Math.floor(process.uptime()) });
    }

    if (method === 'GET' && pathname === '/ready') {
      if (state.draining) return sendJson(res, 503, { status: 'draining' });
      try {
        await store.ping();
        return sendJson(res, 200, { status: 'ready', store: store.kind });
      } catch (error) {
        return sendJson(res, 503, { status: 'not-ready', store: store.kind, reason: error.code || 'store unavailable' });
      }
    }

    if (method === 'GET' && pathname === '/metrics') {
      return send(res, 200, metrics.render(), 'text/plain; version=0.0.4; charset=utf-8');
    }

    if (method === 'GET' && pathname === '/version') {
      return sendJson(res, 200, {
        version: config.appVersion, gitSha: config.gitSha, pod: config.podName, store: store.kind
      });
    }

    if (pathname === '/api/tasks') {
      if (method === 'GET') return sendJson(res, 200, { items: await store.list() });
      if (method === 'POST') {
        const body = await readJson(req, config.maxBodyBytes);
        const title = validateTitle(body && body.title);
        const task = await store.create(title);
        metrics.incTasksCreated();
        return sendJson(res, 201, task, { location: `/api/tasks/${task.id}` });
      }
      throw new HttpError(405, 'method not allowed');
    }

    const match = TASK_ID_ROUTE.exec(pathname);
    if (match) {
      const id = validateId(match[1]);
      if (method === 'GET') {
        const task = await store.get(id);
        if (!task) throw new HttpError(404, 'task not found');
        return sendJson(res, 200, task);
      }
      if (method === 'PATCH') {
        const patch = validatePatch(await readJson(req, config.maxBodyBytes));
        const task = await store.update(id, patch);
        if (!task) throw new HttpError(404, 'task not found');
        return sendJson(res, 200, task);
      }
      if (method === 'DELETE') {
        if (!(await store.remove(id))) throw new HttpError(404, 'task not found');
        return sendNoContent(res);
      }
      throw new HttpError(405, 'method not allowed');
    }

    if (method === 'GET' && pathname === '/load') {
      // Bounded CPU work so students can generate load safely (max 250 ms per call).
      const requested = Number(url.searchParams.get('ms') ?? 50);
      const ms = Number.isFinite(requested) ? Math.max(0, Math.min(requested, config.maxLoadMs)) : 50;
      const end = Date.now() + ms;
      while (Date.now() < end) { /* intentional busy loop for the scaling demo */ }
      return sendJson(res, 200, { status: 'completed', workMs: ms, pod: config.podName });
    }

    if ((method === 'GET' || method === 'HEAD') && staticFiles.has(pathname)) {
      const file = staticFiles.get(pathname);
      return send(res, 200, file.body, file.type, { 'cache-control': 'public, max-age=300' });
    }

    throw new HttpError(404, 'not found');
  }

  async function handler(req, res) {
    const started = process.hrtime.bigint();
    let url;
    try {
      url = new URL(req.url, 'http://localhost');
    } catch {
      url = new URL('http://localhost/');
    }
    res.on('finish', () => {
      const seconds = Number(process.hrtime.bigint() - started) / 1e9;
      metrics.observeRequest({ method: req.method, route: routeLabel(url.pathname), status: res.statusCode, seconds });
    });
    try {
      await route(req, res, url);
    } catch (error) {
      if (res.headersSent) return res.destroy();
      if (error instanceof HttpError) return sendJson(res, error.statusCode, { error: error.message });
      // Never leak internals (stack traces, SQL errors) to the client.
      console.error(JSON.stringify({ level: 'error', msg: 'unhandled error', error: error.message }));
      return sendJson(res, 500, { error: 'internal server error' });
    }
  }

  return { handler, state };
}

module.exports = { createApp, routeLabel };

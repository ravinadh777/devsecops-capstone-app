'use strict';

/**
 * Centralised runtime configuration. Every value comes from environment
 * variables so the same image runs unchanged in local, CI and Kubernetes.
 */
function loadConfig(env = process.env) {
  const port = Number(env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT must be an integer between 1 and 65535, got "${env.PORT}"`);
  }
  const store = (env.STORE || 'memory').toLowerCase();
  if (!['memory', 'postgres'].includes(store)) {
    throw new Error(`STORE must be "memory" or "postgres", got "${env.STORE}"`);
  }
  return Object.freeze({
    port,
    store,
    appVersion: env.APP_VERSION || '1.0.0',
    gitSha: env.GIT_SHA || 'local',
    podName: env.POD_NAME || env.HOSTNAME || 'local',
    maxBodyBytes: 16 * 1024,
    maxLoadMs: 250,
    shutdownTimeoutMs: Number(env.SHUTDOWN_TIMEOUT_MS || 10_000)
  });
}

module.exports = { loadConfig };

'use strict';

const { createMemoryStore } = require('./memory-store');

function createStore(config) {
  if (config.store === 'postgres') {
    // Required lazily so the in-memory mode has no database dependency at runtime.
    const { createPostgresStore } = require('./postgres-store');
    return createPostgresStore();
  }
  return createMemoryStore();
}

module.exports = { createStore };

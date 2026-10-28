'use strict';

/** In-memory task store. Data is per-pod and lost on restart (by design for Lab 1-3). */
function createMemoryStore(seed = true) {
  const tasks = new Map();
  let nextId = 1;
  const add = (title, completed = false) => {
    const task = { id: nextId++, title, completed, createdAt: new Date().toISOString() };
    tasks.set(task.id, task);
    return { ...task };
  };
  if (seed) {
    add('Explore GitHub Actions');
    add('Deploy with Helm');
  }
  return {
    kind: 'memory',
    async init() {},
    async ping() { return true; },
    async list() { return [...tasks.values()].map((t) => ({ ...t })); },
    async get(id) { const t = tasks.get(id); return t ? { ...t } : null; },
    async create(title) { return add(title); },
    async update(id, patch) {
      const t = tasks.get(id);
      if (!t) return null;
      Object.assign(t, patch);
      return { ...t };
    },
    async remove(id) { return tasks.delete(id); },
    async close() {}
  };
}

module.exports = { createMemoryStore };

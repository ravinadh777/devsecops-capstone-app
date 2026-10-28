'use strict';

/**
 * PostgreSQL task store (Lab 4+). Connection settings come from the standard
 * libpq variables PGHOST, PGPORT, PGUSER, PGPASSWORD and PGDATABASE, which the
 * Helm chart injects from a Kubernetes Secret. All queries are parameterised.
 */
function createPostgresStore({ Pool } = require('pg')) {
  const pool = new Pool({ max: 5, connectionTimeoutMillis: 2000, idleTimeoutMillis: 30_000 });
  // Without this listener an idle-client error (e.g. the database restarts) is an
  // unhandled 'error' event and crashes the whole process. Log it instead:
  // /ready reports 503 until the database is back and the pool reconnects.
  pool.on('error', (error) => {
    console.error(JSON.stringify({ level: 'warn', msg: 'postgres idle client error', code: error.code }));
  });
  const toTask = (row) => ({
    id: Number(row.id),
    title: row.title,
    completed: row.completed,
    createdAt: new Date(row.created_at).toISOString()
  });
  return {
    kind: 'postgres',
    async init() {
      await pool.query(`CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        title VARCHAR(120) NOT NULL,
        completed BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
    },
    async ping() {
      await pool.query('SELECT 1');
      return true;
    },
    async list() {
      const { rows } = await pool.query('SELECT * FROM tasks ORDER BY id');
      return rows.map(toTask);
    },
    async get(id) {
      const { rows } = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);
      return rows[0] ? toTask(rows[0]) : null;
    },
    async create(title) {
      const { rows } = await pool.query('INSERT INTO tasks (title) VALUES ($1) RETURNING *', [title]);
      return toTask(rows[0]);
    },
    async update(id, patch) {
      const { rows } = await pool.query(
        `UPDATE tasks SET title = COALESCE($2, title), completed = COALESCE($3, completed)
         WHERE id = $1 RETURNING *`,
        [id, patch.title ?? null, patch.completed ?? null]
      );
      return rows[0] ? toTask(rows[0]) : null;
    },
    async remove(id) {
      const { rowCount } = await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
      return rowCount > 0;
    },
    async close() { await pool.end(); }
  };
}

module.exports = { createPostgresStore };

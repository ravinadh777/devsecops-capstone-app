'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

const entry = path.join(__dirname, '..', '..', 'src', 'server.js');

function startProcess(env) {
  const child = spawn(process.execPath, [entry], { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', (d) => { output += d; });
  child.stderr.on('data', (d) => { output += d; });
  return { child, output: () => output };
}

async function waitFor(url) {
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(url)).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`timed out waiting for ${url}`);
}

test('server starts, logs JSON and exits 0 on SIGTERM (graceful shutdown)', async () => {
  const port = 3600 + Math.floor(Math.random() * 300);
  const p = startProcess({ PORT: String(port) });
  await waitFor(`http://127.0.0.1:${port}/health`);
  const exit = new Promise((resolve) => p.child.on('exit', resolve));
  p.child.kill('SIGTERM');
  assert.equal(await exit, 0);
  const firstLine = JSON.parse(p.output().split('\n')[0]);
  assert.equal(firstLine.msg, 'student-task-manager listening');
});

test('server refuses to start with invalid configuration', async () => {
  const p = startProcess({ PORT: 'not-a-port' });
  const code = await new Promise((resolve) => p.child.on('exit', resolve));
  assert.equal(code, 1);
  assert.match(p.output(), /PORT must be an integer/);
});

'use strict';

const list = document.getElementById('task-list');
const empty = document.getElementById('empty');
const count = document.getElementById('task-count');
const form = document.getElementById('task-form');
const input = document.getElementById('task-title');
const message = document.getElementById('form-message');
let lastSha = null;

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) }
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed with ${response.status}`);
  return data;
}

function render(items) {
  list.replaceChildren();
  for (const task of items) {
    const li = document.createElement('li');
    if (task.completed) li.classList.add('done');

    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = task.completed;
    box.setAttribute('aria-label', `Mark "${task.title}" as done`);
    box.addEventListener('change', () => toggle(task.id, box.checked));

    const title = document.createElement('span');
    title.className = 'title';
    title.textContent = task.title; // textContent, never innerHTML: no XSS

    const remove = document.createElement('button');
    remove.className = 'ghost';
    remove.type = 'button';
    remove.textContent = 'Delete';
    remove.addEventListener('click', () => removeTask(task.id));

    li.append(box, title, remove);
    list.append(li);
  }
  empty.hidden = items.length > 0;
  count.textContent = items.length ? `(${items.length})` : '';
}

async function refresh() {
  try {
    const { items } = await api('/api/tasks');
    render(items);
  } catch (error) {
    message.textContent = `Could not load tasks: ${error.message}`;
  }
}

async function toggle(id, completed) {
  try { await api(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify({ completed }) }); }
  catch (error) { message.textContent = error.message; }
  refresh();
}

async function removeTask(id) {
  try { await api(`/api/tasks/${id}`, { method: 'DELETE' }); }
  catch (error) { message.textContent = error.message; }
  refresh();
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  message.textContent = '';
  const title = input.value.trim();
  if (!title) { message.textContent = 'Type a task title first.'; input.focus(); return; }
  try {
    await api('/api/tasks', { method: 'POST', body: JSON.stringify({ title }) });
    input.value = '';
    refresh();
  } catch (error) {
    message.textContent = error.message;
  }
});

async function loadRelease() {
  const stamp = document.querySelector('.stamp');
  try {
    const v = await api('/version');
    const sha = String(v.gitSha).slice(0, 7);
    document.getElementById('release-sha').textContent = sha;
    document.getElementById('release-meta').textContent = `v${v.version} on ${v.pod}`;
    if (lastSha && lastSha !== sha) {
      stamp.classList.remove('changed'); void stamp.offsetWidth; stamp.classList.add('changed');
    }
    lastSha = sha;
  } catch {
    document.getElementById('release-meta').textContent = 'version unavailable';
  }
}

refresh();
loadRelease();
setInterval(loadRelease, 10000);

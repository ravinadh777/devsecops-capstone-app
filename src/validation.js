'use strict';

const MAX_TITLE_LENGTH = 120;

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
  }
}

function validateTitle(title) {
  if (typeof title !== 'string') {
    throw new HttpError(400, 'title is required and must be a string');
  }
  const clean = title.trim();
  if (!clean) throw new HttpError(400, 'title is required');
  if (clean.length > MAX_TITLE_LENGTH) {
    throw new HttpError(400, `title must be ${MAX_TITLE_LENGTH} characters or fewer`);
  }
  return clean;
}

function validateId(raw) {
  if (!/^\d{1,9}$/.test(String(raw))) throw new HttpError(400, 'id must be a positive integer');
  const id = Number(raw);
  if (id < 1) throw new HttpError(400, 'id must be a positive integer');
  return id;
}

function validatePatch(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'body must be a JSON object');
  }
  const patch = {};
  if ('title' in body) patch.title = validateTitle(body.title);
  if ('completed' in body) {
    if (typeof body.completed !== 'boolean') throw new HttpError(400, 'completed must be a boolean');
    patch.completed = body.completed;
  }
  if (Object.keys(patch).length === 0) {
    throw new HttpError(400, 'provide at least one of: title, completed');
  }
  return patch;
}

module.exports = { HttpError, validateTitle, validateId, validatePatch, MAX_TITLE_LENGTH };

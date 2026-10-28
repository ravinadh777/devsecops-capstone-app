'use strict';

const { HttpError } = require('./validation');

// Security headers applied to every response. These also satisfy the
// most common OWASP ZAP baseline passive-scan rules.
const SECURITY_HEADERS = Object.freeze({
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin',
  'content-security-policy':
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; " +
    "connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
});

function send(res, statusCode, body, contentType, extraHeaders = {}) {
  res.writeHead(statusCode, {
    ...SECURITY_HEADERS,
    'content-type': contentType,
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    ...extraHeaders
  });
  res.end(body);
}

function sendJson(res, statusCode, payload, extraHeaders) {
  send(res, statusCode, JSON.stringify(payload), 'application/json; charset=utf-8', extraHeaders);
}

function sendNoContent(res) {
  res.writeHead(204, { ...SECURITY_HEADERS, 'cache-control': 'no-store' });
  res.end();
}

function readJson(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const type = String(req.headers['content-type'] || '');
    if (!type.toLowerCase().startsWith('application/json')) {
      reject(new HttpError(415, 'content-type must be application/json'));
      req.resume();
      return;
    }
    const chunks = [];
    let size = 0;
    let failed = false;
    req.on('data', (chunk) => {
      if (failed) return;
      size += chunk.length;
      if (size > maxBytes) {
        failed = true;
        reject(new HttpError(413, 'request body too large'));
        req.resume();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (failed) return;
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new HttpError(400, 'invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

module.exports = { SECURITY_HEADERS, send, sendJson, sendNoContent, readJson };

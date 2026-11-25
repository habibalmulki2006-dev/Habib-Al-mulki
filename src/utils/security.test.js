import test from 'node:test';
import assert from 'node:assert/strict';
import {
  containsHtmlMarkup,
  containsSqlInjectionPattern,
  hasUnsafeObjectKeys,
  isValidEmail,
  isValidEntityId,
  sanitizeHexColor,
  sanitizeImageSrc,
  sanitizePlainText,
} from './security.js';

test('hasUnsafeObjectKeys detects prototype pollution and NoSQL operators', () => {
  const protoPayload = JSON.parse('{"__proto__":{"isAdmin":true}}');
  assert.equal(hasUnsafeObjectKeys(protoPayload), true);
  assert.equal(hasUnsafeObjectKeys({ filter: { $gt: '' } }), true);
  assert.equal(hasUnsafeObjectKeys({ nested: [{ constructor: {} }] }), true);
  assert.equal(hasUnsafeObjectKeys({ username: 'user', role: 'user' }), false);
});

test('containsSqlInjectionPattern catches SQLi signatures without blocking normal text', () => {
  assert.equal(containsSqlInjectionPattern("' OR '1'='1"), true);
  assert.equal(containsSqlInjectionPattern("admin'; DROP TABLE users;--"), true);
  assert.equal(containsSqlInjectionPattern('1 UNION SELECT password FROM users'), true);
  assert.equal(containsSqlInjectionPattern('Sapi Aceh Jantan — Bintang Seulawah'), false);
  assert.equal(containsSqlInjectionPattern('Apakah bisa nego harga dan antar ke Banda Aceh?'), false);
});

test('sanitizeImageSrc permits only safe raster base64 data URLs or local assets', () => {
  assert.equal(
    sanitizeImageSrc('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ'),
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ'
  );
  assert.equal(sanitizeImageSrc('data:image/svg+xml,<svg onload=alert(1)>'), null);
  assert.equal(sanitizeImageSrc('javascript:alert(1)'), null);
  assert.equal(sanitizeImageSrc('https://evil.example.com/steal.png'), null);
  assert.equal(sanitizeImageSrc('x" onerror="alert(1)'), null);
  assert.equal(sanitizeImageSrc('/assets/sample.png'), '/assets/sample.png');
  assert.equal(sanitizeImageSrc('/assets/../secret.txt'), null);
});

test('ID, hex color, email, and text sanitizers block malformed payloads', () => {
  assert.equal(isValidEntityId('TRN-01'), true);
  assert.equal(isValidEntityId('../etc/passwd'), false);
  assert.equal(sanitizeHexColor('#9A3412'), '#9A3412');
  assert.equal(sanitizeHexColor('red" onclick="alert(1)'), '#9A3412');
  assert.equal(isValidEmail('user@ternakaceh.id'), true);
  assert.equal(isValidEmail('<script>@x.com'), false);
  assert.equal(containsHtmlMarkup('<img src=x onerror=alert(1)>'), true);
  assert.equal(sanitizePlainText('  Halo\u0000 Dunia  ', 20), 'Halo Dunia');
});

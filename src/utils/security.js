/**
 * Security validation and sanitization utilities shared across server and client.
 */

const DANGEROUS_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const SQL_INJECTION_PATTERNS = [
  /\bunion\s+(all\s+)?select\b/i,
  /\b(drop|alter|truncate)\s+(table|database|schema)\b/i,
  /\b(insert\s+into|delete\s+from|update\s+\w+\s+set)\b/i,
  /\b(exec|execute)\s*\(/i,
  /\bxp_cmdshell\b/i,
  /\bwaitfor\s+delay\b/i,
  /\b(benchmark|sleep)\s*\(\s*\d+/i,
  /['"`]\s*(or|and)\s+(['"`]?\w+['"`]?\s*=\s*['"`]?\w+['"`]?|1\s*=\s*1|true)\b/i,
  /(;|')\s*--\s*$/i,
];

const SAFE_RASTER_DATA_URL_RE =
  /^data:image\/(?:png|jpeg|jpg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

const SAFE_LOCAL_ASSET_RE = /^\/assets\/[a-zA-Z0-9_./-]+$/;

const ENTITY_ID_RE = /^[a-zA-Z0-9_-]{2,128}$/;

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"']+@[^\s@<>()[\]\\,;:"']+\.[^\s@<>()[\]\\,;:"']{2,}$/;

export function hasUnsafeObjectKeys(value, depth = 0) {
  if (depth > 12 || value === null || typeof value !== 'object') {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some((item) => hasUnsafeObjectKeys(item, depth + 1));
  }

  const keys = Object.getOwnPropertyNames(value);
  for (const key of keys) {
    if (DANGEROUS_OBJECT_KEYS.has(key) || key.startsWith('$')) {
      return true;
    }
    if (hasUnsafeObjectKeys(value[key], depth + 1)) {
      return true;
    }
  }
  return false;
}

export function containsSqlInjectionPattern(input) {
  if (typeof input !== 'string') return false;
  const trimmed = input.trim();
  if (!trimmed) return false;
  return SQL_INJECTION_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function isValidEntityId(id) {
  return typeof id === 'string' && ENTITY_ID_RE.test(id);
}

export function isValidEmail(email) {
  return typeof email === 'string' && email.length <= 160 && EMAIL_RE.test(email.trim());
}

export function sanitizeImageSrc(src) {
  if (typeof src !== 'string') return null;
  const trimmed = src.trim();
  if (!trimmed || trimmed.length > 4_500_000) return null;

  if (SAFE_RASTER_DATA_URL_RE.test(trimmed)) {
    return trimmed;
  }
  if (SAFE_LOCAL_ASSET_RE.test(trimmed) && !trimmed.includes('..')) {
    return trimmed;
  }
  return null;
}

export function sanitizeHexColor(hex, fallback = '#9A3412') {
  if (typeof hex !== 'string') return fallback;
  const trimmed = hex.trim();
  return HEX_COLOR_RE.test(trimmed) ? trimmed : fallback;
}

export function sanitizePlainText(input, maxLen = 500) {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLen);
}

export function containsHtmlMarkup(input) {
  if (typeof input !== 'string') return false;
  return /[<>]/.test(input);
}

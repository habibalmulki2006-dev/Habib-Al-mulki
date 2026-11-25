import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };
import { PHOTO_ANGLE_CONFIG, createInitialSeedState } from './src/data/seed.js';
import {
  calculateCheckoutBreakdown,
  evaluateNegotiationOffer,
  evaluateWeightShrinkage,
  validateLivestockSubmission,
} from './src/utils/domain.js';
import { ROLES, VALID_ROLES, validateAuthCredentials } from './src/utils/rbac.js';
import {
  containsHtmlMarkup,
  containsSqlInjectionPattern,
  hasUnsafeObjectKeys,
  isValidEmail,
  isValidEntityId,
  sanitizeImageSrc,
  sanitizePlainText,
} from './src/utils/security.js';

type UserRole = 'user' | 'operator' | 'admin';

interface StoredUser {
  id: string;
  username: string;
  displayName: string;
  email: string;
  role: UserRole;
  provider: 'password' | 'google';
  passwordHash: string | null;
  tokenVersion?: number;
  createdAt: string;
}

interface DatabaseSchema {
  users: StoredUser[];
  livestockData: any[];
  userOrders: any[];
  adminVerifications: any[];
  chatHistory: Record<string, any[]>;
  negotiatedPrices: Record<string, Record<string, number>>;
  escrowReleasedTotal: number;
}

interface SessionPayload {
  uid: string;
  role: UserRole;
  jti?: string;
  ver?: number;
  exp: number;
}

interface AuthedRequest extends Request {
  authUser?: StoredUser;
}

const PORT = Number.parseInt(process.env.PORT || '3000', 10);
const SESSION_COOKIE_NAME = 'ta_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24;
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const DB_DIR = process.env.TERNAKACEH_DB_DIR
  ? path.resolve(process.env.TERNAKACEH_DB_DIR)
  : path.resolve(process.cwd(), '.data');
const DB_FILE = path.join(DB_DIR, 'ternakaceh-db.json');
const BOOTSTRAP_ADMIN_EMAIL = 'habibalmulki2006@gmail.com';
const GOOGLE_JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

let cachedJwks: { keys: any[]; expiresAt: number } = { keys: [], expiresAt: 0 };

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string | null): boolean {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(derived, storedBuf);
}

function signSessionToken(payload: SessionPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifySessionToken(token: string): SessionPayload | null {
  if (!token || !token.includes('.')) return null;
  const [encoded, sig] = token.split('.');
  if (!encoded || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');

  const sigBuf = Buffer.from(sig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (!parsed || !parsed.uid || !parsed.exp || parsed.exp < Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function sanitizeUser(user: StoredUser) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    role: user.role,
    provider: user.provider,
    createdAt: user.createdAt,
  };
}

function createSeededUsers(): StoredUser[] {
  const now = new Date().toISOString();
  const userPass = process.env.SEED_USER_PASSWORD || 'UserAceh#2026';
  const opPass = process.env.SEED_OPERATOR_PASSWORD || 'OperatorAceh#2026';
  const adminPass = process.env.SEED_ADMIN_PASSWORD || 'AdminAceh#2026';

  return [
    {
      id: 'usr-dummy-user',
      username: 'user',
      displayName: 'Ahmad Fauzi (Pembeli)',
      email: 'user@ternakaceh.local',
      role: 'user',
      provider: 'password',
      passwordHash: hashPassword(userPass),
      createdAt: now,
    },
    {
      id: 'usr-dummy-operator',
      username: 'operator',
      displayName: 'Tgk. Sulaiman (Operator Kandang)',
      email: 'operator@ternakaceh.local',
      role: 'operator',
      provider: 'password',
      passwordHash: hashPassword(opPass),
      createdAt: now,
    },
    {
      id: 'usr-dummy-admin',
      username: 'admin',
      displayName: 'Pengelola TernakAceh (Admin)',
      email: 'admin@ternakaceh.local',
      role: 'admin',
      provider: 'password',
      passwordHash: hashPassword(adminPass),
      createdAt: now,
    },
  ];
}

function createInitialDatabase(): DatabaseSchema {
  const seed = createInitialSeedState();
  const taggedOrders = seed.userOrders.map((order: any) => ({
    ...order,
    buyerId: 'usr-dummy-user',
  }));
  const taggedLivestock = seed.livestockData.map((item: any) => ({
    ...item,
    ownerId: 'usr-dummy-operator',
  }));

  return {
    users: createSeededUsers(),
    livestockData: taggedLivestock,
    userOrders: taggedOrders,
    adminVerifications: seed.adminVerifications,
    chatHistory: seed.chatHistory || {},
    negotiatedPrices: {},
    escrowReleasedTotal: seed.escrowReleasedTotal,
  };
}

function loadDatabase(): DatabaseSchema {
  fs.mkdirSync(DB_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    const initial = createInitialDatabase();
    saveDatabase(initial);
    return initial;
  }

  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw) as DatabaseSchema;
    if (!parsed || !Array.isArray(parsed.users) || !Array.isArray(parsed.livestockData)) {
      const initial = createInitialDatabase();
      saveDatabase(initial);
      return initial;
    }
    if (parsed.users.length === 0) {
      parsed.users = createSeededUsers();
      saveDatabase(parsed);
    } else {
      const expectedSeeds = [
        { id: 'usr-dummy-user', pass: process.env.SEED_USER_PASSWORD || 'UserAceh#2026' },
        { id: 'usr-dummy-operator', pass: process.env.SEED_OPERATOR_PASSWORD || 'OperatorAceh#2026' },
        { id: 'usr-dummy-admin', pass: process.env.SEED_ADMIN_PASSWORD || 'AdminAceh#2026' },
      ];
      let changed = false;
      for (const seed of expectedSeeds) {
        const existingUser = parsed.users.find((u) => u.id === seed.id);
        if (existingUser && !verifyPassword(seed.pass, existingUser.passwordHash)) {
          existingUser.passwordHash = hashPassword(seed.pass);
          changed = true;
        }
      }
      if (changed) {
        saveDatabase(parsed);
      }
    }
    return parsed;
  } catch {
    const initial = createInitialDatabase();
    saveDatabase(initial);
    return initial;
  }
}

function saveDatabase(data: DatabaseSchema) {
  fs.mkdirSync(DB_DIR, { recursive: true });
  const tmpPath = `${DB_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpPath, DB_FILE);
}

let db: DatabaseSchema = loadDatabase();

function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie;
  if (!header) return {};
  const result: Record<string, string> = {};
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx <= 0) return;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    result[key] = decodeURIComponent(val);
  });
  return result;
}

const revokedTokens = new Map<string, number>();
const authAttempts = new Map<string, { count: number; resetAt: number }>();

function pruneSecurityMaps() {
  const now = Date.now();
  for (const [jti, exp] of revokedTokens.entries()) {
    if (exp <= now) revokedTokens.delete(jti);
  }
  for (const [key, entry] of authAttempts.entries()) {
    if (entry.resetAt <= now) authAttempts.delete(key);
  }
}

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || 'unknown';
}

function createAuthRateLimiter(maxAttempts = 15, windowMs = 5 * 60 * 1000) {
  return (req: Request, res: Response, next: NextFunction) => {
    pruneSecurityMaps();
    const key = `${getClientIp(req)}:${req.path}`;
    const now = Date.now();
    const entry = authAttempts.get(key);

    if (entry && entry.resetAt > now && entry.count >= maxAttempts) {
      const waitMinutes = Math.max(1, Math.ceil((entry.resetAt - now) / 60000));
      res.status(429).json({
        error: `Terlalu banyak percobaan autentikasi. Silakan coba kembali dalam ${waitMinutes} menit.`,
      });
      return;
    }

    if (!entry || entry.resetAt <= now) {
      authAttempts.set(key, { count: 1, resetAt: now + windowMs });
    } else {
      entry.count += 1;
    }
    next();
  };
}

function clearAuthRateLimit(req: Request) {
  const key = `${getClientIp(req)}:${req.path}`;
  authAttempts.delete(key);
}

function issueUserToken(user: StoredUser): string {
  return signSessionToken({
    uid: user.id,
    role: user.role,
    jti: crypto.randomUUID(),
    ver: user.tokenVersion ?? 0,
    exp: Date.now() + SESSION_TTL_MS,
  });
}

function extractBearerOrCookieToken(req: Request): string {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookies = parseCookies(req);
  return cookies[SESSION_COOKIE_NAME] || '';
}

function extractSessionUser(req: Request): StoredUser | null {
  const token = extractBearerOrCookieToken(req);
  const payload = verifySessionToken(token);
  if (!payload) return null;
  if (payload.jti && revokedTokens.has(payload.jti)) return null;

  const user = db.users.find((u) => u.id === payload.uid);
  if (!user) return null;
  if (typeof payload.ver === 'number' && (user.tokenVersion ?? 0) !== payload.ver) {
    return null;
  }
  return user;
}

function setSessionCookie(req: Request, res: Response, token: string) {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ];
  if (isHttps) {
    parts.push('SameSite=None', 'Secure', 'Partitioned');
  } else {
    parts.push('SameSite=Lax');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(req: Request, res: Response) {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const parts = [`${SESSION_COOKIE_NAME}=`, 'Path=/', 'HttpOnly', 'Max-Age=0'];
  if (isHttps) {
    parts.push('SameSite=None', 'Secure', 'Partitioned');
  } else {
    parts.push('SameSite=Lax');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

async function fetchGoogleJwks(): Promise<any[]> {
  if (cachedJwks.keys.length > 0 && cachedJwks.expiresAt > Date.now()) {
    return cachedJwks.keys;
  }
  const resp = await fetch(GOOGLE_JWKS_URL);
  if (!resp.ok) {
    throw new Error('Gagal mengambil kunci publik verifikasi Google.');
  }
  const body = (await resp.json()) as { keys?: any[] };
  cachedJwks = {
    keys: Array.isArray(body.keys) ? body.keys : [],
    expiresAt: Date.now() + 1000 * 60 * 60,
  };
  return cachedJwks.keys;
}

async function verifyFirebaseGoogleIdToken(idToken: string) {
  const segments = idToken.split('.');
  if (segments.length !== 3) {
    throw new Error('Format token Firebase tidak valid.');
  }
  const [headerB64, payloadB64, sigB64] = segments;
  const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
  const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));

  if (header.alg !== 'RS256' || !header.kid) {
    throw new Error('Algoritma atau KID token tidak valid.');
  }

  const keys = await fetchGoogleJwks();
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) {
    throw new Error('Kunci publik token tidak ditemukan.');
  }

  const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  const verified = crypto.verify(
    'RSA-SHA256',
    Buffer.from(`${headerB64}.${payloadB64}`, 'utf8'),
    publicKey,
    Buffer.from(sigB64, 'base64url')
  );

  if (!verified) {
    throw new Error('Tanda tangan token Google tidak valid.');
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const expectedIssuer = `https://securetoken.google.com/${firebaseConfig.projectId}`;
  if (
    payload.aud !== firebaseConfig.projectId ||
    payload.iss !== expectedIssuer ||
    typeof payload.sub !== 'string' ||
    !payload.sub ||
    typeof payload.exp !== 'number' ||
    payload.exp <= nowSec
  ) {
    throw new Error('Klaim token Firebase tidak sesuai atau sudah kedaluwarsa.');
  }

  if (payload.email_verified !== true || typeof payload.email !== 'string') {
    throw new Error('Akun Google harus memiliki email terverifikasi.');
  }

  return {
    uid: payload.sub as string,
    email: payload.email.toLowerCase(),
    name: typeof payload.name === 'string' && payload.name.trim() ? payload.name.trim() : payload.email.split('@')[0],
  };
}

function securityHeadersMiddleware(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://apis.google.com https://*.firebaseapp.com https://*.googleapis.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https://*.googleusercontent.com",
    "connect-src 'self' ws: wss: https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com https://securetoken.googleapis.com https://identitytoolkit.googleapis.com https://firestore.googleapis.com",
    "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self' https://aistudio.google.com https://*.google.com",
  ].join('; ');
  res.setHeader('Content-Security-Policy', csp);
  next();
}

function rejectUnsafePayloads(req: Request, res: Response, next: NextFunction) {
  if (
    hasUnsafeObjectKeys(req.body) ||
    hasUnsafeObjectKeys(req.query) ||
    hasUnsafeObjectKeys(req.params)
  ) {
    res.status(400).json({ error: 'Payload permintaan mengandung struktur kunci yang tidak diizinkan.' });
    return;
  }
  next();
}

function requireCsrfHeader(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    next();
    return;
  }

  const origin = req.headers.origin;
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host;
  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost !== host) {
        res.status(403).json({ error: 'Asal permintaan (Origin) tidak cocok dengan host aplikasi.' });
        return;
      }
    } catch {
      res.status(403).json({ error: 'Header Origin permintaan tidak valid.' });
      return;
    }
  }

  const customHeader = req.headers['x-requested-with'];
  if (customHeader !== 'TernakAceh') {
    res.status(403).json({ error: 'Header keamanan permintaan tidak valid.' });
    return;
  }
  next();
}

function requireAuth(allowedRoles?: UserRole[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    const user = extractSessionUser(req);
    if (!user) {
      res.status(401).json({ error: 'Silakan masuk terlebih dahulu.' });
      return;
    }
    if (allowedRoles && !allowedRoles.includes(user.role)) {
      res.status(403).json({ error: 'Peran akun Anda tidak memiliki izin untuk aksi ini.' });
      return;
    }
    req.authUser = user;
    next();
  };
}

function buildWorkspaceForUser(user: StoredUser | null) {
  const userNegos = user ? db.negotiatedPrices[user.id] || {} : {};
  if (!user) {
    return {
      user: null,
      livestockData: db.livestockData,
      userOrders: [],
      adminVerifications: [],
      chatHistory: {},
      negotiatedPrices: {},
      escrowReleasedTotal: db.escrowReleasedTotal,
      users: [],
    };
  }

  const visibleOrders =
    user.role === ROLES.ADMIN || user.role === ROLES.OPERATOR
      ? db.userOrders
      : db.userOrders.filter((o) => o.buyerId === user.id);

  const visibleVerifications =
    user.role === ROLES.ADMIN || user.role === ROLES.OPERATOR ? db.adminVerifications : [];

  const visibleUsers = user.role === ROLES.ADMIN ? db.users.map(sanitizeUser) : [];

  return {
    user: sanitizeUser(user),
    livestockData: db.livestockData,
    userOrders: visibleOrders,
    adminVerifications: visibleVerifications,
    chatHistory: db.chatHistory,
    negotiatedPrices: userNegos,
    escrowReleasedTotal: db.escrowReleasedTotal,
    users: visibleUsers,
  };
}

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(securityHeadersMiddleware);
  app.use(express.json({ limit: '15mb' }));
  app.use(rejectUnsafePayloads);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'ternakaceh-api' });
  });

  app.use('/api', requireCsrfHeader);
  const authLimiter = createAuthRateLimiter(15, 5 * 60 * 1000);

  app.get('/api/auth/me', (req, res) => {
    const user = extractSessionUser(req);
    res.json({ user: user ? sanitizeUser(user) : null });
  });

  app.post('/api/auth/login', authLimiter, (req, res) => {
    const { username, password } = req.body || {};
    const validation = validateAuthCredentials({ username, password });
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const cleanUsername = String(username).trim().toLowerCase();
    const user = db.users.find((u) => u.username.toLowerCase() === cleanUsername && u.provider === 'password');
    if (!user || !verifyPassword(String(password), user.passwordHash)) {
      res.status(401).json({ error: 'Username atau password tidak sesuai.' });
      return;
    }

    clearAuthRateLimit(req);
    const token = issueUserToken(user);
    setSessionCookie(req, res, token);
    res.json({ token, user: sanitizeUser(user) });
  });

  app.post('/api/auth/register', authLimiter, (req, res) => {
    const { username, password, displayName, email } = req.body || {};
    const validation = validateAuthCredentials({
      username,
      password,
      displayName,
      isRegister: true,
    });
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const cleanName = sanitizePlainText(displayName, 80);
    if (containsSqlInjectionPattern(cleanName) || containsHtmlMarkup(cleanName)) {
      res.status(400).json({ error: 'Nama lengkap mengandung pola karakter yang tidak diizinkan.' });
      return;
    }

    const cleanUsername = String(username).trim().toLowerCase();
    if (db.users.some((u) => u.username.toLowerCase() === cleanUsername)) {
      res.status(409).json({ error: 'Username sudah terdaftar. Gunakan username lain.' });
      return;
    }

    if (typeof email === 'string' && email.trim() && !isValidEmail(email)) {
      res.status(400).json({ error: 'Format email tidak valid.' });
      return;
    }

    const cleanEmail =
      typeof email === 'string' && isValidEmail(email)
        ? email.trim().toLowerCase()
        : `${cleanUsername}@ternakaceh.local`;

    const newUser: StoredUser = {
      id: `usr-${crypto.randomUUID().slice(0, 12)}`,
      username: cleanUsername,
      displayName: cleanName,
      email: cleanEmail,
      role: 'user',
      provider: 'password',
      passwordHash: hashPassword(String(password)),
      tokenVersion: 0,
      createdAt: new Date().toISOString(),
    };

    db.users.push(newUser);
    saveDatabase(db);
    clearAuthRateLimit(req);

    const token = issueUserToken(newUser);
    setSessionCookie(req, res, token);
    res.status(201).json({ token, user: sanitizeUser(newUser) });
  });

  app.post('/api/auth/google', authLimiter, async (req, res) => {
    const { idToken } = req.body || {};
    if (typeof idToken !== 'string' || !idToken.trim()) {
      res.status(400).json({ error: 'Token Google tidak tersedia.' });
      return;
    }

    try {
      const verified = await verifyFirebaseGoogleIdToken(idToken.trim());
      let user = db.users.find(
        (u) => u.id === verified.uid || (u.provider === 'google' && u.email === verified.email)
      );

      const isBootstrapAdmin = verified.email === BOOTSTRAP_ADMIN_EMAIL;
      const safeDisplayName = sanitizePlainText(verified.name, 80).replace(/[<>]/g, '') || 'Pengguna Google';
      if (!user) {
        user = {
          id: verified.uid,
          username: verified.email.split('@')[0].replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 32),
          displayName: safeDisplayName,
          email: verified.email,
          role: isBootstrapAdmin ? 'admin' : 'user',
          provider: 'google',
          passwordHash: null,
          tokenVersion: 0,
          createdAt: new Date().toISOString(),
        };
        db.users.push(user);
      } else {
        user.displayName = safeDisplayName;
        if (isBootstrapAdmin) {
          user.role = 'admin';
        }
      }
      saveDatabase(db);
      clearAuthRateLimit(req);

      const token = issueUserToken(user);
      setSessionCookie(req, res, token);
      res.json({ token, user: sanitizeUser(user) });
    } catch (error) {
      res.status(401).json({
        error: error instanceof Error ? error.message : 'Verifikasi login Google gagal.',
      });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    const token = extractBearerOrCookieToken(req);
    const payload = verifySessionToken(token);
    if (payload?.jti) {
      revokedTokens.set(payload.jti, payload.exp);
    }
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });

  app.get('/api/catalog', (_req, res) => {
    const heldEscrow = db.userOrders
      .filter((o) => !o.isEscrowReleased)
      .reduce((sum, o) => sum + Number(o.totalPaid || 0), 0);

    res.json({
      livestockData: db.livestockData,
      escrowReleasedTotal: db.escrowReleasedTotal,
      heldEscrowTotal: heldEscrow,
    });
  });

  app.get('/api/workspace', requireAuth(), (req: AuthedRequest, res) => {
    res.json(buildWorkspaceForUser(req.authUser || null));
  });

  app.post(
    '/api/livestock',
    requireAuth([ROLES.OPERATOR as UserRole, ROLES.ADMIN as UserRole]),
    (req: AuthedRequest, res) => {
      const { formData, photos } = req.body || {};
      const validation = validateLivestockSubmission(formData || {}, photos || {}, PHOTO_ANGLE_CONFIG);
      if (!validation.valid) {
        res.status(400).json({ error: validation.errors[0] });
        return;
      }

      const newItem = {
        id: `TRN-${String(db.livestockData.length + 1).padStart(2, '0')}`,
        nama: String(formData.nama).trim(),
        jenis: String(formData.jenis),
        peruntukan: String(formData.peruntukan),
        lokasi: String(formData.lokasi),
        kecamatan: `Kec. ${String(formData.lokasi)}`,
        bobot: Number(formData.bobot),
        usia: String(formData.usia).trim(),
        kelamin: String(formData.kelamin),
        harga: Number(formData.harga),
        peternak: String(formData.peternak).trim(),
        ownerId: req.authUser!.id,
        kyc: true,
        skkh: String(formData.skkh).trim(),
        status: 'Tersedia',
        patungan: Boolean(formData.patungan),
        slots: formData.patungan
          ? Array.from({ length: 7 }, (_, idx) => ({ no: idx + 1, name: null, paid: false }))
          : [],
        titipRawat: Boolean(formData.titipRawat),
        photos: {
          samping: sanitizeImageSrc(photos.samping),
          depan: sanitizeImageSrc(photos.depan),
          gigi: sanitizeImageSrc(photos.gigi),
          belakang: sanitizeImageSrc(photos.belakang),
        },
        colorHex:
          formData.jenis === 'Kerbau'
            ? '#334155'
            : String(formData.jenis).includes('Sapi')
              ? '#9A3412'
              : '#D97706',
        deskripsi: `${sanitizePlainText(formData.nama, 150)} dalam kondisi prima, pakan alami teratur, dilengkapi 4 sudut foto verifikasi fisik & gigi, serta sertifikat dokter hewan ${sanitizePlainText(formData.skkh, 60)}.`,
      };

      db.livestockData.unshift(newItem);
      saveDatabase(db);
      res.status(201).json({ item: newItem, workspace: buildWorkspaceForUser(req.authUser!) });
    }
  );

  app.patch(
    '/api/livestock/:id/status',
    requireAuth([ROLES.OPERATOR as UserRole, ROLES.ADMIN as UserRole]),
    (req: AuthedRequest, res) => {
      const { id } = req.params;
      if (!isValidEntityId(id)) {
        res.status(400).json({ error: 'ID ternak tidak valid.' });
        return;
      }
      const { status } = req.body || {};
      if (typeof status !== 'string' || !['Tersedia', 'Dipesan (DP)', 'Terjual'].includes(status)) {
        res.status(400).json({ error: 'Status stok tidak valid.' });
        return;
      }

      const item = db.livestockData.find((t) => t.id === id);
      if (!item) {
        res.status(404).json({ error: 'Data ternak tidak ditemukan.' });
        return;
      }

      item.status = status;
      saveDatabase(db);
      res.json({ item, workspace: buildWorkspaceForUser(req.authUser!) });
    }
  );

  app.post('/api/negotiations/offer', requireAuth(), (req: AuthedRequest, res) => {
    const { ternakId, offerPrice } = req.body || {};
    if (!isValidEntityId(ternakId)) {
      res.status(400).json({ error: 'ID ternak tidak valid.' });
      return;
    }
    const item = db.livestockData.find((t) => t.id === ternakId);
    if (!item) {
      res.status(404).json({ error: 'Ternak tidak ditemukan.' });
      return;
    }

    const result = evaluateNegotiationOffer(item.harga, Number(offerPrice));
    if (!result.valid) {
      res.status(400).json({ error: 'Nominal penawaran tidak valid.' });
      return;
    }

    if (!db.chatHistory[item.id]) {
      db.chatHistory[item.id] = [];
    }
    db.chatHistory[item.id].push({
      sender: 'buyer',
      time: 'Baru saja',
      text: `${req.authUser!.displayName} mengajukan penawaran harga sebesar Rp ${Number(offerPrice).toLocaleString('id-ID')} untuk ${item.nama}.`,
    });

    if (result.accepted && typeof result.agreedPrice === 'number') {
      if (!db.negotiatedPrices[req.authUser!.id]) {
        db.negotiatedPrices[req.authUser!.id] = {};
      }
      db.negotiatedPrices[req.authUser!.id][item.id] = result.agreedPrice;
      db.chatHistory[item.id].push({
        sender: 'seller',
        time: 'Otomatis',
        text: `Alhamdulillah, tawaran Rp ${result.agreedPrice.toLocaleString('id-ID')} diterima! Harga deal diterapkan ke checkout Anda.`,
      });
    } else {
      db.chatHistory[item.id].push({
        sender: 'seller',
        time: 'Otomatis',
        text: `Maaf, penawaran belum masuk modal pakan & perawatan. Kami bisa lepas minimal di Rp ${result.minAcceptable.toLocaleString('id-ID')}.`,
      });
    }

    saveDatabase(db);
    res.json({
      result,
      workspace: buildWorkspaceForUser(req.authUser!),
    });
  });

  app.post('/api/negotiations/chat', requireAuth(), (req: AuthedRequest, res) => {
    const { ternakId, text } = req.body || {};
    if (!isValidEntityId(ternakId)) {
      res.status(400).json({ error: 'ID ternak tidak valid.' });
      return;
    }
    const item = db.livestockData.find((t) => t.id === ternakId);
    const cleanText = sanitizePlainText(text, 500);
    if (!item || !cleanText || containsSqlInjectionPattern(cleanText)) {
      res.status(400).json({ error: 'Pesan atau ternak tidak valid.' });
      return;
    }

    if (!db.chatHistory[item.id]) {
      db.chatHistory[item.id] = [];
    }
    db.chatHistory[item.id].push({
      sender: 'buyer',
      time: 'Baru saja',
      text: cleanText,
    });
    db.chatHistory[item.id].push({
      sender: 'seller',
      time: 'Baru saja',
      text: 'Baik Pak/Bu, ternak siap dipantau langsung atau dikirim sesuai jadwal akad dengan dokumen SKKH asli.',
    });

    saveDatabase(db);
    res.json({ workspace: buildWorkspaceForUser(req.authUser!) });
  });

  app.post('/api/orders', requireAuth(), (req: AuthedRequest, res) => {
    const {
      ternakId,
      scheme,
      selectedPatunganSlots,
      titipRawat,
      titipDays,
      shippingMethod,
      shippingDest,
      addonJagal,
      addonKatering,
    } = req.body || {};

    if (!isValidEntityId(ternakId)) {
      res.status(400).json({ error: 'ID ternak tidak valid.' });
      return;
    }

    const item = db.livestockData.find((t) => t.id === ternakId);
    if (!item || item.status === 'Terjual') {
      res.status(400).json({ error: 'Ternak tidak tersedia untuk dipesan.' });
      return;
    }

    if (!['full', 'dp', 'patungan'].includes(scheme || 'full')) {
      res.status(400).json({ error: 'Skema transaksi tidak valid.' });
      return;
    }

    const userNegos = db.negotiatedPrices[req.authUser!.id] || {};
    const basePrice = userNegos[item.id] || item.harga;
    const slotList: number[] = Array.isArray(selectedPatunganSlots) ? selectedPatunganSlots : [];

    if (scheme === 'patungan' && item.patungan) {
      if (slotList.length === 0) {
        res.status(400).json({ error: 'Pilih minimal 1 slot patungan yang masih tersedia.' });
        return;
      }
      const alreadyTaken = slotList.some((no) => {
        const found = item.slots.find((s: any) => s.no === no);
        return !found || found.paid;
      });
      if (alreadyTaken) {
        res.status(409).json({ error: 'Sebagian slot patungan sudah terisi.' });
        return;
      }
    }

    const breakdown = calculateCheckoutBreakdown({
      basePrice,
      weightKg: item.bobot,
      originLokasi: item.lokasi,
      scheme: scheme || 'full',
      selectedSlotCount: slotList.length,
      titipRawat: Boolean(titipRawat),
      titipDays: Number(titipDays) || 30,
      shippingMethod: shippingMethod || 'farmer',
      shippingDest: shippingDest || 'Banda Aceh',
      addonJagal: Boolean(addonJagal),
      addonKatering: Boolean(addonKatering),
    });

    if (scheme === 'patungan' && item.patungan) {
      slotList.forEach((slotNo) => {
        const slotObj = item.slots.find((s: any) => s.no === slotNo);
        if (slotObj) {
          slotObj.paid = true;
          slotObj.name = req.authUser!.displayName;
        }
      });
      if (item.slots.every((s: any) => s.paid)) {
        item.status = 'Terjual';
      }
    } else if (scheme === 'dp') {
      item.status = 'Dipesan (DP)';
    } else {
      item.status = 'Terjual';
    }

    const schemeDesc =
      scheme === 'patungan'
        ? `Patungan Kurban (${slotList.length}/7 Slot)`
        : scheme === 'dp'
          ? 'Booking DP 30%'
          : 'Bayar Penuh (1 Ekor)';

    const newOrder = {
      orderId: `ORD-2026-${Math.floor(100 + Math.random() * 899)}`,
      buyerId: req.authUser!.id,
      ternakId: item.id,
      nama: item.nama,
      peternak: item.peternak,
      scheme: titipRawat ? `${schemeDesc} + Titip Rawat ${Number(titipDays) || 30} Hari` : schemeDesc,
      totalPaid: breakdown.grandTotal,
      escrowStatus: titipRawat ? 'Dititip Rawat di Kandang Virtual' : 'Dana Aman di Escrow',
      isEscrowReleased: false,
      hasTitipRawat: Boolean(titipRawat),
      initialWeight: item.bobot,
      currentWeight: item.bobot,
      logs: titipRawat
        ? [
            {
              date: 'Hari Ini',
              weight: item.bobot,
              note: 'Akad titip rawat dimulai. Hewan masuk blok karantina sehat & penimbangan awal.',
              feed: 'Hijauan Segar + Mineral Blok',
            },
          ]
        : [],
    };

    db.userOrders.unshift(newOrder);
    saveDatabase(db);
    res.status(201).json({ order: newOrder, workspace: buildWorkspaceForUser(req.authUser!) });
  });

  app.post('/api/orders/:orderId/logs', requireAuth(), (req: AuthedRequest, res) => {
    if (!isValidEntityId(req.params.orderId)) {
      res.status(400).json({ error: 'ID pesanan tidak valid.' });
      return;
    }
    const order = db.userOrders.find((o) => o.orderId === req.params.orderId);
    if (!order) {
      res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
      return;
    }

    const isPrivileged = req.authUser!.role === ROLES.ADMIN || req.authUser!.role === ROLES.OPERATOR;
    if (!isPrivileged && order.buyerId !== req.authUser!.id) {
      res.status(403).json({ error: 'Anda tidak berhak memperbarui log pesanan ini.' });
      return;
    }

    const addedKg = order.initialWeight > 100 ? 5 : 2;
    order.currentWeight += addedKg;
    order.logs.push({
      date: 'Pembaruan Hari Ini',
      weight: order.currentWeight,
      note: `Penimbangan mingguan terverifikasi. Kenaikan bobot +${addedKg} kg, nafsu makan lahap & bebas gejala penyakit.`,
      feed: 'Rumput Odot Fermentasi + Konsentrat',
    });

    saveDatabase(db);
    res.json({ order, addedKg, workspace: buildWorkspaceForUser(req.authUser!) });
  });

  app.post('/api/orders/:orderId/handover', requireAuth(), (req: AuthedRequest, res) => {
    if (!isValidEntityId(req.params.orderId)) {
      res.status(400).json({ error: 'ID pesanan tidak valid.' });
      return;
    }
    const order = db.userOrders.find((o) => o.orderId === req.params.orderId);
    if (!order) {
      res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
      return;
    }

    if (order.buyerId !== req.authUser!.id && req.authUser!.role !== ROLES.ADMIN) {
      res.status(403).json({ error: 'Anda tidak berhak mengonfirmasi pesanan ini.' });
      return;
    }

    if (order.isEscrowReleased) {
      res.status(409).json({ error: 'Dana escrow pesanan ini sudah dicairkan.' });
      return;
    }

    const { action, actualWeight, checkHealth, checkSkkh } = req.body || {};
    if (action === 'dispute') {
      const evaluation = evaluateWeightShrinkage(order.currentWeight, Number(actualWeight));
      if (!evaluation.valid || evaluation.withinTolerance) {
        res.status(400).json({ error: 'Penyusutan masih dalam batas toleransi <= 5%.' });
        return;
      }
      order.escrowStatus = 'Mediasi Sengketa Bobot (Ditahan Admin)';
      saveDatabase(db);
      res.json({ order, workspace: buildWorkspaceForUser(req.authUser!) });
      return;
    }

    if (!checkHealth || !checkSkkh) {
      res.status(400).json({ error: 'Pastikan kondisi fisik sehat dan dokumen SKKH sesuai.' });
      return;
    }

    order.isEscrowReleased = true;
    order.escrowStatus = 'Selesai · Dana Cair ke Peternak';
    db.escrowReleasedTotal += order.totalPaid;
    saveDatabase(db);
    res.json({ order, workspace: buildWorkspaceForUser(req.authUser!) });
  });

  app.post(
    '/api/verifications/:verId/approve',
    requireAuth([ROLES.ADMIN as UserRole]),
    (req: AuthedRequest, res) => {
      if (!isValidEntityId(req.params.verId)) {
        res.status(400).json({ error: 'ID verifikasi tidak valid.' });
        return;
      }
      const ver = db.adminVerifications.find((v) => v.id === req.params.verId);
      if (!ver) {
        res.status(404).json({ error: 'Pengajuan verifikasi tidak ditemukan.' });
        return;
      }

      if (ver.status === 'Terverifikasi KYC & SKKH') {
        res.status(409).json({ error: 'Pengajuan ini sudah terverifikasi.' });
        return;
      }

      ver.status = 'Terverifikasi KYC & SKKH';
      db.livestockData.unshift({
        id: `TRN-${String(db.livestockData.length + 1).padStart(2, '0')}`,
        nama: `${ver.ternak} — Mitra Terverifikasi`,
        jenis: ver.ternak.includes('Kerbau') ? 'Kerbau' : 'Sapi Aceh',
        peruntukan: 'Kurban',
        lokasi: ver.lokasi,
        kecamatan: `Pusat ${ver.lokasi}`,
        bobot: ver.ternak.includes('440') ? 440 : 305,
        usia: '2.5 Tahun (Poel 1)',
        kelamin: 'Jantan',
        harga: ver.ternak.includes('440') ? 29800000 : 20400000,
        peternak: ver.kandang,
        ownerId: 'usr-dummy-operator',
        kyc: true,
        skkh: ver.skkhNo,
        status: 'Tersedia',
        patungan: true,
        slots: Array.from({ length: 7 }, (_, i) => ({ no: i + 1, name: null, paid: false })),
        titipRawat: true,
        photos: null,
        colorHex: ver.ternak.includes('Kerbau') ? '#334155' : '#9A3412',
        deskripsi: `Ternak lolos audit verifikasi kandang KYC dan validasi sertifikat ${ver.skkhNo} oleh tim TernakAceh.`,
      });

      saveDatabase(db);
      res.json({ ver, workspace: buildWorkspaceForUser(req.authUser!) });
    }
  );

  app.post(
    '/api/admin/users',
    requireAuth([ROLES.ADMIN as UserRole]),
    (req: AuthedRequest, res) => {
      const { displayName, username, email, password, role } = req.body || {};
      const validation = validateAuthCredentials({
        username,
        password,
        displayName,
        isRegister: true,
      });
      if (!validation.valid) {
        res.status(400).json({ error: validation.error });
        return;
      }

      if (typeof role !== 'string' || !VALID_ROLES.includes(role)) {
        res.status(400).json({ error: 'Peran pengguna tidak valid.' });
        return;
      }

      const cleanName = sanitizePlainText(displayName, 80);
      if (containsSqlInjectionPattern(cleanName) || containsHtmlMarkup(cleanName)) {
        res.status(400).json({ error: 'Nama lengkap mengandung karakter yang tidak diizinkan.' });
        return;
      }

      const cleanUsername = String(username).trim().toLowerCase();
      if (db.users.some((u) => u.username.toLowerCase() === cleanUsername)) {
        res.status(409).json({ error: 'Username sudah terdaftar di database.' });
        return;
      }

      if (typeof email === 'string' && email.trim() && !isValidEmail(email)) {
        res.status(400).json({ error: 'Format email tidak valid.' });
        return;
      }

      const cleanEmail =
        typeof email === 'string' && isValidEmail(email)
          ? email.trim().toLowerCase()
          : `${cleanUsername}@ternakaceh.local`;

      const createdUser: StoredUser = {
        id: `usr-${crypto.randomUUID().slice(0, 12)}`,
        username: cleanUsername,
        displayName: cleanName,
        email: cleanEmail,
        role: role as UserRole,
        provider: 'password',
        passwordHash: hashPassword(String(password)),
        tokenVersion: 0,
        createdAt: new Date().toISOString(),
      };

      db.users.push(createdUser);
      saveDatabase(db);
      res.status(201).json({
        user: sanitizeUser(createdUser),
        workspace: buildWorkspaceForUser(req.authUser!),
      });
    }
  );

  app.patch(
    '/api/users/:userId/role',
    requireAuth([ROLES.ADMIN as UserRole]),
    (req: AuthedRequest, res) => {
      const { userId } = req.params;
      if (!isValidEntityId(userId)) {
        res.status(400).json({ error: 'ID pengguna tidak valid.' });
        return;
      }

      const { role } = req.body || {};
      if (typeof role !== 'string' || !VALID_ROLES.includes(role)) {
        res.status(400).json({ error: 'Peran pengguna tidak valid.' });
        return;
      }

      const target = db.users.find((u) => u.id === userId);
      if (!target) {
        res.status(404).json({ error: 'Akun pengguna tidak ditemukan.' });
        return;
      }

      if (target.id === req.authUser!.id && role !== ROLES.ADMIN) {
        res.status(400).json({ error: 'Admin aktif tidak dapat menurunkan perannya sendiri.' });
        return;
      }

      target.role = role as UserRole;
      target.tokenVersion = (target.tokenVersion ?? 0) + 1;
      saveDatabase(db);
      res.json({ user: sanitizeUser(target), workspace: buildWorkspaceForUser(req.authUser!) });
    }
  );

  app.delete(
    '/api/admin/users/:userId',
    requireAuth([ROLES.ADMIN as UserRole]),
    (req: AuthedRequest, res) => {
      const { userId } = req.params;
      if (!isValidEntityId(userId)) {
        res.status(400).json({ error: 'ID pengguna tidak valid.' });
        return;
      }

      if (userId === req.authUser!.id) {
        res.status(400).json({ error: 'Anda tidak dapat menghapus akun Admin yang sedang digunakan.' });
        return;
      }

      const target = db.users.find((u) => u.id === userId);
      if (!target) {
        res.status(404).json({ error: 'Akun pengguna tidak ditemukan.' });
        return;
      }

      if (target.role === ROLES.ADMIN) {
        const remainingAdmins = db.users.filter((u) => u.role === ROLES.ADMIN && u.id !== userId);
        if (remainingAdmins.length === 0) {
          res.status(400).json({ error: 'Sistem wajib menyisakan minimal 1 akun Admin aktif.' });
          return;
        }
      }

      db.users = db.users.filter((u) => u.id !== userId);
      delete db.negotiatedPrices[userId];
      saveDatabase(db);
      res.json({
        deletedId: userId,
        workspace: buildWorkspaceForUser(req.authUser!),
      });
    }
  );

  app.post(
    '/api/admin/reset-demo',
    requireAuth([ROLES.ADMIN as UserRole]),
    (req: AuthedRequest, res) => {
      const fresh = createInitialDatabase();
      fresh.users = db.users;
      db = fresh;
      saveDatabase(db);
      res.json({ workspace: buildWorkspaceForUser(req.authUser!) });
    }
  );

  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(err);
      return;
    }
    if (err instanceof SyntaxError && 'body' in (err as any)) {
      res.status(400).json({ error: 'Format JSON permintaan tidak valid.' });
      return;
    }
    res.status(500).json({ error: 'Terjadi kesalahan internal pada server.' });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TernakAceh server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

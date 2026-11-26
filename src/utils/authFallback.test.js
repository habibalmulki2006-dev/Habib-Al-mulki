import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFirebaseSessionUser,
  isStaticHostApiError,
  mapFirebaseAuthError,
} from './authFallback.js';

test('mapFirebaseAuthError surfaces actionable message for unauthorized-domain', () => {
  const msg = mapFirebaseAuthError(
    { code: 'auth/unauthorized-domain' },
    'bib.vercel.app',
    'focused-gantry-991ww'
  );
  assert.match(msg, /bib\.vercel\.app/);
  assert.match(msg, /Authorized domains/);
  assert.match(msg, /focused-gantry-991ww/);
});

test('mapFirebaseAuthError translates popup-blocked and popup-closed-by-user', () => {
  assert.match(mapFirebaseAuthError({ code: 'auth/popup-blocked' }), /diblokir/i);
  assert.match(mapFirebaseAuthError({ code: 'auth/popup-closed-by-user' }), /ditutup/i);
});

test('buildFirebaseSessionUser promotes verified bootstrap admin email to admin', () => {
  const user = buildFirebaseSessionUser({
    uid: 'uid-123',
    email: 'habibalmulki2006@gmail.com',
    emailVerified: true,
    displayName: 'Habib Admin',
  });
  assert.equal(user.role, 'admin');
  assert.equal(user.provider, 'google');
  assert.equal(user.username, 'habibalmulki2006');
});

test('buildFirebaseSessionUser respects Firestore role for regular users without elevating unverified admin email', () => {
  const normalUser = buildFirebaseSessionUser(
    {
      uid: 'uid-456',
      email: 'pembeli@example.com',
      emailVerified: true,
      displayName: 'Pembeli Aceh',
    },
    { role: 'operator', displayName: 'Operator Kandang' }
  );
  assert.equal(normalUser.role, 'operator');
  assert.equal(normalUser.displayName, 'Operator Kandang');

  const unverified = buildFirebaseSessionUser({
    uid: 'uid-789',
    email: 'habibalmulki2006@gmail.com',
    emailVerified: false,
  });
  assert.equal(unverified.role, 'user');
});

test('isStaticHostApiError identifies 404/405 and non-JSON static responses only', () => {
  assert.equal(isStaticHostApiError({ status: 404 }), true);
  assert.equal(isStaticHostApiError({ status: 405 }), true);
  assert.equal(isStaticHostApiError({ status: 200, isApiUnavailable: true }), true);
  assert.equal(isStaticHostApiError({ status: 401 }), false);
  assert.equal(isStaticHostApiError({ status: 429 }), false);
  assert.equal(isStaticHostApiError(null), false);
});

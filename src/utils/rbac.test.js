import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROLES,
  canAccessTab,
  canPerformAction,
  getRoleLabel,
  validateAuthCredentials,
} from './rbac.js';

test('getRoleLabel maps roles cleanly to Indonesian labels', () => {
  assert.equal(getRoleLabel(ROLES.USER), 'User Biasa');
  assert.equal(getRoleLabel(ROLES.OPERATOR), 'Operator');
  assert.equal(getRoleLabel(ROLES.ADMIN), 'Admin');
  assert.equal(getRoleLabel(null), 'Tamu');
});

test('canAccessTab enforces guest, user, operator, and admin boundaries', () => {
  // Guest
  assert.equal(canAccessTab(null, 'katalog'), true);
  assert.equal(canAccessTab(null, 'patungan'), true);
  assert.equal(canAccessTab(null, 'pesanan'), false);
  assert.equal(canAccessTab(null, 'peternak'), false);
  assert.equal(canAccessTab(null, 'admin'), false);

  // User biasa
  assert.equal(canAccessTab(ROLES.USER, 'pesanan'), true);
  assert.equal(canAccessTab(ROLES.USER, 'peternak'), false);
  assert.equal(canAccessTab(ROLES.USER, 'admin'), false);

  // Operator
  assert.equal(canAccessTab(ROLES.OPERATOR, 'pesanan'), true);
  assert.equal(canAccessTab(ROLES.OPERATOR, 'peternak'), true);
  assert.equal(canAccessTab(ROLES.OPERATOR, 'admin'), false);

  // Admin
  assert.equal(canAccessTab(ROLES.ADMIN, 'pesanan'), true);
  assert.equal(canAccessTab(ROLES.ADMIN, 'peternak'), true);
  assert.equal(canAccessTab(ROLES.ADMIN, 'admin'), true);
});

test('canPerformAction prevents privilege escalation across roles', () => {
  assert.equal(canPerformAction(ROLES.USER, 'purchase'), true);
  assert.equal(canPerformAction(ROLES.USER, 'manage_livestock'), false);
  assert.equal(canPerformAction(ROLES.USER, 'approve_verification'), false);

  assert.equal(canPerformAction(ROLES.OPERATOR, 'manage_livestock'), true);
  assert.equal(canPerformAction(ROLES.OPERATOR, 'manage_barn_log'), true);
  assert.equal(canPerformAction(ROLES.OPERATOR, 'approve_verification'), false);
  assert.equal(canPerformAction(ROLES.OPERATOR, 'manage_users'), false);

  assert.equal(canPerformAction(ROLES.ADMIN, 'approve_verification'), true);
  assert.equal(canPerformAction(ROLES.ADMIN, 'manage_users'), true);
  assert.equal(canPerformAction(ROLES.ADMIN, 'reset_db'), true);
});

test('validateAuthCredentials enforces username, password, and registration name constraints', () => {
  assert.equal(
    validateAuthCredentials({ username: 'ab', password: 'secret' }).valid,
    false
  );
  assert.equal(
    validateAuthCredentials({ username: 'valid_user', password: '123' }).valid,
    false
  );
  assert.equal(
    validateAuthCredentials({ username: 'valid_user', password: 'Password123' }).valid,
    true
  );
  assert.equal(
    validateAuthCredentials({
      username: 'newuser',
      password: 'Password123',
      displayName: '',
      isRegister: true,
    }).valid,
    false
  );
  assert.equal(
    validateAuthCredentials({
      username: 'newuser',
      password: 'Password123',
      displayName: 'Cut Putri',
      isRegister: true,
    }).valid,
    true
  );
  assert.equal(
    validateAuthCredentials({
      username: "' OR 1=1--",
      password: 'Password123',
    }).valid,
    false
  );
  assert.equal(
    validateAuthCredentials({
      username: 'weakuser',
      password: 'password',
      displayName: 'Weak User',
      isRegister: true,
    }).valid,
    false
  );
  assert.equal(
    validateAuthCredentials({
      username: 'xssuser',
      password: 'Password123',
      displayName: '<script>alert(1)</script>',
      isRegister: true,
    }).valid,
    false
  );
});

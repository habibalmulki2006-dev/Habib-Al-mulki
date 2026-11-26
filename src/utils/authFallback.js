import { VALID_ROLES } from './rbac.js';

const BOOTSTRAP_ADMIN_EMAIL = 'habibalmulki2006@gmail.com';

export function mapFirebaseAuthError(error, hostname = '', projectId = '') {
  const code = typeof error?.code === 'string' ? error.code : '';
  const rawMessage = error instanceof Error ? error.message : String(error || '');

  if (code === 'auth/unauthorized-domain' || rawMessage.includes('auth/unauthorized-domain')) {
    const hostLabel = hostname ? ` "${hostname}"` : '';
    const projectLabel = projectId ? ` (Project: ${projectId})` : '';
    return `Domain${hostLabel} belum terdaftar di Firebase Authorized Domains. Tambahkan domain ini di Firebase Console -> Authentication -> Settings -> Authorized domains${projectLabel}, lalu coba masuk kembali.`;
  }

  if (code === 'auth/popup-blocked' || rawMessage.includes('auth/popup-blocked')) {
    return 'Popup login Google diblokir oleh browser. Izinkan popup untuk situs ini lalu coba lagi.';
  }

  if (
    code === 'auth/popup-closed-by-user' ||
    code === 'auth/cancelled-popup-request' ||
    rawMessage.includes('auth/popup-closed-by-user')
  ) {
    return 'Jendela login Google ditutup sebelum proses selesai. Silakan coba lagi.';
  }

  if (code === 'auth/operation-not-allowed' || rawMessage.includes('auth/operation-not-allowed')) {
    return 'Login Google belum diaktifkan pada proyek Firebase Authentication.';
  }

  if (code === 'auth/network-request-failed' || rawMessage.includes('auth/network-request-failed')) {
    return 'Gagal terhubung ke layanan Google/Firebase. Periksa koneksi internet Anda lalu coba lagi.';
  }

  if (code === 'auth/web-storage-unsupported') {
    return 'Browser memblokir penyimpanan sesi yang dibutuhkan login Google. Aktifkan cookie/storage lalu muat ulang halaman.';
  }

  return rawMessage || 'Gagal masuk dengan akun Google. Pastikan popup tidak diblokir.';
}

export function buildFirebaseSessionUser(firebaseUser, profileData = null) {
  if (!firebaseUser || typeof firebaseUser.uid !== 'string') {
    return null;
  }

  const email = typeof firebaseUser.email === 'string' ? firebaseUser.email.toLowerCase() : '';
  const isBootstrapAdmin = Boolean(firebaseUser.emailVerified && email === BOOTSTRAP_ADMIN_EMAIL);

  const storedRole = typeof profileData?.role === 'string' && VALID_ROLES.includes(profileData.role)
    ? profileData.role
    : 'user';

  const resolvedRole = isBootstrapAdmin ? 'admin' : storedRole;
  const fallbackName = email ? email.split('@')[0] : 'Pengguna Google';
  const rawName = profileData?.displayName || firebaseUser.displayName || fallbackName;
  const displayName = String(rawName).trim().slice(0, 80) || 'Pengguna Google';
  const usernameBase = (email ? email.split('@')[0] : firebaseUser.uid)
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 32);

  return {
    id: firebaseUser.uid,
    username: usernameBase || 'google_user',
    displayName,
    email,
    role: resolvedRole,
    provider: 'google',
  };
}

export function isStaticHostApiError(error) {
  if (!error || typeof error !== 'object') return false;
  if (error.isApiUnavailable === true) return true;
  return error.status === 404 || error.status === 405;
}

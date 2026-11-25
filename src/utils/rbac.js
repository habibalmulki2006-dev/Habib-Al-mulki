export const ROLES = {
  USER: 'user',
  OPERATOR: 'operator',
  ADMIN: 'admin',
};

export const VALID_ROLES = [ROLES.USER, ROLES.OPERATOR, ROLES.ADMIN];

export function getRoleLabel(role) {
  switch (role) {
    case ROLES.ADMIN:
      return 'Admin';
    case ROLES.OPERATOR:
      return 'Operator';
    case ROLES.USER:
      return 'User Biasa';
    default:
      return 'Tamu';
  }
}

export function canAccessTab(role, tabName) {
  if (tabName === 'katalog' || tabName === 'patungan') {
    return true;
  }
  if (!role) {
    return false;
  }
  if (tabName === 'pesanan') {
    return VALID_ROLES.includes(role);
  }
  if (tabName === 'peternak') {
    return role === ROLES.OPERATOR || role === ROLES.ADMIN;
  }
  if (tabName === 'admin') {
    return role === ROLES.ADMIN;
  }
  return false;
}

export function canPerformAction(role, action) {
  if (!role || !VALID_ROLES.includes(role)) {
    return false;
  }
  switch (action) {
    case 'purchase':
    case 'nego':
    case 'handover':
      return true;
    case 'manage_livestock':
    case 'manage_barn_log':
      return role === ROLES.OPERATOR || role === ROLES.ADMIN;
    case 'approve_verification':
    case 'manage_users':
    case 'reset_db':
      return role === ROLES.ADMIN;
    default:
      return false;
  }
}

export function validateAuthCredentials({
  username,
  password,
  displayName = '',
  isRegister = false,
}) {
  if (typeof username !== 'string' || typeof password !== 'string') {
    return {
      valid: false,
      error: 'Format username atau password tidak valid.',
    };
  }

  const cleanUser = username.trim();
  const cleanPass = password;

  if (!/^[a-zA-Z0-9._-]{3,32}$/.test(cleanUser)) {
    return {
      valid: false,
      error: 'Username harus 3–32 karakter (huruf, angka, titik, garis bawah, atau tanda hubung).',
    };
  }

  if (cleanPass.length < 6 || cleanPass.length > 128) {
    return {
      valid: false,
      error: 'Password harus terdiri dari 6–128 karakter.',
    };
  }

  if (isRegister) {
    if (
      cleanPass.length < 8 ||
      !/[a-z]/.test(cleanPass) ||
      !/[A-Z]/.test(cleanPass) ||
      !/\d/.test(cleanPass)
    ) {
      return {
        valid: false,
        error: 'Password baru minimal 8 karakter dan wajib mengandung huruf besar, huruf kecil, serta angka.',
      };
    }

    if (typeof displayName !== 'string') {
      return {
        valid: false,
        error: 'Nama lengkap harus berupa teks yang valid.',
      };
    }

    const cleanName = displayName.trim();
    if (cleanName.length < 2 || cleanName.length > 80 || /[<>]/.test(cleanName)) {
      return {
        valid: false,
        error: 'Nama lengkap harus 2–80 karakter tanpa simbol < atau >.',
      };
    }
  }

  return { valid: true, error: null };
}

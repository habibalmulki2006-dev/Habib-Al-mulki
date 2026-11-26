let inMemoryToken = null;

export function setAuthToken(token) {
  inMemoryToken = token || null;
}

const API_BASE_URL =
  typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL
    ? String(import.meta.env.VITE_API_BASE_URL).replace(/\/+$/, '')
    : '';

export function getAuthToken() {
  return inMemoryToken;
}

async function apiRequest(url, options = {}) {
  const headers = {
    'X-Requested-With': 'TernakAceh',
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(inMemoryToken ? { Authorization: `Bearer ${inMemoryToken}` } : {}),
    ...(options.headers || {}),
  };

  const targetUrl = API_BASE_URL && url.startsWith('/') ? `${API_BASE_URL}${url}` : url;
  const response = await fetch(targetUrl, {
    ...options,
    headers,
    credentials: 'include',
  });

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const err = new Error('Layanan backend API tidak tersedia pada hosting statis ini.');
    err.status = response.status;
    err.isApiUnavailable = true;
    throw err;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data.error || `Permintaan gagal (${response.status})`);
    err.status = response.status;
    err.isApiUnavailable = response.status === 404 || response.status === 405;
    throw err;
  }
  return data;
}

export async function fetchAuthMe() {
  return apiRequest('/api/auth/me');
}

export async function fetchPublicCatalog() {
  return apiRequest('/api/catalog');
}

export async function fetchWorkspace() {
  return apiRequest('/api/workspace');
}

export async function loginWithPassword(username, password) {
  const res = await apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  setAuthToken(res.token);
  return res;
}

export async function registerAccount({ username, password, displayName, email }) {
  const res = await apiRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password, displayName, email }),
  });
  setAuthToken(res.token);
  return res;
}

export async function loginWithGoogleToken(idToken) {
  const res = await apiRequest('/api/auth/google', {
    method: 'POST',
    body: JSON.stringify({ idToken }),
  });
  setAuthToken(res.token);
  return res;
}

export async function logoutSession() {
  setAuthToken(null);
  return apiRequest('/api/auth/logout', { method: 'POST' });
}

export async function createLivestock(formData, photos) {
  return apiRequest('/api/livestock', {
    method: 'POST',
    body: JSON.stringify({ formData, photos }),
  });
}

export async function updateLivestockStatus(id, status) {
  return apiRequest(`/api/livestock/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function submitNegoOffer(ternakId, offerPrice) {
  return apiRequest('/api/negotiations/offer', {
    method: 'POST',
    body: JSON.stringify({ ternakId, offerPrice }),
  });
}

export async function sendChatMessage(ternakId, text) {
  return apiRequest('/api/negotiations/chat', {
    method: 'POST',
    body: JSON.stringify({ ternakId, text }),
  });
}

export async function createOrder(payload) {
  return apiRequest('/api/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function addBarnLog(orderId) {
  return apiRequest(`/api/orders/${encodeURIComponent(orderId)}/logs`, {
    method: 'POST',
  });
}

export async function submitHandover(orderId, payload) {
  return apiRequest(`/api/orders/${encodeURIComponent(orderId)}/handover`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function approveVerification(verId) {
  return apiRequest(`/api/verifications/${encodeURIComponent(verId)}/approve`, {
    method: 'POST',
  });
}

export async function createAdminUser(payload) {
  return apiRequest('/api/admin/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateUserRole(userId, role) {
  return apiRequest(`/api/users/${encodeURIComponent(userId)}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

export async function deleteAdminUser(userId) {
  return apiRequest(`/api/admin/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });
}

export async function resetDemoDatabase() {
  return apiRequest('/api/admin/reset-demo', {
    method: 'POST',
  });
}

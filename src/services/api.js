let inMemoryToken = null;

export function setAuthToken(token) {
  inMemoryToken = token || null;
}

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

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Permintaan gagal (${response.status})`);
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

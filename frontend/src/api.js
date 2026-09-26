// In local development or inside Docker container, all requests go through relative /api proxy
const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })

  if (!res.ok) {
    let errorMessage = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      if (data && data.error) errorMessage = data.error;
    } catch (e) {
      const text = await res.text();
      if (text) errorMessage = text;
    }
    const error = new Error(errorMessage);
    error.status = res.status;
    throw error;
  }
  if (res.status === 204) return null
  return res.json()
}

// ── Authentication ────────────────────────────────────────────────────────────

export function registerUser(data) {
  return request('/auth/register', { method: 'POST', body: JSON.stringify(data) })
}

export function loginUser(data) {
  return request('/auth/login', { method: 'POST', body: JSON.stringify(data) })
}

export function logoutUser() {
  return request('/auth/logout', { method: 'POST' })
}

export function getMe() {
  return request('/auth/me')
}

export function changePassword(data) {
  return request('/auth/change-password', { method: 'PUT', body: JSON.stringify(data) })
}

// ── Customers ────────────────────────────────────────────────────────────────

export function getCustomers() {
  return request('/customers')
}

export function getCustomer(id) {
  return request(`/customers/${id}`)
}

export function createCustomer(data) {
  return request('/customers', { method: 'POST', body: JSON.stringify(data) })
}

export function updateCustomer(id, data) {
  return request(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export function deleteCustomer(id) {
  return request(`/customers/${id}`, { method: 'DELETE' })
}

// ── Services ─────────────────────────────────────────────────────────────────

export function getServices() {
  return request('/services')
}

export function createService(data) {
  return request('/services', { method: 'POST', body: JSON.stringify(data) })
}

export function updateService(id, data) {
  return request(`/services/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

// ── Transactions ──────────────────────────────────────────────────────────────

export function getTransactions(params = {}) {
  const qs = new URLSearchParams()
  if (params.status && params.status !== 'all') qs.set('status', params.status)
  if (params.customer_id) qs.set('customer_id', params.customer_id)
  const query = qs.toString() ? `?${qs.toString()}` : ''
  return request(`/transactions${query}`)
}

export function createTransaction(data) {
  return request('/transactions', { method: 'POST', body: JSON.stringify(data) })
}

export function updateTransaction(id, data) {
  return request(`/transactions/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export function deleteTransaction(id) {
  return request(`/transactions/${id}`, { method: 'DELETE' })
}

export function markPaid(id, payment_mode) {
  return request(`/transactions/${id}/mark-paid`, {
    method: 'PUT',
    body: JSON.stringify({ payment_mode }),
  })
}

// ── Bulk Import & Charge ──────────────────────────────────────────────────────

export function bulkImport(data) {
  return request('/transactions/bulk-import', { method: 'POST', body: JSON.stringify(data) })
}

export function bulkCharge(data) {
  return request('/bulk-charge', { method: 'POST', body: JSON.stringify(data) })
}

// ── Export & Reports ──────────────────────────────────────────────────────────

export function exportBackup() {
  return request('/export')
}

export function getOverdue() {
  return request('/reports/overdue')
}

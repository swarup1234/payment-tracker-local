// Clean base URL: strip trailing slashes to ensure consistent path joins
const getApiBase = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  return '/api';
};

const API_BASE = getApiBase();

async function request(path, options = {}) {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${API_BASE}${cleanPath}`;
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })

  if (!res.ok) {
    let errorMessage = `HTTP ${res.status}`;
    try {
      const text = await res.text();
      if (text) {
        try {
          const data = JSON.parse(text);
          if (data && data.error) errorMessage = data.error;
          else errorMessage = text;
        } catch (_) {
          errorMessage = text;
        }
      }
    } catch (_) {
      // Ignore text read error fallback
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

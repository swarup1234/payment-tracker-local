// All requests go through /api which Vite proxies to http://localhost:4000
// PREPENDS LIVE BACKEND URL (OR DEFAULTS TO RELATIVE FOR LOCAL DEV)
const API_BASE = import.meta.env.VITE_API_URL || 'https://payment-tracker-backend-cjct.onrender.com';

async function request(path, options = {}) {
  //const url = `/api${path}`
  const url = `${API_BASE}${path}`
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  if (res.status === 204) return null
  return res.json()
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

export function updateService(id, data) {
  return request(`/services/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

// ── Transactions ──────────────────────────────────────────────────────────────

/**
 * @param {{ status?: string, customer_id?: number|string }} params
 */
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

/**
 * @param {number|string} id
 * @param {'cash'|'bank_transfer'|'online'} payment_mode
 */
export function markPaid(id, payment_mode) {
  return request(`/transactions/${id}/mark-paid`, {
    method: 'PUT',
    body: JSON.stringify({ payment_mode }),
  })
}

// ── Bulk Import ───────────────────────────────────────────────────────────────

/**
 * Import transactions from parsed CSV rows.
 * @param {{ rows: { customer_name, service_name, amount, due_date }[] }} data
 */
export function bulkImport(data) {
  return request('/transactions/bulk-import', { method: 'POST', body: JSON.stringify(data) })
}

// ── Bulk Charge ───────────────────────────────────────────────────────────────

/**
 * Create one transaction per customer for the same service/amount/due_date.
 * @param {{ customer_ids: number[], service_id: number, amount: number, due_date: string }} data
 */
export function bulkCharge(data) {
  return request('/bulk-charge', { method: 'POST', body: JSON.stringify(data) })
}

// ── Export / Backup ───────────────────────────────────────────────────────────

/**
 * Returns the full backup payload (customers + services + transactions).
 * Download is handled client-side by converting to CSV or JSON.
 */
export function exportBackup() {
  return request('/export')
}

// ── Reports ───────────────────────────────────────────────────────────────────

export function getOverdue() {
  return request('/reports/overdue')
}

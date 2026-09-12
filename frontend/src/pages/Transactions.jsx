import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { getTransactions, getCustomers, updateTransaction, deleteTransaction, getServices } from '../api.js'
import { formatCurrency, formatDate } from '../utils.js'
import StatusBadge from '../components/StatusBadge.jsx'
import Modal from '../components/Modal.jsx'
import Receipt from '../components/Receipt.jsx'
import PageHeader from '../components/PageHeader.jsx'
import MarkPaidButton from '../components/MarkPaidButton.jsx'
import { LoadingSpinner, ErrorMessage } from '../components/Feedback.jsx'

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'paid', label: 'Paid' },
  { value: 'cancelled', label: 'Cancelled' },
]
const TX_STATUSES = ['pending', 'overdue', 'paid', 'cancelled']
const PAYMENT_MODE_OPTIONS = [
  { value: '', label: 'Any Mode' },
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'online', label: 'Online' },
  { value: '__unpaid__', label: 'Unpaid (no mode)' },
]
const DEFAULT_FILTERS = {
  status: 'all', customers: [], service: '',
  paymentMode: '', amountMin: '', amountMax: '',
  dueDateFrom: '', dueDateTo: '', paidDateFrom: '', paidDateTo: '',
}

// ── CSV export ────────────────────────────────────────────────────────────────
function downloadCSV(rows) {
  const esc = (v) => { if (v == null) return ''; const s = String(v); return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g,'""')}"` : s }
  const lines = [
    ['ID','Customer','Service','Amount (₹)','Due Date','Status','Payment Mode','Paid On'].join(','),
    ...rows.map(r => [r.id, r.customer_name??r.customer_id, r.service_name??r.service_id, r.amount,
      r.due_date?r.due_date.slice(0,10):'', r.status, r.payment_mode??'',
      r.paid_at?new Date(r.paid_at).toISOString().slice(0,10):''].map(esc).join(','))
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url
  a.download = `transactions_${new Date().toISOString().slice(0,10)}.csv`
  a.click(); URL.revokeObjectURL(url)
}

function countActive(f) {
  return Object.entries(f).filter(([k,v]) => k === 'customers' ? v.length > 0 : v !== '' && v !== 'all').length
}

export default function Transactions() {
  const [transactions, setTransactions] = useState([])
  const [customers, setCustomers] = useState([])
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [custDropOpen, setCustDropOpen] = useState(false)

  const [editTx, setEditTx] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState(null)

  const [deleteTx, setDeleteTx] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)

  const [receiptTx, setReceiptTx] = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [txData, svcData, custData] = await Promise.all([getTransactions(), getServices(), getCustomers()])
      setTransactions(txData); setServices(svcData); setCustomers(custData)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  // Derived dropdown values
  const serviceNames = [...new Set(transactions.map(t => t.service_name).filter(Boolean))].sort()

  // ── Client-side filtering ─────────────────────────────────────────────────
  const visible = transactions.filter(t => {
    const f = filters
    if (f.status !== 'all' && t.status !== f.status) return false
    if (f.customers.length > 0 && !f.customers.includes(t.customer_id)) return false
    if (f.service && t.service_name !== f.service) return false
    if (f.paymentMode === '__unpaid__' && t.payment_mode) return false
    if (f.paymentMode && f.paymentMode !== '__unpaid__' && t.payment_mode !== f.paymentMode) return false
    if (f.amountMin !== '' && Number(t.amount) < Number(f.amountMin)) return false
    if (f.amountMax !== '' && Number(t.amount) > Number(f.amountMax)) return false
    if (f.dueDateFrom && (t.due_date||'').slice(0,10) < f.dueDateFrom) return false
    if (f.dueDateTo   && (t.due_date||'').slice(0,10) > f.dueDateTo)   return false
    if (f.paidDateFrom) { const d = t.paid_at ? new Date(t.paid_at).toISOString().slice(0,10) : ''; if (!d || d < f.paidDateFrom) return false }
    if (f.paidDateTo)   { const d = t.paid_at ? new Date(t.paid_at).toISOString().slice(0,10) : ''; if (!d || d > f.paidDateTo)   return false }
    return true
  })

  // ── Totals for visible rows ───────────────────────────────────────────────
  const totals = visible.reduce((acc, t) => {
    acc.total += Number(t.amount)
    if (t.status === 'paid')    acc.paid    += Number(t.amount)
    if (t.status === 'pending') acc.pending += Number(t.amount)
    if (t.status === 'overdue') acc.overdue += Number(t.amount)
    return acc
  }, { total: 0, paid: 0, pending: 0, overdue: 0 })

  function setFilter(key, value) { setFilters(p => ({ ...p, [key]: value })) }

  function toggleCustomer(id) {
    setFilters(p => ({
      ...p,
      customers: p.customers.includes(id)
        ? p.customers.filter(c => c !== id)
        : [...p.customers, id]
    }))
  }

  function clearFilters() { setFilters(DEFAULT_FILTERS) }
  const activeCount = countActive(filters)

  // ── Edit ──────────────────────────────────────────────────────────────────
  function openEdit(row) {
    setEditTx(row)
    setEditForm({ service_id: row.service_id??'', amount: row.amount??'', due_date: row.due_date?row.due_date.slice(0,10):'', status: row.status??'pending' })
    setEditError(null)
  }

  async function handleEdit(e) {
    e.preventDefault()
    if (!editForm.service_id) { setEditError('Select a service.'); return }
    if (!editForm.amount || isNaN(Number(editForm.amount))) { setEditError('Enter a valid amount.'); return }
    if (!editForm.due_date) { setEditError('Due date is required.'); return }
    setEditSaving(true); setEditError(null)
    try {
      await updateTransaction(editTx.id, { service_id: Number(editForm.service_id), amount: Number(editForm.amount), due_date: editForm.due_date, status: editForm.status })
      setEditTx(null); load()
    } catch (err) { setEditError(err.message) }
    finally { setEditSaving(false) }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete() {
    setDeleting(true); setDeleteError(null)
    try { await deleteTransaction(deleteTx.id); setDeleteTx(null); load() }
    catch (err) { setDeleteError(err.message) }
    finally { setDeleting(false) }
  }

  const columns = [
    { key: 'customer_name', header: 'Customer',
      render: r => <Link to={`/customers/${r.customer_id}`} className="font-medium text-accent-600 hover:underline" onClick={e=>e.stopPropagation()}>{r.customer_name??`#${r.customer_id}`}</Link> },
    { key: 'service_name', header: 'Service', render: r => r.service_name||'—' },
    { key: 'amount', header: 'Amount', render: r => formatCurrency(r.amount) },
    { key: 'due_date', header: 'Due Date', render: r => formatDate(r.due_date) },
    { key: 'status', header: 'Status', render: r => <StatusBadge status={r.status}/> },
    { key: 'paid_at', header: 'Paid On', render: r => formatDate(r.paid_at) },
    { key: 'payment_mode', header: 'Mode', render: r => r.payment_mode ? r.payment_mode.replace('_',' ') : '—' },
    { key: 'action', header: '',
      render: r => (
        <div className="flex items-center gap-1 justify-end" onClick={e=>e.stopPropagation()}>
          {r.status !== 'paid' && r.status !== 'cancelled' && <MarkPaidButton transactionId={r.id} onSuccess={load}/>}
          <button className="btn-secondary text-xs px-2.5 py-1" onClick={()=>openEdit(r)}>Edit</button>
          <button className="text-xs px-2.5 py-1 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors" onClick={()=>setReceiptTx(r)} title="Receipt">🧾</button>
          <button className="text-xs px-2.5 py-1 rounded-md border border-red-200 text-red-600 hover:bg-red-50 transition-colors" onClick={()=>setDeleteTx(r)}>Del</button>
        </div>
      )
    },
  ]

  return (
    <div>
      <PageHeader title="Transactions" subtitle="All transactions across every customer. Filter by any field, view totals, or download as CSV." />

      {/* ── Filter bar ──────────────────────────────────────────────────── */}
      <div className="mb-5 space-y-3">
        {/* Top row */}
        <div className="flex flex-wrap items-center gap-3">

          {/* Multi-customer picker */}
          <div className="relative">
            <button
              className={`input w-52 text-left flex items-center justify-between text-sm ${filters.customers.length > 0 ? 'border-accent-400 bg-accent-50' : ''}`}
              onClick={() => setCustDropOpen(v => !v)}
            >
              <span className={filters.customers.length > 0 ? 'text-accent-700 font-medium' : 'text-gray-400'}>
                {filters.customers.length === 0
                  ? 'All Customers'
                  : filters.customers.length === 1
                    ? customers.find(c => c.id === filters.customers[0])?.name ?? '1 selected'
                    : `${filters.customers.length} customers`}
              </span>
              <svg className="w-4 h-4 text-gray-400 ml-2 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
              </svg>
            </button>

            {custDropOpen && (
              <div className="absolute z-30 top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                  <span className="text-xs text-gray-500 font-medium">Select customers</span>
                  {filters.customers.length > 0 && (
                    <button className="text-xs text-accent-600 hover:underline" onClick={() => setFilter('customers', [])}>Clear</button>
                  )}
                </div>
                <div className="max-h-56 overflow-y-auto">
                  {customers.map(c => (
                    <label key={c.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-accent-600"
                        checked={filters.customers.includes(c.id)}
                        onChange={() => toggleCustomer(c.id)}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{c.name}</p>
                        {Number(c.pending_amount) > 0 && (
                          <p className="text-xs text-yellow-600">{formatCurrency(c.pending_amount)} pending</p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
                <div className="px-3 py-2 border-t border-gray-100">
                  <button className="btn-primary w-full text-xs py-1.5" onClick={() => setCustDropOpen(false)}>Done</button>
                </div>
              </div>
            )}
          </div>

          {/* Status */}
          <select className="input w-40" value={filters.status} onChange={e => setFilter('status', e.target.value)}>
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          {/* More filters toggle */}
          <button
            className={`btn-secondary text-xs flex items-center gap-1.5 ${filtersOpen ? 'bg-accent-50 border-accent-300 text-accent-700' : ''}`}
            onClick={() => setFiltersOpen(v => !v)}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 8h10M11 12h2M9 16h6"/>
            </svg>
            More filters
            {activeCount > 0 && (
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-accent-600 text-white text-xs font-bold">{activeCount}</span>
            )}
          </button>

          {activeCount > 0 && <button className="btn-ghost text-xs" onClick={clearFilters}>Clear all</button>}

          <div className="ml-auto">
            <button className="btn-secondary text-xs flex items-center gap-1.5" disabled={visible.length === 0} onClick={() => downloadCSV(visible)}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/>
              </svg>
              Download CSV
            </button>
          </div>
        </div>

        {/* Expanded filter panel */}
        {filtersOpen && (
          <div className="card p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            <div>
              <label className="label text-xs">Service</label>
              <select className="input text-sm" value={filters.service} onChange={e => setFilter('service', e.target.value)}>
                <option value="">All Services</option>
                {serviceNames.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className="label text-xs">Payment Mode</label>
              <select className="input text-sm" value={filters.paymentMode} onChange={e => setFilter('paymentMode', e.target.value)}>
                {PAYMENT_MODE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label text-xs">Amount — Min (₹)</label>
              <input type="number" min="0" className="input text-sm" placeholder="e.g. 500" value={filters.amountMin} onChange={e => setFilter('amountMin', e.target.value)} />
            </div>
            <div>
              <label className="label text-xs">Amount — Max (₹)</label>
              <input type="number" min="0" className="input text-sm" placeholder="e.g. 5000" value={filters.amountMax} onChange={e => setFilter('amountMax', e.target.value)} />
            </div>
            <div>
              <label className="label text-xs">Due Date — From</label>
              <input type="date" className="input text-sm" value={filters.dueDateFrom} onChange={e => setFilter('dueDateFrom', e.target.value)} />
            </div>
            <div>
              <label className="label text-xs">Due Date — To</label>
              <input type="date" className="input text-sm" value={filters.dueDateTo} onChange={e => setFilter('dueDateTo', e.target.value)} />
            </div>
            <div>
              <label className="label text-xs">Paid On — From</label>
              <input type="date" className="input text-sm" value={filters.paidDateFrom} onChange={e => setFilter('paidDateFrom', e.target.value)} />
            </div>
            <div>
              <label className="label text-xs">Paid On — To</label>
              <input type="date" className="input text-sm" value={filters.paidDateTo} onChange={e => setFilter('paidDateTo', e.target.value)} />
            </div>
          </div>
        )}
      </div>

      {loading && <LoadingSpinner />}
      {error && <ErrorMessage message={error} />}

      {!loading && !error && (
        <>
          <p className="text-xs text-gray-400 mb-2">
            {visible.length} of {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
            {activeCount > 0 && ` · ${activeCount} filter${activeCount !== 1 ? 's' : ''} active`}
          </p>

          {/* Table */}
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {columns.map(c => (
                    <th key={c.key} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{c.header}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {visible.length === 0 ? (
                  <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-gray-400">No transactions match your filters.</td></tr>
                ) : (
                  visible.map((row, i) => (
                    <tr key={row.id ?? i} className="hover:bg-gray-50 transition-colors">
                      {columns.map(c => (
                        <td key={c.key} className="px-4 py-3 text-gray-700">{c.render ? c.render(row) : row[c.key] ?? '—'}</td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>

              {/* ── Totals row ──────────────────────────────────────── */}
              {visible.length > 0 && (
                <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                  <tr>
                    <td className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider" colSpan={2}>
                      Totals ({visible.length} rows)
                    </td>
                    <td className="px-4 py-3 font-bold text-gray-900">{formatCurrency(totals.total)}</td>
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        {totals.paid    > 0 && <p className="text-xs text-green-700 font-medium">Paid: {formatCurrency(totals.paid)}</p>}
                        {totals.pending > 0 && <p className="text-xs text-yellow-700 font-medium">Pending: {formatCurrency(totals.pending)}</p>}
                        {totals.overdue > 0 && <p className="text-xs text-red-600 font-medium">Overdue: {formatCurrency(totals.overdue)}</p>}
                      </div>
                    </td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}

      {/* ── Edit Modal ────────────────────────────────────────────────── */}
      <Modal open={!!editTx} onClose={() => setEditTx(null)} title="Edit Transaction">
        <form onSubmit={handleEdit} className="space-y-4">
          <div>
            <label className="label">Customer</label>
            <p className="text-sm font-medium text-gray-700 py-2 px-3 bg-gray-50 rounded-md border border-gray-200">{editTx?.customer_name ?? `#${editTx?.customer_id}`}</p>
          </div>
          <div>
            <label className="label" htmlFor="es">Service <span className="text-red-500">*</span></label>
            <select id="es" className="input" value={editForm.service_id??''} onChange={e=>setEditForm(p=>({...p,service_id:e.target.value}))}>
              <option value="">Select…</option>
              {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="ea">Amount (₹) <span className="text-red-500">*</span></label>
            <input id="ea" type="number" min="0" className="input" value={editForm.amount??''} onChange={e=>setEditForm(p=>({...p,amount:e.target.value}))}/>
          </div>
          <div>
            <label className="label" htmlFor="ed">Due Date <span className="text-red-500">*</span></label>
            <input id="ed" type="date" className="input" value={editForm.due_date??''} onChange={e=>setEditForm(p=>({...p,due_date:e.target.value}))}/>
          </div>
          <div>
            <label className="label" htmlFor="est">Status</label>
            <select id="est" className="input" value={editForm.status??'pending'} onChange={e=>setEditForm(p=>({...p,status:e.target.value}))}>
              {TX_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
            </select>
          </div>
          {editError && <p className="text-sm text-red-600">{editError}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-secondary" onClick={()=>setEditTx(null)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={editSaving}>{editSaving?'Saving…':'Save Changes'}</button>
          </div>
        </form>
      </Modal>

      {/* ── Delete Modal ──────────────────────────────────────────────── */}
      <Modal open={!!deleteTx} onClose={()=>setDeleteTx(null)} title="Delete Transaction">
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            Delete the <span className="font-semibold">{formatCurrency(deleteTx?.amount)}</span> transaction
            for <span className="font-semibold">{deleteTx?.customer_name}</span> (due {formatDate(deleteTx?.due_date)})? This cannot be undone.
          </p>
          {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button className="btn-secondary" onClick={()=>setDeleteTx(null)}>Cancel</button>
            <button className="btn bg-red-600 text-white hover:bg-red-700" disabled={deleting} onClick={handleDelete}>
              {deleting?'Deleting…':'Delete'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Receipt ───────────────────────────────────────────────────── */}
      {receiptTx && <Receipt transaction={receiptTx} onClose={()=>setReceiptTx(null)}/>}
    </div>
  )
}

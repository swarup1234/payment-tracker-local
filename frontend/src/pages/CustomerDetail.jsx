import { useEffect, useState, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  getCustomer, getServices, createTransaction,
  updateTransaction, deleteTransaction,
  updateCustomer, deleteCustomer,
} from '../api.js'
import { formatCurrency, formatDate } from '../utils.js'
import StatusBadge from '../components/StatusBadge.jsx'
import Table from '../components/Table.jsx'
import Modal from '../components/Modal.jsx'
import Receipt from '../components/Receipt.jsx'
import PageHeader from '../components/PageHeader.jsx'
import MarkPaidButton from '../components/MarkPaidButton.jsx'
import { LoadingSpinner, ErrorMessage } from '../components/Feedback.jsx'

const EMPTY_TX = { service_id: '', amount: '', due_date: '' }
const TX_STATUSES = ['pending', 'overdue', 'paid', 'cancelled']

export default function CustomerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Add transaction
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState(EMPTY_TX)
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState(null)

  // Edit transaction
  const [editTx, setEditTx] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState(null)

  // Delete transaction
  const [deleteTx, setDeleteTx] = useState(null)
  const [deletingTx, setDeletingTx] = useState(false)
  const [deleteTxError, setDeleteTxError] = useState(null)

  // Edit customer
  const [editCustOpen, setEditCustOpen] = useState(false)
  const [custForm, setCustForm] = useState({})
  const [custSaving, setCustSaving] = useState(false)
  const [custError, setCustError] = useState(null)

  // Delete customer
  const [deleteCustOpen, setDeleteCustOpen] = useState(false)
  const [deletingCust, setDeletingCust] = useState(false)
  const [deleteCustError, setDeleteCustError] = useState(null)

  // Receipt
  const [receiptTx, setReceiptTx] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [customerData, serviceList] = await Promise.all([
        getCustomer(id),
        getServices(),
      ])
      setData(customerData)
      setServices(serviceList)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  // ── Add Transaction ───────────────────────────────────────────────────────
  function openAdd() {
    setAddForm(EMPTY_TX)
    setAddError(null)
    setAddOpen(true)
  }

  function handleAddChange(e) {
    const { name, value } = e.target
    setAddForm((prev) => ({ ...prev, [name]: value }))
    if (name === 'service_id') {
      const svc = services.find((s) => String(s.id) === value)
      if (svc) setAddForm((prev) => ({ ...prev, service_id: value, amount: svc.default_amount }))
    }
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!addForm.service_id) { setAddError('Select a service.'); return }
    if (!addForm.amount || isNaN(Number(addForm.amount))) { setAddError('Enter a valid amount.'); return }
    if (!addForm.due_date) { setAddError('Due date is required.'); return }
    setAddSaving(true)
    setAddError(null)
    try {
      await createTransaction({
        customer_id: Number(id),
        service_id: Number(addForm.service_id),
        amount: Number(addForm.amount),
        due_date: addForm.due_date,
      })
      setAddOpen(false)
      load()
    } catch (err) {
      setAddError(err.message)
    } finally {
      setAddSaving(false)
    }
  }

  // ── Edit Transaction ──────────────────────────────────────────────────────
  function openEditTx(row) {
    setEditTx(row)
    setEditForm({
      service_id: row.service_id ?? '',
      amount: row.amount ?? '',
      due_date: row.due_date ? row.due_date.slice(0, 10) : '',
      status: row.status ?? 'pending',
    })
    setEditError(null)
  }

  async function handleEditTx(e) {
    e.preventDefault()
    if (!editForm.service_id) { setEditError('Select a service.'); return }
    if (!editForm.amount || isNaN(Number(editForm.amount))) { setEditError('Enter a valid amount.'); return }
    if (!editForm.due_date) { setEditError('Due date is required.'); return }
    setEditSaving(true)
    setEditError(null)
    try {
      await updateTransaction(editTx.id, {
        service_id: Number(editForm.service_id),
        amount: Number(editForm.amount),
        due_date: editForm.due_date,
        status: editForm.status,
      })
      setEditTx(null)
      load()
    } catch (err) {
      setEditError(err.message)
    } finally {
      setEditSaving(false)
    }
  }

  // ── Delete Transaction ────────────────────────────────────────────────────
  async function handleDeleteTx() {
    setDeletingTx(true)
    setDeleteTxError(null)
    try {
      await deleteTransaction(deleteTx.id)
      setDeleteTx(null)
      load()
    } catch (err) {
      setDeleteTxError(err.message)
    } finally {
      setDeletingTx(false)
    }
  }

  // ── Edit Customer ─────────────────────────────────────────────────────────
  function openEditCust() {
    setCustForm({ name: data.name, phone: data.phone, email: data.email || '', address: data.address || '' })
    setCustError(null)
    setEditCustOpen(true)
  }

  async function handleEditCust(e) {
    e.preventDefault()
    if (!custForm.name.trim()) { setCustError('Name is required.'); return }
    if (!custForm.phone.trim()) { setCustError('Phone is required.'); return }
    setCustSaving(true)
    setCustError(null)
    try {
      await updateCustomer(id, custForm)
      setEditCustOpen(false)
      load()
    } catch (err) {
      setCustError(err.message)
    } finally {
      setCustSaving(false)
    }
  }

  // ── Delete Customer ───────────────────────────────────────────────────────
  async function handleDeleteCust() {
    setDeletingCust(true)
    setDeleteCustError(null)
    try {
      await deleteCustomer(id)
      navigate('/customers', { replace: true })
    } catch (err) {
      setDeleteCustError(err.message)
      setDeletingCust(false)
    }
  }

  const txColumns = [
    { key: 'service_name', header: 'Service', render: (row) => row.service_name || '—' },
    { key: 'amount', header: 'Amount', render: (row) => formatCurrency(row.amount) },
    { key: 'due_date', header: 'Due Date', render: (row) => formatDate(row.due_date) },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'paid_at', header: 'Paid On', render: (row) => formatDate(row.paid_at) },
    {
      key: 'payment_mode', header: 'Mode',
      render: (row) => row.payment_mode ? row.payment_mode.replace('_', ' ') : '—',
    },
    {
      key: 'action', header: '',
      render: (row) => (
        <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
          {row.status !== 'paid' && row.status !== 'cancelled' && (
            <MarkPaidButton transactionId={row.id} onSuccess={load} />
          )}
          <button className="btn-secondary text-xs px-2.5 py-1" onClick={() => openEditTx(row)}>Edit</button>
          <button
            className="text-xs px-2.5 py-1 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            onClick={() => setReceiptTx({ ...row, customer_name: data.name, phone: data.phone, email: data.email })}
            title="View / Print receipt"
          >🧾</button>
          <button
            className="text-xs px-2.5 py-1 rounded-md border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
            onClick={() => { setDeleteTx(row); setDeleteTxError(null) }}
          >Del</button>
        </div>
      ),
    },
  ]

  if (loading) return <LoadingSpinner />
  if (error) return <ErrorMessage message={error} />
  if (!data) return null

  const transactions = data.transactions ?? []
  const pendingTotal = transactions
    .filter((t) => t.status === 'pending' || t.status === 'overdue')
    .reduce((sum, t) => sum + Number(t.amount), 0)

  return (
    <div>
      <Link to="/customers" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-5">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        All Customers
      </Link>

      <PageHeader
        title={data.name}
        subtitle="Customer profile and full transaction history."
        action={
          <div className="flex items-center gap-2">
            <button className="btn-secondary text-sm" onClick={openEditCust}>Edit Customer</button>
            <button
              className="text-sm px-3 py-1.5 rounded-md border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
              onClick={() => { setDeleteCustOpen(true); setDeleteCustError(null) }}
            >Delete</button>
            <button className="btn-primary" onClick={openAdd}>+ Add Transaction</button>
          </div>
        }
      />

      {/* Customer info card */}
      <div className="card p-5 mb-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Phone</p>
          <p className="text-sm font-medium text-gray-800">{data.phone || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Email</p>
          <p className="text-sm font-medium text-gray-800">{data.email || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Address</p>
          <p className="text-sm font-medium text-gray-800">{data.address || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Total Pending</p>
          {pendingTotal > 0
            ? <p className="text-sm font-semibold text-yellow-700">{formatCurrency(pendingTotal)}</p>
            : <p className="text-sm font-medium text-green-600">All clear ✓</p>
          }
        </div>
      </div>

      {/* Transaction history */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">
            Transaction History
            <span className="ml-2 text-gray-400 font-normal">({transactions.length})</span>
          </h2>
          {transactions.length > 0 && (
            <span className="text-xs text-gray-400">
              Use the Edit or Del buttons to modify individual transactions
            </span>
          )}
        </div>
        <Table
          columns={txColumns}
          rows={transactions}
          emptyMessage="No transactions for this customer yet."
        />
      </div>

      {/* ── Add Transaction Modal ──────────────────────────────────────── */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Transaction">
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="label" htmlFor="service_id">Service <span className="text-red-500">*</span></label>
            <select id="service_id" name="service_id" className="input" value={addForm.service_id} onChange={handleAddChange}>
              <option value="">Select a service…</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({formatCurrency(s.default_amount)})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="amount">Amount (₹) <span className="text-red-500">*</span></label>
            <input id="amount" name="amount" type="number" min="0" className="input" value={addForm.amount} onChange={handleAddChange} placeholder="500" />
          </div>
          <div>
            <label className="label" htmlFor="due_date">Due Date <span className="text-red-500">*</span></label>
            <input id="due_date" name="due_date" type="date" className="input" value={addForm.due_date} onChange={handleAddChange} />
          </div>
          {addError && <p className="text-sm text-red-600">{addError}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-secondary" onClick={() => setAddOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={addSaving}>
              {addSaving ? 'Saving…' : 'Add Transaction'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Edit Transaction Modal ─────────────────────────────────────── */}
      <Modal open={!!editTx} onClose={() => setEditTx(null)} title="Edit Transaction">
        <form onSubmit={handleEditTx} className="space-y-4">
          <div>
            <label className="label" htmlFor="et-service">Service <span className="text-red-500">*</span></label>
            <select id="et-service" className="input" value={editForm.service_id ?? ''} onChange={(e) => setEditForm((p) => ({ ...p, service_id: e.target.value }))}>
              <option value="">Select a service…</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="et-amount">Amount (₹) <span className="text-red-500">*</span></label>
            <input id="et-amount" type="number" min="0" className="input" value={editForm.amount ?? ''} onChange={(e) => setEditForm((p) => ({ ...p, amount: e.target.value }))} />
          </div>
          <div>
            <label className="label" htmlFor="et-due">Due Date <span className="text-red-500">*</span></label>
            <input id="et-due" type="date" className="input" value={editForm.due_date ?? ''} onChange={(e) => setEditForm((p) => ({ ...p, due_date: e.target.value }))} />
          </div>
          <div>
            <label className="label" htmlFor="et-status">Status</label>
            <select id="et-status" className="input" value={editForm.status ?? 'pending'} onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value }))}>
              {TX_STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
          {editError && <p className="text-sm text-red-600">{editError}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-secondary" onClick={() => setEditTx(null)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={editSaving}>
              {editSaving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Delete Transaction Confirm ─────────────────────────────────── */}
      <Modal open={!!deleteTx} onClose={() => setDeleteTx(null)} title="Delete Transaction">
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            Delete the <span className="font-semibold">{formatCurrency(deleteTx?.amount)}</span> transaction
            for <span className="font-semibold">{deleteTx?.service_name}</span> (due {formatDate(deleteTx?.due_date)})?
            This cannot be undone.
          </p>
          {deleteTxError && <p className="text-sm text-red-600">{deleteTxError}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button className="btn-secondary" onClick={() => setDeleteTx(null)}>Cancel</button>
            <button className="btn bg-red-600 text-white hover:bg-red-700" disabled={deletingTx} onClick={handleDeleteTx}>
              {deletingTx ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Edit Customer Modal ────────────────────────────────────────── */}
      <Modal open={editCustOpen} onClose={() => setEditCustOpen(false)} title="Edit Customer">
        <form onSubmit={handleEditCust} className="space-y-4">
          <div>
            <label className="label">Name <span className="text-red-500">*</span></label>
            <input className="input" value={custForm.name ?? ''} onChange={(e) => setCustForm((p) => ({ ...p, name: e.target.value }))} autoFocus />
          </div>
          <div>
            <label className="label">Phone <span className="text-red-500">*</span></label>
            <input className="input" value={custForm.phone ?? ''} onChange={(e) => setCustForm((p) => ({ ...p, phone: e.target.value }))} />
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" value={custForm.email ?? ''} onChange={(e) => setCustForm((p) => ({ ...p, email: e.target.value }))} />
          </div>
          <div>
            <label className="label">Address</label>
            <textarea rows={2} className="input resize-none" value={custForm.address ?? ''} onChange={(e) => setCustForm((p) => ({ ...p, address: e.target.value }))} />
          </div>
          {custError && <p className="text-sm text-red-600">{custError}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-secondary" onClick={() => setEditCustOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={custSaving}>
              {custSaving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Delete Customer Confirm ────────────────────────────────────── */}
      <Modal open={deleteCustOpen} onClose={() => setDeleteCustOpen(false)} title="Delete Customer">
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            Are you sure you want to delete <span className="font-semibold">{data.name}</span>?
            This will also delete all their transactions and cannot be undone.
          </p>
          {deleteCustError && <p className="text-sm text-red-600">{deleteCustError}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button className="btn-secondary" onClick={() => setDeleteCustOpen(false)}>Cancel</button>
            <button className="btn bg-red-600 text-white hover:bg-red-700" disabled={deletingCust} onClick={handleDeleteCust}>
              {deletingCust ? 'Deleting…' : 'Delete Customer'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Receipt ───────────────────────────────────────────────────── */}
      {receiptTx && (
        <Receipt transaction={receiptTx} onClose={() => setReceiptTx(null)} />
      )}
    </div>
  )
}

import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCustomers, createCustomer, updateCustomer, deleteCustomer } from '../api.js'
import { formatCurrency } from '../utils.js'
import Modal from '../components/Modal.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { LoadingSpinner, ErrorMessage } from '../components/Feedback.jsx'

const EMPTY_FORM = { name: '', phone: '', email: '', address: '' }

export default function Customers() {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Add modal
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState(EMPTY_FORM)
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState(null)

  // Edit modal
  const [editCustomer, setEditCustomer] = useState(null)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState(null)

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setCustomers(await getCustomers())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ── Add ──────────────────────────────────────────────────────────────────
  function openAdd() {
    setAddForm(EMPTY_FORM)
    setAddError(null)
    setAddOpen(true)
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!addForm.name.trim()) { setAddError('Name is required.'); return }
    if (!addForm.phone.trim()) { setAddError('Phone is required.'); return }
    setAddSaving(true)
    setAddError(null)
    try {
      await createCustomer(addForm)
      setAddOpen(false)
      load()
    } catch (err) {
      setAddError(err.message)
    } finally {
      setAddSaving(false)
    }
  }

  // ── Edit ─────────────────────────────────────────────────────────────────
  function openEdit(e, cust) {
    e.stopPropagation()
    setEditCustomer(cust)
    setEditForm({ name: cust.name, phone: cust.phone, email: cust.email || '', address: cust.address || '' })
    setEditError(null)
  }

  async function handleEdit(e) {
    e.preventDefault()
    if (!editForm.name.trim()) { setEditError('Name is required.'); return }
    if (!editForm.phone.trim()) { setEditError('Phone is required.'); return }
    setEditSaving(true)
    setEditError(null)
    try {
      await updateCustomer(editCustomer.id, editForm)
      setEditCustomer(null)
      load()
    } catch (err) {
      setEditError(err.message)
    } finally {
      setEditSaving(false)
    }
  }

  // ── Delete ───────────────────────────────────────────────────────────────
  function openDelete(e, cust) {
    e.stopPropagation()
    setDeleteTarget(cust)
    setDeleteError(null)
  }

  async function handleDelete() {
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteCustomer(deleteTarget.id)
      setDeleteTarget(null)
      load()
    } catch (err) {
      setDeleteError(err.message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle="All your customers. Click a row to view their full transaction history. The Pending column shows total unpaid amount."
        action={
          <button className="btn-primary" onClick={openAdd}>
            + Add Customer
          </button>
        }
      />

      {loading && <LoadingSpinner />}
      {error && <ErrorMessage message={error} />}

      {!loading && !error && (
        <div className="card overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Phone</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Pending Amount
                  <span className="ml-1 text-gray-300 font-normal normal-case tracking-normal">(unpaid)</span>
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    No customers yet. Add one to get started.
                  </td>
                </tr>
              ) : (
                customers.map((cust) => (
                  <tr
                    key={cust.id}
                    className="cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => navigate(`/customers/${cust.id}`)}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">{cust.name}</td>
                    <td className="px-4 py-3 text-gray-700">{cust.phone}</td>
                    <td className="px-4 py-3 text-gray-500">{cust.email || '—'}</td>
                    <td className="px-4 py-3">
                      {Number(cust.pending_amount) > 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="font-medium text-yellow-700">
                            {formatCurrency(cust.pending_amount)}
                          </span>
                          {Number(cust.pending_count) > 0 && (
                            <span className="text-xs text-gray-400">
                              ({cust.pending_count} txn{cust.pending_count !== 1 ? 's' : ''})
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-green-600 text-xs font-medium">All clear ✓</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          className="btn-secondary text-xs px-2.5 py-1"
                          onClick={(e) => openEdit(e, cust)}
                        >
                          Edit
                        </button>
                        <button
                          className="text-xs px-2.5 py-1 rounded-md border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                          onClick={(e) => openDelete(e, cust)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Add Customer Modal ─────────────────────────────────────────── */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Customer">
        <form onSubmit={handleAdd} className="space-y-4">
          <CustomerFormFields form={addForm} onChange={(e) => setAddForm((p) => ({ ...p, [e.target.name]: e.target.value }))} />
          {addError && <p className="text-sm text-red-600">{addError}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-secondary" onClick={() => setAddOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={addSaving}>
              {addSaving ? 'Saving…' : 'Add Customer'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Edit Customer Modal ────────────────────────────────────────── */}
      <Modal open={!!editCustomer} onClose={() => setEditCustomer(null)} title={`Edit — ${editCustomer?.name ?? ''}`}>
        <form onSubmit={handleEdit} className="space-y-4">
          <CustomerFormFields form={editForm} onChange={(e) => setEditForm((p) => ({ ...p, [e.target.name]: e.target.value }))} />
          {editError && <p className="text-sm text-red-600">{editError}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-secondary" onClick={() => setEditCustomer(null)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={editSaving}>
              {editSaving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Delete Confirm Modal ───────────────────────────────────────── */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Customer">
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            Are you sure you want to delete <span className="font-semibold">{deleteTarget?.name}</span>?
            This will also delete all their transactions and cannot be undone.
          </p>
          {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
            <button
              className="btn bg-red-600 text-white hover:bg-red-700"
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function CustomerFormFields({ form, onChange }) {
  return (
    <>
      <div>
        <label className="label" htmlFor="name">Name <span className="text-red-500">*</span></label>
        <input id="name" name="name" className="input" value={form.name} onChange={onChange} placeholder="Ravi Kumar" autoFocus />
      </div>
      <div>
        <label className="label" htmlFor="phone">Phone <span className="text-red-500">*</span></label>
        <input id="phone" name="phone" className="input" value={form.phone} onChange={onChange} placeholder="+919800000000" />
      </div>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" className="input" value={form.email} onChange={onChange} placeholder="ravi@example.com" />
      </div>
      <div>
        <label className="label" htmlFor="address">Address</label>
        <textarea id="address" name="address" rows={2} className="input resize-none" value={form.address} onChange={onChange} placeholder="123 Main St, City" />
      </div>
    </>
  )
}

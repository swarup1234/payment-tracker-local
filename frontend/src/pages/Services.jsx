import { useEffect, useState, useCallback } from 'react'
import { getServices, updateService, createService } from '../api.js'
import { formatCurrency, capitalise } from '../utils.js'
import PageHeader from '../components/PageHeader.jsx'
import Modal from '../components/Modal.jsx'
import { LoadingSpinner, ErrorMessage } from '../components/Feedback.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const BILLING_CYCLES = ['monthly', 'quarterly', 'half-yearly', 'yearly', 'one-time']

export default function Services() {
  const { refreshMe } = useAuth()
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Edit / Add modal
  const [isAdding, setIsAdding] = useState(false)
  const [editService, setEditService] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setServices(await getServices())
      await refreshMe()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [refreshMe])

  useEffect(() => { load() }, [load])

  function openAdd() {
    setIsAdding(true)
    setEditService(null)
    setForm({
      name: '',
      default_amount: 0,
      billing_cycle: 'monthly',
      is_active: true,
    })
    setFormError(null)
  }

  function openEdit(svc) {
    setIsAdding(false)
    setEditService(svc)
    setForm({
      name: svc.name,
      default_amount: svc.default_amount ?? 0,
      billing_cycle: svc.billing_cycle ?? 'monthly',
      is_active: svc.is_active,
    })
    setFormError(null)
  }

  function closeModal() {
    setIsAdding(false)
    setEditService(null)
    setFormError(null)
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.name.trim()) { setFormError('Service name is required.'); return }
    if (isNaN(Number(form.default_amount))) { setFormError('Enter a valid amount.'); return }
    setSaving(true)
    setFormError(null)
    try {
      if (isAdding) {
        await createService({
          name: form.name.trim(),
          default_amount: Number(form.default_amount),
          billing_cycle: form.billing_cycle,
        })
      } else {
        await updateService(editService.id, {
          name: form.name.trim(),
          default_amount: Number(form.default_amount),
          billing_cycle: form.billing_cycle,
          is_active: form.is_active,
        })
      }
      closeModal()
      load()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <PageHeader
          title="Services"
          subtitle="Configure your subscription services (Max 10 services allowed per user)."
        />
        <button className="btn-primary flex items-center gap-2 text-sm" onClick={openAdd}>
          <span>+ Add Service</span>
        </button>
      </div>

      {loading && <LoadingSpinner />}
      {error && <ErrorMessage message={error} />}

      {!loading && !error && (
        <div className="card overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Service Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Default Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Billing Cycle</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {services.map((svc) => (
                <tr key={svc.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{svc.name}</td>
                  <td className="px-4 py-3 text-gray-700">{formatCurrency(svc.default_amount)}</td>
                  <td className="px-4 py-3 text-gray-700">{capitalise(svc.billing_cycle)}</td>
                  <td className="px-4 py-3">
                    {svc.is_active ? (
                      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-100 text-green-700">Active</span>
                    ) : (
                      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-500">Inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      className="btn-secondary text-xs px-3 py-1"
                      onClick={() => openEdit(svc)}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit / Add Service Modal */}
      <Modal open={isAdding || !!editService} onClose={closeModal} title={isAdding ? 'Add New Service' : `Edit Service — ${editService?.name ?? ''}`}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="label" htmlFor="svc-name">
              Service Name <span className="text-red-500">*</span>
            </label>
            <input
              id="svc-name"
              name="name"
              className="input"
              value={form.name ?? ''}
              onChange={handleChange}
              placeholder="e.g. Broadband Subscription"
              autoFocus
            />
          </div>

          <div>
            <label className="label" htmlFor="svc-amount">
              Default Amount (₹) <span className="text-red-500">*</span>
            </label>
            <input
              id="svc-amount"
              name="default_amount"
              type="number"
              min="0"
              className="input"
              value={form.default_amount ?? ''}
              onChange={handleChange}
              placeholder="500"
            />
          </div>

          <div>
            <label className="label" htmlFor="svc-cycle">Billing Cycle</label>
            <select
              id="svc-cycle"
              name="billing_cycle"
              className="input"
              value={form.billing_cycle ?? 'monthly'}
              onChange={handleChange}
            >
              {BILLING_CYCLES.map((c) => (
                <option key={c} value={c}>{capitalise(c)}</option>
              ))}
            </select>
          </div>

          {!isAdding && (
            <div className="flex items-center gap-2">
              <input
                id="svc-active"
                name="is_active"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-accent-600 focus:ring-accent-500"
                checked={form.is_active ?? true}
                onChange={handleChange}
              />
              <label htmlFor="svc-active" className="text-sm text-gray-700">
                Active (visible when adding transactions)
              </label>
            </div>
          )}

          {formError && <p className="text-sm text-red-600 font-medium">{formError}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-secondary" onClick={closeModal}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : (isAdding ? 'Create Service' : 'Save Changes')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

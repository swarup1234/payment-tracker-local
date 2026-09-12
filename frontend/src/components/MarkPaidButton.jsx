import { useState } from 'react'
import { markPaid } from '../api.js'

const MODES = ['cash', 'bank_transfer', 'online']

/**
 * Renders a "Mark Paid" button that expands into a payment mode picker.
 * Calls onSuccess() after successful API call so the parent can refresh.
 */
export default function MarkPaidButton({ transactionId, onSuccess }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handlePay(mode) {
    setLoading(true)
    setError(null)
    try {
      await markPaid(transactionId, mode)
      setOpen(false)
      onSuccess?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button className="btn-primary text-xs px-2 py-1" onClick={() => setOpen(true)}>
        Mark Paid
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {MODES.map((mode) => (
        <button
          key={mode}
          disabled={loading}
          onClick={() => handlePay(mode)}
          className="btn-secondary text-xs px-2 py-1 capitalize"
        >
          {mode.replace('_', ' ')}
        </button>
      ))}
      <button
        onClick={() => { setOpen(false); setError(null) }}
        className="btn-ghost text-xs px-2 py-1"
        aria-label="Cancel"
      >
        ✕
      </button>
      {error && <span className="text-xs text-red-500 w-full mt-0.5">{error}</span>}
    </div>
  )
}

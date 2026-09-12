import { NavLink } from 'react-router-dom'
import { useState } from 'react'
import { exportBackup } from '../api.js'

const links = [
  { to: '/',             label: 'Dashboard',    icon: DashboardIcon,    desc: 'Overview & overdue' },
  { to: '/customers',    label: 'Customers',    icon: CustomersIcon,    desc: 'Manage customers' },
  { to: '/transactions', label: 'Transactions', icon: TransactionsIcon, desc: 'All payments' },
  { to: '/bulk-charge',  label: 'Bulk Charge',  icon: BulkChargeIcon,   desc: 'Charge many at once' },
  { to: '/services',     label: 'Services',     icon: ServicesIcon,     desc: 'Edit service plans' },
]

// ── CSV helpers ───────────────────────────────────────────────────────────────

function toCSV(headers, rows) {
  const esc = (v) => {
    if (v == null) return ''
    const s = String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }
  return [headers.join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n')
}

function triggerDownload(content, filename, mime = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function Sidebar() {
  const [downloading, setDownloading] = useState(false)
  const [dlError, setDlError] = useState(null)

  async function handleDownloadBackup() {
    setDownloading(true)
    setDlError(null)
    try {
      const data = await exportBackup()
      const date = new Date().toISOString().slice(0, 10)

      // ── Customers CSV ───────────────────────────────────────────────
      const custCSV = toCSV(
        ['ID', 'Name', 'Phone', 'Email', 'Address', 'Created At'],
        data.customers.map((c) => [c.id, c.name, c.phone, c.email, c.address, c.created_at])
      )

      // ── Transactions CSV ────────────────────────────────────────────
      const txCSV = toCSV(
        ['ID', 'Customer', 'Service', 'Amount (₹)', 'Due Date', 'Status', 'Payment Mode', 'Paid On'],
        data.transactions.map((t) => [
          t.id,
          t.customer_name ?? t.customer_id,
          t.service_name ?? t.service_id,
          t.amount,
          t.due_date ? t.due_date.slice(0, 10) : '',
          t.status,
          t.payment_mode ?? '',
          t.paid_at ? new Date(t.paid_at).toISOString().slice(0, 10) : '',
        ])
      )

      // Download both files
      triggerDownload(custCSV, `paytracker_customers_${date}.csv`)
      // Small delay so browser doesn't block the second download
      await new Promise((r) => setTimeout(r, 300))
      triggerDownload(txCSV, `paytracker_transactions_${date}.csv`)
    } catch (err) {
      setDlError('Download failed: ' + err.message)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <aside className="w-56 shrink-0 flex flex-col bg-white border-r border-gray-200 min-h-screen">
      {/* Logo */}
      <div className="h-14 flex items-center px-5 border-b border-gray-200">
        <span className="text-accent-600 font-semibold text-base tracking-tight">
          PayTracker
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-accent-50 text-accent-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Download Backup — bottom of sidebar */}
      <div className="px-3 py-4 border-t border-gray-200 space-y-2">
        <button
          onClick={handleDownloadBackup}
          disabled={downloading}
          className="w-full flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors disabled:opacity-50"
        >
          <DownloadIcon className="w-4 h-4 shrink-0" />
          {downloading ? 'Downloading…' : 'Download Backup'}
        </button>
        {dlError && (
          <p className="text-xs text-red-500 px-3">{dlError}</p>
        )}
        <p className="text-xs text-gray-400 px-3 leading-snug">
          Downloads customers &amp; transactions as two CSV files.
        </p>
      </div>
    </aside>
  )
}

// ── Inline SVG icons ──────────────────────────────────────────────────────────

function DashboardIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

function CustomersIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  )
}

function TransactionsIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6M9 16h4" />
    </svg>
  )
}

function BulkChargeIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a5 5 0 00-10 0v2" />
      <rect x="3" y="9" width="18" height="12" rx="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 14v3M10 16h4" />
    </svg>
  )
}

function ServicesIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
  )
}

function DownloadIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
    </svg>
  )
}

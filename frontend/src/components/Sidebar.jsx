import { NavLink } from 'react-router-dom'
import { useState } from 'react'
import { exportBackup } from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'
import ChangePasswordModal from './ChangePasswordModal.jsx'

const links = [
  { to: '/',             label: 'Dashboard',    icon: DashboardIcon,    desc: 'Overview & overdue' },
  { to: '/customers',    label: 'Customers',    icon: CustomersIcon,    desc: 'Manage customers' },
  { to: '/transactions', label: 'Transactions', icon: TransactionsIcon, desc: 'All payments' },
  { to: '/bulk-charge',  label: 'Bulk Charge',  icon: BulkChargeIcon,   desc: 'Charge many at once' },
  { to: '/services',     label: 'Services',     icon: ServicesIcon,     desc: 'Edit service plans' },
]

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
  const { user, quotas, logout } = useAuth()
  const [downloading, setDownloading] = useState(false)
  const [dlError, setDlError] = useState(null)

  async function handleDownloadBackup() {
    setDownloading(true)
    setDlError(null)
    try {
      const data = await exportBackup()
      const date = new Date().toISOString().slice(0, 10)

      const custCSV = toCSV(
        ['ID', 'Name', 'Phone', 'Email', 'Address', 'Created At'],
        data.customers.map((c) => [c.id, c.name, c.phone, c.email, c.address, c.created_at])
      )

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

      triggerDownload(custCSV, `paytracker_customers_${date}.csv`)
      await new Promise((r) => setTimeout(r, 300))
      triggerDownload(txCSV, `paytracker_transactions_${date}.csv`)
    } catch (err) {
      setDlError('Download failed: ' + err.message)
    } finally {
      setDownloading(false)
    }
  }

  const [showPasswordModal, setShowPasswordModal] = useState(false)

  return (
    <aside className="w-64 shrink-0 flex flex-col bg-white border-r border-gray-200 min-h-screen">
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-5 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow-md shadow-indigo-600/20">
            💳
          </span>
          <span className="text-gray-900 font-bold text-base tracking-tight">
            PayTracker
          </span>
        </div>
      </div>

      {/* User Info & Profile */}
      {user && (
        <div className="p-3 mx-3 mt-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">
              {user.name ? user.name[0].toUpperCase() : 'U'}
            </div>
            <div className="truncate">
              <p className="text-xs font-semibold text-gray-900 truncate">{user.name}</p>
              <p className="text-[10px] text-gray-500 truncate">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={() => setShowPasswordModal(true)}
              title="Change Password"
              className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            >
              <KeyIcon className="w-4 h-4" />
            </button>
            <button
              onClick={logout}
              title="Sign Out"
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogoutIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      <ChangePasswordModal open={showPasswordModal} onClose={() => setShowPasswordModal(false)} />

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-xs'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User Quotas Widget */}
      {quotas && (
        <div className="mx-3 mb-3 p-3 bg-slate-900 text-slate-100 rounded-xl border border-slate-800 text-xs space-y-2">
          <div className="flex items-center justify-between font-semibold text-[11px] text-slate-300 uppercase tracking-wider">
            <span>Free Tier Usage</span>
            <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded">Active</span>
          </div>

          <div className="space-y-1.5">
            <div>
              <div className="flex justify-between text-[11px] text-slate-400 mb-0.5">
                <span>Services</span>
                <span className="font-mono text-slate-200">{quotas.services.current} / {quotas.services.limit}</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-500 h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, (quotas.services.current / quotas.services.limit) * 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] text-slate-400 mb-0.5">
                <span>Customers</span>
                <span className="font-mono text-slate-200">{quotas.customers.current} / {quotas.customers.limit.toLocaleString()}</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, (quotas.customers.current / quotas.customers.limit) * 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] text-slate-400 mb-0.5">
                <span>Transactions</span>
                <span className="font-mono text-slate-200">{quotas.transactions.current.toLocaleString()} / {quotas.transactions.limit.toLocaleString()}</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-purple-500 h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, (quotas.transactions.current / quotas.transactions.limit) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Download Backup — bottom of sidebar */}
      <div className="px-3 py-3 border-t border-gray-200 space-y-2">
        <button
          onClick={handleDownloadBackup}
          disabled={downloading}
          className="w-full flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          <DownloadIcon className="w-3.5 h-3.5 shrink-0" />
          {downloading ? 'Downloading…' : 'Export CSV Backup'}
        </button>
        {dlError && (
          <p className="text-[11px] text-red-500 px-2">{dlError}</p>
        )}
      </div>
    </aside>
  )
}

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

function LogoutIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  )
}

function KeyIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
    </svg>
  )
}

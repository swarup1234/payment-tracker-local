import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { getOverdue, getTransactions, getCustomers } from '../api.js'
import { formatCurrency, formatDate, sumBy } from '../utils.js'
import SummaryCard from '../components/SummaryCard.jsx'
import MarkPaidButton from '../components/MarkPaidButton.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { LoadingSpinner, ErrorMessage } from '../components/Feedback.jsx'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const STATUS_COLORS = { paid: '#22c55e', pending: '#eab308', overdue: '#ef4444', cancelled: '#9ca3af' }
const BAR_COLORS = ['#6366f1','#8b5cf6','#ec4899','#f97316','#14b8a6','#0ea5e9']

// ── helpers ───────────────────────────────────────────────────────────────────

function buildMonthlyData(transactions) {
  const map = {}
  transactions.forEach((t) => {
    const d = new Date(t.paid_at || t.due_date)
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2,'0')}`
    const label = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`
    if (!map[key]) map[key] = { key, label, collected: 0, pending: 0, overdue: 0 }
    if (t.status === 'paid')    map[key].collected += Number(t.amount)
    if (t.status === 'pending') map[key].pending   += Number(t.amount)
    if (t.status === 'overdue') map[key].overdue   += Number(t.amount)
  })
  return Object.values(map).sort((a,b) => a.key.localeCompare(b.key)).slice(-6)
}

function buildStatusData(transactions) {
  const counts = {}
  transactions.forEach((t) => { counts[t.status] = (counts[t.status] || 0) + 1 })
  return Object.entries(counts).map(([status, count]) => ({ name: status, value: count, color: STATUS_COLORS[status] || '#9ca3af' }))
}

function buildCustomerPending(customers) {
  return customers
    .filter((c) => Number(c.pending_amount) > 0)
    .sort((a,b) => Number(b.pending_amount) - Number(a.pending_amount))
    .slice(0, 8)
    .map((c) => ({ name: c.name, amount: Number(c.pending_amount) }))
}

function buildUpcomingDues(transactions) {
  const today = new Date()
  today.setHours(0,0,0,0)
  const in30 = new Date(today); in30.setDate(in30.getDate() + 30)
  return transactions
    .filter((t) => {
      if (t.status !== 'pending') return false
      const d = new Date(t.due_date)
      return d >= today && d <= in30
    })
    .sort((a,b) => new Date(a.due_date) - new Date(b.due_date))
    .slice(0, 8)
}

// ── custom tooltip ────────────────────────────────────────────────────────────
function CurrencyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  )
}

// ── component ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [overdue, setOverdue]       = useState([])
  const [allTx, setAllTx]           = useState([])
  const [customers, setCustomers]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [overdueData, txData, custData] = await Promise.all([
        getOverdue(), getTransactions(), getCustomers(),
      ])
      setOverdue(overdueData)
      setAllTx(txData)
      setCustomers(custData)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Derived
  const pending      = allTx.filter(t => t.status === 'pending')
  const overdueAll   = allTx.filter(t => t.status === 'overdue')
  const paid         = allTx.filter(t => t.status === 'paid')
  const now          = new Date()
  const paidThisMonth = paid.filter(t => {
    const d = new Date(t.paid_at)
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  })

  const monthlyData    = buildMonthlyData(allTx)
  const statusData     = buildStatusData(allTx)
  const customerPending = buildCustomerPending(customers)
  const upcomingDues   = buildUpcomingDues(allTx)

  const overdueColumns = [
    { key: 'customer_name', header: 'Customer',
      render: r => <Link to={`/customers/${r.customer_id}`} className="font-medium text-accent-600 hover:underline">{r.customer_name}</Link> },
    { key: 'service_name', header: 'Service', render: r => r.service_name || '—' },
    { key: 'amount', header: 'Amount', render: r => formatCurrency(r.amount) },
    { key: 'due_date', header: 'Due Date', render: r => formatDate(r.due_date) },
    { key: 'action', header: '', render: r => <MarkPaidButton transactionId={r.id} onSuccess={load} /> },
  ]

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Real-time overview of your payment activity."
      />

      {loading && <LoadingSpinner />}
      {error && <ErrorMessage message={error} />}

      {!loading && !error && (
        <div className="space-y-6">

          {/* ── Summary cards ────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <SummaryCard label="Total Pending"    value={formatCurrency(sumBy(pending, 'amount'))}      accent="yellow" hint={`${pending.length} transaction${pending.length !== 1 ? 's' : ''}`} />
            <SummaryCard label="Total Overdue"    value={formatCurrency(sumBy(overdueAll, 'amount'))}   accent="red"    hint={`${overdueAll.length} past due`} />
            <SummaryCard label="Collected This Month" value={formatCurrency(sumBy(paidThisMonth, 'amount'))} accent="green" hint={`${paidThisMonth.length} payment${paidThisMonth.length !== 1 ? 's' : ''}`} />
            <SummaryCard label="Total Customers"  value={String(customers.length)}                      accent="blue"   hint={`${customers.filter(c => Number(c.pending_amount) > 0).length} with pending dues`} />
          </div>

          {/* ── Row 1: Monthly bar chart + Status donut ───────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Monthly collections bar */}
            <div className="card p-5 lg:col-span-2">
              <h2 className="text-sm font-semibold text-gray-800 mb-1">Monthly Overview</h2>
              <p className="text-xs text-gray-400 mb-4">Collected vs pending vs overdue by month</p>
              {monthlyData.length === 0 ? (
                <p className="text-sm text-gray-400 py-8 text-center">No data yet</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={monthlyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={v => `₹${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`} tick={{ fontSize: 11 }} width={52} />
                    <Tooltip content={<CurrencyTooltip />} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="collected" name="Collected" fill="#22c55e" radius={[3,3,0,0]} />
                    <Bar dataKey="pending"   name="Pending"   fill="#eab308" radius={[3,3,0,0]} />
                    <Bar dataKey="overdue"   name="Overdue"   fill="#ef4444" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Status donut */}
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-gray-800 mb-1">Transaction Status</h2>
              <p className="text-xs text-gray-400 mb-4">Breakdown by status</p>
              {statusData.length === 0 ? (
                <p className="text-sm text-gray-400 py-8 text-center">No data yet</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%" cy="45%"
                      innerRadius={55} outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, value }) => `${name} (${value})`}
                      labelLine={false}
                    >
                      {statusData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v, n) => [v + ' transactions', n]} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* ── Row 2: Per-customer pending + Upcoming dues ──────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Per-customer pending bar */}
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-gray-800 mb-1">Pending by Customer</h2>
              <p className="text-xs text-gray-400 mb-4">Total unpaid amount per customer</p>
              {customerPending.length === 0 ? (
                <p className="text-sm text-green-600 py-8 text-center font-medium">All customers are up to date ✓</p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(customerPending.length * 44, 160)}>
                  <BarChart
                    data={customerPending}
                    layout="vertical"
                    margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                    <XAxis type="number" tickFormatter={v => `₹${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={80} />
                    <Tooltip formatter={(v) => [formatCurrency(v), 'Pending']} />
                    <Bar dataKey="amount" radius={[0,3,3,0]}>
                      {customerPending.map((_, i) => (
                        <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Upcoming dues */}
            <div className="card p-0 overflow-hidden flex flex-col">
              <div className="px-5 py-4 border-b border-gray-200">
                <h2 className="text-sm font-semibold text-gray-800">Upcoming Dues</h2>
                <p className="text-xs text-gray-400 mt-0.5">Pending transactions due in the next 30 days</p>
              </div>
              {upcomingDues.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No upcoming dues in 30 days</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {upcomingDues.map((t) => {
                    const daysLeft = Math.ceil((new Date(t.due_date) - new Date()) / 86400000)
                    return (
                      <div key={t.id} className="flex items-center justify-between px-5 py-3">
                        <div>
                          <Link to={`/customers/${t.customer_id}`} className="text-sm font-medium text-accent-600 hover:underline">
                            {t.customer_name}
                          </Link>
                          <p className="text-xs text-gray-400">{t.service_name} · due {formatDate(t.due_date)}</p>
                        </div>
                        <div className="text-right ml-4">
                          <p className="text-sm font-semibold text-gray-900">{formatCurrency(t.amount)}</p>
                          <p className={`text-xs font-medium ${daysLeft <= 3 ? 'text-red-500' : daysLeft <= 7 ? 'text-yellow-600' : 'text-gray-400'}`}>
                            {daysLeft === 0 ? 'Due today' : daysLeft === 1 ? 'Tomorrow' : `${daysLeft} days`}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Overdue table ─────────────────────────────────────────── */}
          {overdue.length > 0 && (
            <div className="card p-0 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    Overdue Transactions
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-700 text-xs font-bold">{overdue.length}</span>
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">Payments past their due date — mark as paid to clear</p>
                </div>
                <Link to="/transactions?status=overdue" className="text-xs text-accent-600 hover:underline">View all</Link>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {overdueColumns.map(c => (
                        <th key={c.key} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{c.header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {overdue.map((row, i) => (
                      <tr key={row.id ?? i} className="hover:bg-gray-50">
                        {overdueColumns.map(c => (
                          <td key={c.key} className="px-4 py-3 text-gray-700">
                            {c.render ? c.render(row) : row[c.key] ?? '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}

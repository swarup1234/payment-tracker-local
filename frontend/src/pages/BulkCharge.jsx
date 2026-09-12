import { useEffect, useState, useCallback } from 'react'
import { getCustomers, getServices, bulkCharge, bulkImport } from '../api.js'
import { formatCurrency } from '../utils.js'
import PageHeader from '../components/PageHeader.jsx'
import { LoadingSpinner, ErrorMessage } from '../components/Feedback.jsx'

// ── CSV helpers ───────────────────────────────────────────────────────────────

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return { headers: [], rows: [] }
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  const rows = lines.slice(1).map(line => {
    // Handle quoted fields
    const cols = []
    let cur = '', inQ = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { inQ = !inQ }
      else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = '' }
      else { cur += ch }
    }
    cols.push(cur.trim())
    return Object.fromEntries(headers.map((h, i) => [h, (cols[i] ?? '').replace(/^"|"$/g, '')]))
  }).filter(r => Object.values(r).some(v => v !== ''))
  return { headers, rows }
}

function downloadTemplate(customers, services) {
  const custNames = customers.map(c => c.name).join(' / ')
  const svcNames  = services.map(s => s.name).join(' / ')
  const today = new Date().toISOString().slice(0, 10)
  const lines = [
    'customer_name,service_name,amount,due_date',
    `# customer_name: one of — ${custNames}`,
    `# service_name: one of — ${svcNames}`,
    `# due_date: YYYY-MM-DD format`,
    `# Delete these comment lines before uploading`,
    `${customers[0]?.name ?? 'Customer Name'},${services[0]?.name ?? 'Service Name'},500,${today}`,
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'paytracker_import_template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BulkCharge() {
  const [tab, setTab] = useState('manual') // 'manual' | 'csv'
  const [customers, setCustomers] = useState([])
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setLoadError(null)
    try {
      const [c, s] = await Promise.all([getCustomers(), getServices()])
      setCustomers(c)
      setServices(s.filter(sv => sv.is_active))
    } catch (err) { setLoadError(err.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <PageHeader
        title="Bulk Charge"
        subtitle="Add transactions for multiple customers at once — manually or by uploading a CSV file."
      />

      {loading && <LoadingSpinner />}
      {loadError && <ErrorMessage message={loadError} />}

      {!loading && !loadError && (
        <>
          {/* Tab bar */}
          <div className="flex gap-1 mb-6 border-b border-gray-200">
            {[
              { key: 'manual', label: '⚡ Manual Charge' },
              { key: 'csv',    label: '📄 Import from CSV' },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  tab === t.key
                    ? 'border-accent-600 text-accent-700'
                    : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'manual' && (
            <ManualTab customers={customers} services={services} onSuccess={load} />
          )}
          {tab === 'csv' && (
            <CsvTab customers={customers} services={services} onSuccess={load} />
          )}
        </>
      )}
    </div>
  )
}

// ── Manual charge tab (existing functionality) ────────────────────────────────

function ManualTab({ customers, services, onSuccess }) {
  const [selected, setSelected] = useState(new Set())
  const [serviceId, setServiceId] = useState('')
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)
  const [search, setSearch] = useState('')

  function handleServiceChange(e) {
    const sid = e.target.value
    setServiceId(sid)
    const svc = services.find(s => String(s.id) === sid)
    if (svc && Number(svc.default_amount) > 0) setAmount(svc.default_amount)
  }

  function toggleOne(id) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const filtered = search.trim()
    ? customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search))
    : customers

  function toggleAll() {
    const ids = filtered.map(c => c.id)
    const allSel = ids.every(id => selected.has(id))
    setSelected(prev => { const n = new Set(prev); allSel ? ids.forEach(id => n.delete(id)) : ids.forEach(id => n.add(id)); return n })
  }

  const allVisibleSelected = filtered.length > 0 && filtered.every(c => selected.has(c.id))

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError(null); setSuccessMsg(null)
    if (selected.size === 0) { setFormError('Select at least one customer.'); return }
    if (!serviceId) { setFormError('Select a service.'); return }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) { setFormError('Enter a valid amount.'); return }
    if (!dueDate) { setFormError('Due date is required.'); return }
    setSubmitting(true)
    try {
      const result = await bulkCharge({ customer_ids: Array.from(selected), service_id: Number(serviceId), amount: Number(amount), due_date: dueDate })
      setSuccessMsg(`✓ Created ${result.created} transaction${result.created !== 1 ? 's' : ''} successfully.`)
      setSelected(new Set()); setDueDate('')
      onSuccess()
    } catch (err) { setFormError(err.message) }
    finally { setSubmitting(false) }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer list */}
        <div className="lg:col-span-2 card p-0 overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <input type="checkbox" id="sel-all" className="h-4 w-4 rounded border-gray-300 text-accent-600" checked={allVisibleSelected} onChange={toggleAll} />
              <label htmlFor="sel-all" className="text-sm font-medium text-gray-700 select-none">
                {selected.size > 0 ? `${selected.size} selected` : 'Select all'}
              </label>
            </div>
            <input type="search" className="input w-52 text-sm" placeholder="Search customers…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 420 }}>
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <tbody className="bg-white divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400">No customers found.</td></tr>
                ) : filtered.map(c => (
                  <tr key={c.id} className={`cursor-pointer transition-colors ${selected.has(c.id) ? 'bg-accent-50' : 'hover:bg-gray-50'}`} onClick={() => toggleOne(c.id)}>
                    <td className="px-4 py-2.5 w-8">
                      <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-accent-600" checked={selected.has(c.id)} onChange={() => toggleOne(c.id)} onClick={e => e.stopPropagation()} />
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-gray-900">{c.name}</p>
                      <p className="text-xs text-gray-400">{c.phone}</p>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {Number(c.pending_amount) > 0
                        ? <span className="text-xs text-yellow-700 font-medium">{formatCurrency(c.pending_amount)} pending</span>
                        : <span className="text-xs text-gray-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Charge details */}
        <div className="space-y-4">
          <div className="card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-800">Charge Details</h2>
            <div>
              <label className="label">Service <span className="text-red-500">*</span></label>
              <select className="input" value={serviceId} onChange={handleServiceChange}>
                <option value="">Select a service…</option>
                {services.map(s => <option key={s.id} value={s.id}>{s.name} — {formatCurrency(s.default_amount)}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Amount (₹) <span className="text-red-500">*</span></label>
              <input type="number" min="1" className="input" value={amount} onChange={e => setAmount(e.target.value)} placeholder="500" />
            </div>
            <div>
              <label className="label">Due Date <span className="text-red-500">*</span></label>
              <input type="date" className="input" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
          </div>

          {selected.size > 0 && serviceId && amount && dueDate && (
            <div className="card p-4 bg-accent-50 border-accent-200 text-sm text-accent-800 space-y-1">
              <p className="font-semibold">Summary</p>
              <p>Customers: <span className="font-medium">{selected.size}</span></p>
              <p>Amount each: <span className="font-medium">{formatCurrency(amount)}</span></p>
              <p>Total: <span className="font-semibold">{formatCurrency(Number(amount) * selected.size)}</span></p>
            </div>
          )}

          {formError && <ErrorMessage message={formError} />}
          {successMsg && <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{successMsg}</div>}

          <button type="submit" className="btn-primary w-full justify-center" disabled={submitting || selected.size === 0}>
            {submitting ? 'Creating…' : `Charge ${selected.size > 0 ? selected.size : ''} Customer${selected.size !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </form>
  )
}

// ── CSV import tab ────────────────────────────────────────────────────────────

function CsvTab({ customers, services, onSuccess }) {
  const [previewRows, setPreviewRows] = useState(null)  // parsed rows before submit
  const [fileName, setFileName]       = useState('')
  const [parseError, setParseError]   = useState(null)
  const [submitting, setSubmitting]   = useState(false)
  const [result, setResult]           = useState(null)  // { created, errors }
  const [submitError, setSubmitError] = useState(null)

  const REQUIRED_COLS = ['customer_name', 'service_name', 'amount', 'due_date']

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setFileName(file.name)
    setPreviewRows(null); setParseError(null); setResult(null); setSubmitError(null)

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        // Strip comment lines (lines starting with #)
        const cleaned = ev.target.result.split(/\r?\n/).filter(l => !l.trim().startsWith('#')).join('\n')
        const { headers, rows } = parseCSV(cleaned)

        const missing = REQUIRED_COLS.filter(c => !headers.map(h => h.toLowerCase()).includes(c))
        if (missing.length > 0) {
          setParseError(`Missing required columns: ${missing.join(', ')}. Expected: customer_name, service_name, amount, due_date`)
          return
        }
        if (rows.length === 0) { setParseError('No data rows found in the file.'); return }
        if (rows.length > 500) { setParseError('Too many rows (max 500 per upload). Split into smaller files.'); return }

        setPreviewRows(rows)
      } catch (err) {
        setParseError('Could not parse the file: ' + err.message)
      }
    }
    reader.readAsText(file)
  }

  function clearFile() {
    setPreviewRows(null); setFileName(''); setParseError(null); setResult(null); setSubmitError(null)
    // Reset the file input
    const input = document.getElementById('csv-upload')
    if (input) input.value = ''
  }

  async function handleImport() {
    if (!previewRows?.length) return
    setSubmitting(true); setSubmitError(null); setResult(null)
    try {
      const res = await bulkImport({ rows: previewRows })
      setResult(res)
      if (res.created > 0) { onSuccess(); setPreviewRows(null); setFileName('') }
    } catch (err) { setSubmitError(err.message) }
    finally { setSubmitting(false) }
  }

  // Row-level validation preview (client-side)
  const custNames = new Set(customers.map(c => c.name.toLowerCase()))
  const svcNames  = new Set(services.map(s => s.name.toLowerCase()))

  function validateRow(row) {
    const errs = []
    if (!custNames.has((row.customer_name || '').toLowerCase().trim())) errs.push(`Customer "${row.customer_name}" not found`)
    if (!svcNames.has((row.service_name  || '').toLowerCase().trim())) errs.push(`Service "${row.service_name}" not found`)
    if (!row.amount || isNaN(Number(row.amount)) || Number(row.amount) <= 0) errs.push(`Invalid amount`)
    if (!row.due_date || !/^\d{4}-\d{2}-\d{2}$/.test(row.due_date.trim())) errs.push(`Invalid date (use YYYY-MM-DD)`)
    return errs
  }

  const validatedRows = previewRows?.map(r => ({ ...r, _errors: validateRow(r) })) ?? []
  const errorCount = validatedRows.filter(r => r._errors.length > 0).length
  const validCount = validatedRows.length - errorCount

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <div className="card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-800">How to import</h2>
        <ol className="text-sm text-gray-600 space-y-1.5 list-decimal list-inside">
          <li>Download the template below — it includes your current customer and service names as reference</li>
          <li>Fill in one row per transaction: customer name, service name, amount, due date (YYYY-MM-DD)</li>
          <li>Upload the filled CSV — you'll see a preview with any errors highlighted</li>
          <li>Click Import to create all valid transactions at once</li>
        </ol>

        <div className="flex flex-wrap gap-3 pt-1">
          <button
            className="btn-secondary text-sm flex items-center gap-1.5"
            onClick={() => downloadTemplate(customers, services)}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/>
            </svg>
            Download Template
          </button>

          <label className="btn-primary text-sm flex items-center gap-1.5 cursor-pointer">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2M16 8l-4-4-4 4M12 4v12"/>
            </svg>
            {fileName ? `Change file` : 'Upload CSV'}
            <input id="csv-upload" type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
          </label>

          {fileName && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="font-medium text-gray-800">{fileName}</span>
              <button onClick={clearFile} className="text-gray-400 hover:text-red-500 transition-colors text-xs">✕</button>
            </div>
          )}
        </div>
      </div>

      {/* Valid values reference */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Valid Customer Names</p>
          <div className="flex flex-wrap gap-1.5">
            {customers.map(c => (
              <span key={c.id} className="inline-flex items-center rounded-full bg-gray-100 text-gray-700 text-xs px-2.5 py-1">{c.name}</span>
            ))}
          </div>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Valid Service Names</p>
          <div className="flex flex-wrap gap-1.5">
            {services.map(s => (
              <span key={s.id} className="inline-flex items-center rounded-full bg-gray-100 text-gray-700 text-xs px-2.5 py-1">{s.name}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Parse error */}
      {parseError && <ErrorMessage message={parseError} />}

      {/* Preview table */}
      {validatedRows.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">
                Preview — {validatedRows.length} row{validatedRows.length !== 1 ? 's' : ''}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {validCount > 0 && <span className="text-green-600 font-medium">{validCount} valid</span>}
                {validCount > 0 && errorCount > 0 && ' · '}
                {errorCount > 0 && <span className="text-red-600 font-medium">{errorCount} with errors (will be skipped)</span>}
              </p>
            </div>
            {validCount > 0 && (
              <button
                className="btn-primary flex items-center gap-1.5"
                onClick={handleImport}
                disabled={submitting}
              >
                {submitting ? 'Importing…' : `Import ${validCount} transaction${validCount !== 1 ? 's' : ''}`}
              </button>
            )}
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-6">#</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Service</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Due Date</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {validatedRows.map((row, i) => {
                    const hasErr = row._errors.length > 0
                    return (
                      <tr key={i} className={hasErr ? 'bg-red-50' : 'hover:bg-gray-50'}>
                        <td className="px-3 py-2 text-gray-400 text-xs">{i + 2}</td>
                        <td className={`px-3 py-2 ${!custNames.has((row.customer_name||'').toLowerCase().trim()) ? 'text-red-600 font-medium' : 'text-gray-800'}`}>{row.customer_name || '—'}</td>
                        <td className={`px-3 py-2 ${!svcNames.has((row.service_name||'').toLowerCase().trim()) ? 'text-red-600 font-medium' : 'text-gray-800'}`}>{row.service_name || '—'}</td>
                        <td className={`px-3 py-2 ${!row.amount || isNaN(Number(row.amount)) ? 'text-red-600 font-medium' : 'text-gray-800'}`}>{row.amount || '—'}</td>
                        <td className={`px-3 py-2 ${!row.due_date || !/^\d{4}-\d{2}-\d{2}$/.test((row.due_date||'').trim()) ? 'text-red-600 font-medium' : 'text-gray-800'}`}>{row.due_date || '—'}</td>
                        <td className="px-3 py-2">
                          {hasErr ? (
                            <span className="inline-flex items-center gap-1 text-xs text-red-600 font-medium">
                              ✕ {row._errors[0]}{row._errors.length > 1 ? ` +${row._errors.length - 1} more` : ''}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">✓ Ready</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Submit error */}
      {submitError && <ErrorMessage message={submitError} />}

      {/* Result */}
      {result && (
        <div className="space-y-2">
          {result.created > 0 && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              ✓ Successfully created <span className="font-semibold">{result.created}</span> transaction{result.created !== 1 ? 's' : ''}.
            </div>
          )}
          {result.errors?.length > 0 && (
            <div className="card p-4 space-y-1">
              <p className="text-sm font-semibold text-red-600">{result.errors.length} row{result.errors.length !== 1 ? 's' : ''} skipped:</p>
              {result.errors.map((e, i) => (
                <p key={i} className="text-xs text-red-500">Row {e.row}: {e.reason}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

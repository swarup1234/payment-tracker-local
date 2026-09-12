/**
 * Metric summary card used on the Dashboard.
 * @param {{ label: string, value: string, hint?: string, accent?: 'red'|'yellow'|'green'|'blue' }} props
 */
export default function SummaryCard({ label, value, hint, accent = 'blue' }) {
  const border = {
    blue:   'border-l-accent-500',
    red:    'border-l-red-500',
    yellow: 'border-l-yellow-400',
    green:  'border-l-green-500',
  }[accent] ?? 'border-l-accent-500'

  const valueColor = {
    blue:   'text-accent-700',
    red:    'text-red-600',
    yellow: 'text-yellow-600',
    green:  'text-green-600',
  }[accent] ?? 'text-accent-700'

  return (
    <div className={`card border-l-4 ${border} px-5 py-4`}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${valueColor}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  )
}

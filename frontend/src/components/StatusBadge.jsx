const styles = {
  pending:   'bg-yellow-100 text-yellow-800',
  overdue:   'bg-red-100 text-red-700',
  paid:      'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
}

/**
 * @param {{ status: 'pending'|'overdue'|'paid'|'cancelled' }} props
 */
export default function StatusBadge({ status }) {
  const classes = styles[status] ?? styles.cancelled
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${classes}`}>
      {status}
    </span>
  )
}

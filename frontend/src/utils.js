/** Format a number as Indian Rupees */
export function formatCurrency(amount) {
  if (amount == null) return '—'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(amount))
}

/** Format an ISO date string to a readable date */
export function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/** Capitalise first letter */
export function capitalise(str) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/** Sum an array of objects by a numeric key */
export function sumBy(arr, key) {
  return (arr || []).reduce((acc, item) => acc + Number(item[key] || 0), 0)
}

/** Return items from this calendar month */
export function filterThisMonth(arr, dateKey) {
  const now = new Date()
  return (arr || []).filter((item) => {
    const d = new Date(item[dateKey])
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  })
}

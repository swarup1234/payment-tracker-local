export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-4 border-gray-200 border-t-accent-500 rounded-full animate-spin" />
    </div>
  )
}

export function ErrorMessage({ message }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {message || 'Something went wrong. Please try again.'}
    </div>
  )
}

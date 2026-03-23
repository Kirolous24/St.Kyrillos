'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function ClearLogsButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleClear() {
    if (!confirm('Clear all activity logs? This cannot be undone.')) return
    setLoading(true)
    try {
      await fetch('/api/activity-logs', { method: 'DELETE' })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClear}
      disabled={loading}
      className="text-xs text-red-400 hover:text-red-600 border border-red-200 hover:border-red-400 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-40"
    >
      {loading ? 'Clearing…' : 'Clear logs'}
    </button>
  )
}

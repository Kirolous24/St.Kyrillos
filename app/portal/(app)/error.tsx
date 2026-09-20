'use client'

import { useEffect } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { PageHeader, Card, buttonClass } from '@/components/portal/ui'

/**
 * Catches a render-time throw anywhere under this segment — a page's direct
 * Prisma call (e.g. admin/audit) hitting a transient Neon blip, most often —
 * so the portal shows a styled retry instead of Next's generic error screen.
 *
 * Error boundaries only catch errors below their own layout, so this does not
 * cover a throw in `(app)/layout.tsx` itself; see the sibling `app/portal/error.tsx`
 * for that.
 */
export default function PortalSegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[portal]', error)
  }, [error])

  return (
    <>
      <PageHeader title="Something went wrong" subtitle="This page hit a snag loading." icon={<AlertTriangle className="h-5 w-5" />} />
      <Card>
        <p className="mb-4 text-[13px] leading-relaxed text-parch-600">
          This is usually temporary — a hiccup reaching the database. Try again, or head back to the dashboard.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => reset()} className={buttonClass('primary')}>
            <RotateCcw className="h-4 w-4" aria-hidden />
            Try again
          </button>
          <a href="/portal" className={buttonClass('secondary')}>
            Back to dashboard
          </a>
        </div>
      </Card>
    </>
  )
}

'use client'

import { useEffect } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

/**
 * An error boundary only catches throws below its own layout, never inside
 * it — so `(app)/error.tsx` cannot catch a throw in `(app)/layout.tsx`
 * itself, which runs `requirePortalUser()` and a Prisma call
 * (`nextBirthdayForTopbar`) on every portal page. This one segment up does.
 * No `<Shell>` here (the thing that failed may be what builds it), so it's a
 * small standalone card in the portal's own colors rather than the design kit.
 */
export default function PortalError({
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
    <div className="flex min-h-screen items-center justify-center bg-parch-100 px-4">
      <div className="w-full max-w-sm rounded-[16px] border border-parch-200 border-l-[3px] border-l-brand-gold bg-parch-50 p-6 text-center shadow-card">
        <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-brand-gold-dark" aria-hidden />
        <h1 className="font-serif text-[17px] font-bold text-parch-900">Something went wrong</h1>
        <p className="mx-auto mt-1.5 max-w-xs text-[12.5px] leading-relaxed text-parch-500">
          The portal hit a snag loading — usually just a hiccup reaching the database. Try again in a moment.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => reset()}
            className="portal-hover-lift inline-flex items-center gap-1.5 rounded-[10px] bg-[linear-gradient(120deg,#6F1D1B_0%,#7A2A2A_50%,#C89B3C_100%)] px-5 py-2.5 text-[12px] font-bold text-white shadow-[0_4px_12px_rgba(90,31,31,.28)] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_18px_rgba(90,31,31,.35)]"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            Try again
          </button>
          <a
            href="/portal/login"
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-parch-200 bg-parch-50 px-5 py-2.5 text-[12px] font-bold text-parch-900 transition-colors hover:border-brand-gold/60 hover:bg-brand-wash"
          >
            Back to sign in
          </a>
        </div>
      </div>
    </div>
  )
}

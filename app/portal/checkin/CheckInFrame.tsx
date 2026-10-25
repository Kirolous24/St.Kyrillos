/* eslint-disable @next/next/no-img-element */
import { CHURCH_INFO } from '@/lib/constants'

/**
 * The frame of the Fellowship check-in pages (2026-10-24): outside the portal's
 * menus, since whoever opens them has not signed in. A phone page first.
 */
export function CheckInFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-parch-100 font-body text-parch-900">
      <div className="mx-auto max-w-[480px] px-4 pb-10 pt-6">
        <div className="mb-5 flex items-center gap-2.5">
          <img src="/images/coptic-cross.png" alt="" className="h-9 w-9" />
          <div>
            <p className="font-serif text-[15px] font-bold leading-tight text-brand-900">{CHURCH_INFO.name}</p>
            <p className="text-[11px] font-bold uppercase tracking-[1.2px] text-brand-gold-dark">Fellowship check-in</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}

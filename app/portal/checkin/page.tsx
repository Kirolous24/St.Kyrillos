import type { Metadata } from 'next'
import { CheckInFrame } from './CheckInFrame'
import { TypedCode } from './TypedCode'

export const metadata: Metadata = { title: 'Check in', robots: { index: false, follow: false } }

/** For a camera that will not focus: the short code under the QR (2026-10-24). */
export default function TypedCheckInPage() {
  return (
    <CheckInFrame>
      <div className="rounded-[18px] border border-parch-200 bg-parch-50 p-5 shadow-card">
        <h1 className="mb-1 font-serif text-[20px] font-bold text-parch-900">Type the code</h1>
        <p className="mb-4 text-[13px] text-parch-600">The eight letters and numbers under the QR code on the screen.</p>
        <TypedCode />
      </div>
    </CheckInFrame>
  )
}

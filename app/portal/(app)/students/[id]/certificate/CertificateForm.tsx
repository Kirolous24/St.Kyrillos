'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Printer } from 'lucide-react'
import { Card, buttonClass, inputClass, selectClass } from '@/components/portal/ui'
import { CERTIFICATE_OCCASIONS, type CertificateOccasion } from '@/lib/portal/certificates'
import { cn } from '@/lib/utils'

/**
 * The controls above the certificate. They drive the URL rather than local
 * state, so a servant can bookmark or re-open the exact certificate they made,
 * and the sheet below is plain server-rendered markup that prints cleanly.
 */
export function CertificateForm({
  studentId,
  occasion,
  period,
  presentedBy,
}: {
  studentId: string
  occasion: CertificateOccasion
  period: string
  presentedBy: string
}) {
  const router = useRouter()
  const params = useSearchParams()

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    router.replace(`/portal/students/${studentId}/certificate?${next.toString()}`)
  }

  return (
    <Card className="mb-5 print:hidden" bodyClassName="p-3.5 sm:p-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block min-w-[12rem] flex-1">
          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">For</span>
          <select
            value={occasion}
            onChange={(e) => update('occasion', e.target.value)}
            className={cn(selectClass, 'min-h-[40px]')}
            aria-label="What the certificate is for"
          >
            {CERTIFICATE_OCCASIONS.map((o) => (
              <option key={o.key} value={o.key}>{o.title}</option>
            ))}
          </select>
        </label>

        <label className="block min-w-[10rem] flex-1">
          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">Period</span>
          <input
            defaultValue={period}
            onBlur={(e) => update('period', e.target.value)}
            className={cn(inputClass, 'min-h-[40px]')}
            maxLength={60}
            aria-label="Period the certificate covers"
          />
        </label>

        <label className="block min-w-[10rem] flex-1">
          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">Presented by</span>
          <input
            defaultValue={presentedBy}
            onBlur={(e) => update('by', e.target.value)}
            className={cn(inputClass, 'min-h-[40px]')}
            maxLength={60}
            aria-label="Who presents the certificate"
          />
        </label>

        <button type="button" onClick={() => window.print()} className={cn(buttonClass('primary'), 'min-h-[40px]')}>
          <Printer className="h-4 w-4" aria-hidden /> Print certificate
        </button>
      </div>
      <p className="mt-2 text-[11px] text-parch-500">
        Fields apply when you click away. Print in landscape for the best fit.
      </p>
    </Card>
  )
}

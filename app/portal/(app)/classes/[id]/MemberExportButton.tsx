'use client'

import { useState, useTransition } from 'react'
import { Download } from 'lucide-react'
import { exportMembersCsv } from '@/lib/portal/actions/fellowship'
import { buttonClass } from '@/components/portal/ui'

/** Hand the browser a CSV without a round trip through a URL. */
function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** A Fellowship meeting's members as a spreadsheet (2026-10-24). */
export function MemberExportButton({ classId }: { classId: string }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  return (
    <>
      <button
        type="button"
        disabled={pending}
        className={buttonClass('secondary')}
        onClick={() =>
          startTransition(async () => {
            setError('')
            const result = await exportMembersCsv(classId)
            if (!result.ok) return setError(result.error)
            downloadCsv(result.data!.filename, result.data!.csv)
          })
        }
      >
        <Download className="h-4 w-4" aria-hidden /> {pending ? 'Exporting…' : 'Export members'}
      </button>
      {error && (
        <span role="alert" className="text-[12px] font-semibold text-[#B91C1C]">
          {error}
        </span>
      )}
    </>
  )
}

'use client'

import { useState, useTransition } from 'react'
import { Download } from 'lucide-react'
import { exportStudentsCsv, studentImportTemplateCsv } from '@/lib/portal/actions/data-tools'
import { buttonClass } from '@/components/portal/ui'

/** Hand the browser a CSV without a round trip through a URL. */
function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * The prototype had Export CSV on the servant's own Students page. The port
 * moved it to the admin-only Data & Backup screen, so a servant could not get
 * their own roster as a spreadsheet at all.
 */
export function RosterExportButton({ classId }: { classId: string }) {
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
            const result = await exportStudentsCsv(classId)
            if (!result.ok) return setError(result.error)
            downloadCsv(result.data!.filename, result.data!.csv)
          })
        }
      >
        <Download className="h-4 w-4" aria-hidden /> {pending ? 'Exporting…' : 'Export CSV'}
      </button>
      {/* F0057 — a servant with thirty new children in September can fill the
          sheet in themselves and hand it to the office. Uploading it stays with
          the admin: an import creates accounts, sets PINs and can move a child
          out of another servant's class. The template holds no church data. */}
      <button
        type="button"
        disabled={pending}
        className={buttonClass('secondary')}
        title="A blank sheet with the right column headings. Fill it in and send it to the office to be imported."
        onClick={() =>
          startTransition(async () => {
            setError('')
            const result = await studentImportTemplateCsv()
            if (!result.ok) return setError(result.error)
            downloadCsv(result.data!.filename, result.data!.csv)
          })
        }
      >
        <Download className="h-4 w-4" aria-hidden /> Blank sheet
      </button>
      {error && <span role="alert" className="text-[12px] font-semibold text-red-600">{error}</span>}
    </>
  )
}

import { formatLongDate } from '@/lib/portal/format'
import { todayInNewYork } from '@/lib/portal/dates'
import { CHURCH_INFO } from '@/lib/constants'

/**
 * Print-only masthead for a report sheet.
 *
 * The prototype's printed church report opened with a letterhead, the period it
 * covered and the date it was printed (OG L7648-7654). The port's Print button
 * was `window.print()` and nothing else, so a sheet handed to a priest or filed
 * for the year carried no indication of what it was or when it was run.
 */
export function ReportLetterhead({
  title,
  period,
  session,
}: {
  title: string
  period: string
  session?: string
}) {
  return (
    <header className="mb-4 hidden border-b-2 border-brand-950 pb-3 text-center print:block">
      <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-parch-500">
        {CHURCH_INFO.fullName} · {CHURCH_INFO.location}
      </p>
      <p className="mt-1 font-serif text-[18px] font-bold leading-tight text-brand-950">{title}</p>
      <p className="mt-0.5 text-[11px] text-parch-600">
        {period}
        {session ? ` · ${session}` : ''}
      </p>
      <p className="mt-0.5 text-[10px] text-parch-500">Printed {formatLongDate(todayInNewYork())}</p>
    </header>
  )
}

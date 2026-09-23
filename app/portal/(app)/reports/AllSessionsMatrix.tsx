import { TableWrap, Th, Td, EmptyState } from '@/components/portal/ui'
import { attendanceBand, STATUS_MARK, type MultiSessionMatrix } from '@/lib/portal/reports'
import { CLASS_ACCENTS } from '@/lib/portal/accents'
import { cn } from '@/lib/utils'

const MARK_STYLE = {
  PRESENT: 'bg-[#DCFCE7] text-[#16A34A]',
  EXCUSED: 'bg-[#FEF3C7] text-[#D97706]',
  ABSENT: 'bg-[#FEE2E2] text-[#DC2626]',
} as const

const MARK_TITLE = { PRESENT: 'Present', EXCUSED: 'Excused', ABSENT: 'Absent' } as const

function rateTone(rate: number | null) {
  const band = attendanceBand(rate)
  if (band === 'excellent') return 'text-[#16A34A]'
  if (band === 'good') return 'text-[#D97706]'
  if (band === 'low') return 'text-[#DC2626]'
  return 'text-parch-400'
}

const STICKY = 'sticky left-0 z-10 bg-parch-50'

/**
 * The prototype's month grid: two header rows — one spanning each week, one
 * naming each session inside it — and a cell per student per session per week
 * (OG renderAttendanceMonthTable, L8938-9017).
 *
 * The port could only show one session at a time, so reading a month properly
 * meant running and printing the report six times. The legend under the table
 * is what makes the abbreviations usable on paper.
 */
export function AllSessionsMatrix({
  matrix,
  blank = false,
}: {
  matrix: MultiSessionMatrix
  blank?: boolean
}) {
  if (matrix.rows.length === 0) {
    return <EmptyState title="No students in this class yet" hint="Add students and their attendance appears here." />
  }
  if (matrix.columns.length === 0) {
    return (
      <EmptyState
        title={`Nothing recorded in ${matrix.label}`}
        hint="Once any session is taken this month, its column appears here."
      />
    )
  }

  const legend = matrix.columns.filter(
    (c, i) => matrix.columns.findIndex((x) => x.sessionKey === c.sessionKey) === i,
  )

  return (
    <>
      <TableWrap>
        <thead>
          <tr>
            <Th rowSpan={2} className={cn(STICKY, 'min-w-[9rem] text-left align-bottom')}>Student</Th>
            {matrix.weeks.map((w) => (
              <Th
                key={w.week}
                colSpan={w.span}
                align="center"
                className="border-l border-parch-200 bg-brand-wash/60 px-1.5 text-[10.5px] font-bold text-brand-800"
              >
                {w.label}
              </Th>
            ))}
            {!blank && (
              <>
                <Th rowSpan={2} align="center" className="px-2 align-bottom">P</Th>
                <Th rowSpan={2} align="center" className="px-2 align-bottom">E</Th>
                <Th rowSpan={2} align="right" className="align-bottom">Rate</Th>
              </>
            )}
          </tr>
          <tr>
            {matrix.columns.map((c, i) => (
              <Th
                key={`${c.week}-${c.sessionKey}`}
                align="center"
                className={cn(
                  'px-1.5 text-[10px] font-bold text-parch-500',
                  matrix.columns[i - 1]?.week !== c.week && 'border-l border-parch-200',
                )}
              >
                <abbr title={c.label} className="no-underline">{c.abbr}</abbr>
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map((r) => (
            <tr key={r.studentId} className="even:bg-parch-100/30">
              <Td className={cn(STICKY, 'whitespace-nowrap text-[12px] font-semibold text-parch-900')}>{r.name}</Td>
              {r.marks.map((mark, i) => (
                <Td
                  key={`${matrix.columns[i]!.week}-${matrix.columns[i]!.sessionKey}`}
                  align="center"
                  className={cn('px-1.5', matrix.columns[i - 1]?.week !== matrix.columns[i]!.week && 'border-l border-parch-200')}
                >
                  {blank || !mark ? (
                    <span aria-hidden className="inline-block h-6 w-6 rounded-[6px] border border-parch-300" />
                  ) : (
                    <span
                      className={cn('inline-grid h-6 w-6 place-items-center rounded-[6px] text-[11px] font-bold', MARK_STYLE[mark])}
                      title={MARK_TITLE[mark]}
                    >
                      {STATUS_MARK[mark]}
                    </span>
                  )}
                </Td>
              ))}
              {!blank && (
                <>
                  <Td align="center" className="text-[12px] font-bold tabular-nums text-[#16A34A]">{r.present}</Td>
                  <Td align="center" className="text-[12px] tabular-nums text-parch-500">{r.excused}</Td>
                  <Td align="right" className={cn('text-[12px] font-bold tabular-nums', rateTone(r.rate))}>
                    {r.rate === null ? '—' : `${r.rate}%`}
                  </Td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </TableWrap>

      {/* F0440 — one coloured pill per session (OG L6273, palette L6230-6232).
          The grid heads its columns with three-letter abbreviations, and a flat
          list where every abbreviation is the same brand red gives a servant
          holding a printed month nothing to match a column against. The label
          stays outside the pill in ordinary ink, so the abbr-to-session mapping
          survives a printer that drops backgrounds. */}
      <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-parch-600">
        {legend.map((c, i) => (
          <li key={c.sessionKey} className="flex items-center gap-1.5">
            <span
              data-session-pill={c.sessionKey}
              className="rounded-[20px] px-2.5 py-[3px] text-[10.5px] font-bold text-white [print-color-adjust:exact]"
              style={{ background: CLASS_ACCENTS[i % CLASS_ACCENTS.length] }}
            >
              {c.abbr}
            </span>
            {c.label}
          </li>
        ))}
      </ul>
    </>
  )
}

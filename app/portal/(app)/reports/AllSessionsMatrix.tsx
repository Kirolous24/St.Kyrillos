import { TableWrap, Th, Td, EmptyState } from '@/components/portal/ui'
import { attendanceBand, GRID_MARK, sessionColor, type MultiSessionMatrix } from '@/lib/portal/reports'
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
        title="No sessions set up yet"
        hint="An administrator adds the weekly sessions; the month grid appears once they exist."
      />
    )
  }

  // One entry per session, in the church's own order — which is also the order
  // the prototype's palette was applied in.
  const legend = matrix.columns.filter(
    (c, i) => matrix.columns.findIndex((x) => x.sessionKey === c.sessionKey) === i,
  )
  const colorOf = new Map(legend.map((c, i) => [c.sessionKey, sessionColor(i)]))

  return (
    <>
      {/* F0440 — one coloured pill per session, above the grid as the prototype
          had it (OG L6273, palette L6230). Thirty abbreviated columns in one
          ink give a servant holding a printed month nothing to match against.
          The abbreviation rides inside the pill, which the prototype's did not:
          its pills named the session and the grid headed the column "BS", and
          nothing on the page joined the two. */}
      <ul className="mb-3.5 flex flex-wrap items-center gap-2 text-[11px]">
        {legend.map((c) => (
          <li
            key={c.sessionKey}
            data-session-pill={c.sessionKey}
            className="flex items-center gap-1.5 rounded-[20px] px-3 py-[5px] text-[11.5px] font-bold text-white [print-color-adjust:exact]"
            style={{ background: colorOf.get(c.sessionKey) }}
          >
            <span className="rounded-[4px] bg-white/25 px-1.5 py-px text-[10px] tabular-nums">{c.abbr}</span>
            {c.label}
          </li>
        ))}
      </ul>

      {/* The prototype's legend, verbatim (OG L6277). */}
      <p className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-parch-600">
        <span><span className="font-bold text-[#16A34A]">&#10003;</span> Present</span>
        <span><span className="font-bold text-[#D97706]">E</span> Excused</span>
        <span><span className="font-bold text-[#DC2626]">&#10007;</span> Absent</span>
        <span><span className="font-bold text-parch-400">&mdash;</span> Not held that week</span>
      </p>

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
                <abbr
                  title={c.label}
                  className="no-underline"
                  style={{ color: colorOf.get(c.sessionKey) }}
                >
                  {c.abbr}
                </abbr>
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map((r) => (
            <tr key={r.studentId} className="even:bg-parch-100/30">
              <Td className={cn(STICKY, 'whitespace-nowrap text-[12px] font-semibold text-parch-900')}>{r.name}</Td>
              {r.marks.map((mark, i) => {
                const col = matrix.columns[i]!
                return (
                  <Td
                    key={`${col.week}-${col.sessionKey}`}
                    align="center"
                    className={cn('px-1.5', matrix.columns[i - 1]?.week !== col.week && 'border-l border-parch-200')}
                  >
                    {!col.held ? (
                      // Nobody took this session that week. The prototype's dash
                      // — the one thing that tells a servant "we did not meet"
                      // apart from "we met and nobody marked you".
                      <span className="text-parch-300" title={`${col.label} — not held that week`}>
                        &mdash;
                      </span>
                    ) : blank || !mark ? (
                      <span aria-hidden className="inline-block h-6 w-6 rounded-[6px] border border-parch-300" />
                    ) : (
                      <span
                        className={cn('inline-grid h-6 w-6 place-items-center rounded-[6px] text-[11px] font-bold', MARK_STYLE[mark])}
                        title={MARK_TITLE[mark]}
                      >
                        {GRID_MARK[mark]}
                      </span>
                    )}
                  </Td>
                )
              })}
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

    </>
  )
}

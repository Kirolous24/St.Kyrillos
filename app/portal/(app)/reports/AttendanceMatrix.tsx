import { TableWrap, Th, Td, Badge, EmptyState } from '@/components/portal/ui'
import { toUTCDate } from '@/lib/portal/dates'
import { attendanceBand, BAND_LABEL, STATUS_MARK, type MonthMatrix } from '@/lib/portal/reports'
import { cn } from '@/lib/utils'

const DAY_INITIAL = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

/**
 * The prototype's cell colours: present green, absent red, and — since it has
 * no excused state — amber borrowed from its "warn" pair for excused.
 */
const MARK_STYLE = {
  PRESENT: 'bg-[#DCFCE7] text-[#16A34A]',
  EXCUSED: 'bg-[#FEF3C7] text-[#D97706]',
  ABSENT: 'bg-[#FEE2E2] text-[#DC2626]',
} as const

const MARK_TITLE = {
  PRESENT: 'Present',
  EXCUSED: 'Excused',
  ABSENT: 'Absent',
} as const

function rateTone(rate: number | null) {
  const band = attendanceBand(rate)
  if (band === 'excellent') return 'text-[#16A34A]'
  if (band === 'good') return 'text-[#D97706]'
  if (band === 'low') return 'text-[#DC2626]'
  return 'text-parch-400'
}

/** The sticky first column: cream so rows slide underneath it cleanly. */
const STICKY = 'sticky left-0 z-10 bg-parch-50'

/**
 * Students down the side, dates across. On the blank form the cells are empty
 * boxes a servant can tick on paper, so the columns are the month's Sundays.
 */
export function AttendanceMatrix({
  matrix,
  blank = false,
}: {
  matrix: MonthMatrix
  blank?: boolean
}) {
  if (matrix.rows.length === 0) {
    return <EmptyState title="No students in this class yet" hint="Add students to the class and their attendance will appear here." />
  }

  return (
    <TableWrap>
      <thead>
        <tr>
          <Th className={cn(STICKY, 'min-w-[9rem] text-left')}>Student</Th>
          {matrix.dates.map((d) => {
            const day = toUTCDate(d)
            return (
              <Th key={d} align="center" className="bg-brand-wash/60 px-1.5">
                <span className="block text-[10px] font-bold leading-none text-parch-400">
                  {DAY_INITIAL[day.getUTCDay()]}
                </span>
                <span className="block text-[13px] font-bold leading-tight tabular-nums text-brand-800">
                  {day.getUTCDate()}
                </span>
              </Th>
            )
          })}
          {!blank && (
            <>
              <Th align="center" className="px-2">P</Th>
              <Th align="center" className="px-2">E</Th>
              <Th align="center" className="px-2">A</Th>
              <Th align="right">Rate</Th>
            </>
          )}
        </tr>
      </thead>
      <tbody>
        {matrix.rows.map((r) => (
          <tr key={r.studentId} className="even:bg-parch-100/30">
            <Td className={cn(STICKY, 'whitespace-nowrap text-[12px] font-semibold text-parch-900')}>{r.name}</Td>
            {r.marks.map((mark, i) => (
              <Td key={matrix.dates[i]} align="center" className="px-1.5">
                {blank || !mark ? (
                  <span
                    aria-hidden
                    className="inline-block h-6 w-6 rounded-[6px] border border-parch-300"
                    title={blank ? undefined : 'Not marked'}
                  />
                ) : (
                  <span
                    className={cn(
                      'inline-grid h-6 w-6 place-items-center rounded-[6px] text-[11px] font-bold',
                      MARK_STYLE[mark],
                    )}
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
                <Td align="center" className="text-[12px] tabular-nums text-parch-500">{r.absent}</Td>
                <Td align="right" className={cn('text-[12px] font-bold tabular-nums', rateTone(r.rate))}>
                  {r.rate === null ? '—' : `${r.rate}%`}
                </Td>
              </>
            )}
          </tr>
        ))}
      </tbody>
      {!blank && (
        <tfoot>
          <tr className="border-t-2 border-brand-gold/40">
            <Td className={cn(STICKY, 'bg-brand-wash font-serif text-[12.5px] font-bold text-brand-950')}>
              Class total
            </Td>
            {matrix.dates.map((d) => (
              <Td key={d} className="bg-brand-wash" />
            ))}
            <Td align="center" className="bg-brand-wash text-[12px] font-bold tabular-nums text-parch-900">
              {matrix.totals.present}
            </Td>
            <Td align="center" className="bg-brand-wash text-[12px] font-bold tabular-nums text-parch-900">
              {matrix.totals.excused}
            </Td>
            <Td align="center" className="bg-brand-wash text-[12px] font-bold tabular-nums text-parch-900">
              {matrix.totals.absent}
            </Td>
            <Td align="right" className="bg-brand-wash">
              {matrix.totals.rate === null ? (
                <span className="text-parch-400">—</span>
              ) : (
                <Badge
                  tone={
                    attendanceBand(matrix.totals.rate) === 'excellent'
                      ? 'good'
                      : attendanceBand(matrix.totals.rate) === 'good'
                        ? 'warn'
                        : 'bad'
                  }
                >
                  {matrix.totals.rate}% · {BAND_LABEL[attendanceBand(matrix.totals.rate)!]}
                </Badge>
              )}
            </Td>
          </tr>
        </tfoot>
      )}
    </TableWrap>
  )
}

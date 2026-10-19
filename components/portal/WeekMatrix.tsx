import Link from './Link'
import { TableWrap, Th, Td, EmptyState } from './ui'
import type { SessionWeekRow } from '@/lib/portal/qr'
import { formatShortDate } from '@/lib/portal/format'
import { cn } from '@/lib/utils'

const STICKY = 'sticky left-0 z-10 bg-parch-50'

export interface WeekMatrixRow {
  id: string
  name: string
  href?: string
  /** One per meeting this person was expected at; a held meeting with no cell is left blank. */
  cells: SessionWeekRow[]
}

/**
 * People down the side, one group per week across the top with a column per
 * meeting inside it — the prototype's two-header-row grid (OG L8080-8106).
 *
 * A rate says someone attended 3 of 5. This says which two they missed, which
 * is the question a coordinator is actually asking. Shared by the servants'
 * weekly report and, since 2026-10-19, the children's.
 */
export function WeekMatrix({
  weeks,
  activities,
  rows,
  personLabel,
  legend = '✓ attended · E excused (left out of the rate) · ✗ absent · — nobody marked that week.',
}: {
  weeks: string[]
  activities: Array<{ key: string; label: string; abbr: string }>
  rows: WeekMatrixRow[]
  personLabel: string
  legend?: string
}) {
  const columns = weeks.flatMap((week) =>
    activities
      .filter((a) => rows.some((r) => r.cells.some((c) => c.week === week && c.sessionKey === a.key)))
      .map((a) => ({ week, key: a.key, label: a.label, abbr: a.abbr })),
  )

  if (columns.length === 0) {
    return <EmptyState title="Nothing recorded in this range" hint="Weeks appear here once someone marks them." />
  }

  const weekHeaders = weeks
    .map((week) => ({ week, span: columns.filter((c) => c.week === week).length }))
    .filter((w) => w.span > 0)

  return (
    <>
      <TableWrap>
        <thead>
          <tr>
            <Th rowSpan={2} className={cn(STICKY, 'min-w-[9rem] align-bottom')}>{personLabel}</Th>
            {weekHeaders.map((w) => (
              <Th
                key={w.week}
                colSpan={w.span}
                align="center"
                className="border-l-2 border-l-brand-gold/30 bg-brand-wash text-[10px] text-brand-800"
              >
                {formatShortDate(w.week)}
              </Th>
            ))}
          </tr>
          <tr>
            {columns.map((c, i) => (
              <Th
                key={`${c.week}-${c.key}`}
                align="center"
                className={cn('px-1.5 text-[9.5px] text-parch-500', columns[i - 1]?.week !== c.week && 'border-l-2 border-l-brand-gold/30')}
              >
                <abbr title={c.label} className="no-underline">{c.abbr}</abbr>
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const byKey = new Map(r.cells.map((c) => [`${c.week}|${c.sessionKey}`, c.status]))
            return (
              <tr key={r.id}>
                <Td className={cn(STICKY, 'whitespace-nowrap text-[12.5px] font-bold text-parch-900')}>
                  {r.href ? (
                    <Link href={r.href} className="hover:text-brand-800">{r.name}</Link>
                  ) : (
                    r.name
                  )}
                </Td>
                {columns.map((c, i) => {
                  const key = `${c.week}|${c.key}`
                  const status = byKey.get(key) ?? null
                  return (
                    <Td
                      key={`${c.week}-${c.key}`}
                      align="center"
                      className={cn('px-1.5', columns[i - 1]?.week !== c.week && 'border-l-2 border-l-brand-gold/30')}
                    >
                      {!byKey.has(key) ? (
                        <span className="sr-only">Not expected</span>
                      ) : status === 'PRESENT' ? (
                        <span className="text-[14px] font-bold text-[#16A34A]" title="Attended">✓</span>
                      ) : status === 'EXCUSED' ? (
                        <span className="text-[11px] font-bold text-[#B45309]" title="Excused">E</span>
                      ) : status === 'ABSENT' ? (
                        <span className="text-[14px] font-bold text-[#DC2626]" title="Absent">✗</span>
                      ) : (
                        <span className="text-[#D1CBBE]" title="Not marked">—</span>
                      )}
                    </Td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </TableWrap>
      <p className="pt-3 text-[11px] text-parch-500">{legend}</p>
    </>
  )
}

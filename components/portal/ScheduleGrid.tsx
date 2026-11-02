import Link from '@/components/portal/Link'
import { formatMonthDay } from '@/lib/portal/format'
import { rotationRoleShort, type RotationRole } from '@/lib/portal/rotation'
import { cn } from '@/lib/utils'

/**
 * A class's Sundays down the side and its parts across the top (2026-11-01):
 * the Calendar tab's month or semester, and a rotation before it is saved.
 * No hooks, so the server page and the rotation panel both draw it.
 */

export interface GridRow {
  /** Its week's Monday, as the Schedule stores it. */
  weekStart: string
  sunday: string
  /** The week on the Schedule, when the date should open it. */
  href?: string
  past?: boolean
  /** The coming Sunday. */
  next?: boolean
}

export interface GridCell {
  name: string
  /** `new`: what a rotation would put there. `done`: its servant marked it ready. */
  tone?: 'new' | 'done'
}

/** The key a cell is found under: `${weekStart}|${role}`. */
export const gridKey = (weekStart: string, role: RotationRole) => `${weekStart}|${role}`

export function ScheduleGrid({
  rows,
  roles,
  cells,
  testId,
}: {
  rows: readonly GridRow[]
  roles: readonly RotationRole[]
  cells: Readonly<Record<string, GridCell>>
  testId?: string
}) {
  return (
    <div className="overflow-x-auto rounded-[14px] border-[1.5px] border-parch-200 bg-parch-50" data-testid={testId}>
      <table className="w-full border-collapse text-[12px]" style={{ minWidth: `${96 + roles.length * 92}px` }}>
        <thead>
          <tr className="bg-[#F3EFE6]">
            <th scope="col" className="sticky left-0 z-[1] bg-[#F3EFE6] px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.6px] text-brand-800">
              Sunday
            </th>
            {roles.map((role) => (
              <th key={role} scope="col" className="px-2 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.6px] text-brand-800">
                {rotationRoleShort(role)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.weekStart} className={cn(row.next && 'bg-brand-wash/60')} data-week={row.weekStart}>
              <th
                scope="row"
                className={cn(
                  'sticky left-0 z-[1] whitespace-nowrap border-t border-[#F0EEE8] px-3 py-2 text-left text-[12px] font-bold',
                  row.next ? 'bg-[#FBF3E2] text-brand-800' : 'bg-parch-50 text-parch-900',
                  row.past && 'text-parch-400',
                )}
              >
                {row.href ? (
                  <Link href={row.href} className="underline decoration-brand-gold/60 underline-offset-2 hover:text-brand-800">
                    {formatMonthDay(row.sunday)}
                  </Link>
                ) : (
                  formatMonthDay(row.sunday)
                )}
                {row.next && <span className="ml-1.5 text-[10px] font-semibold uppercase text-brand-gold-dark">Next</span>}
              </th>
              {roles.map((role) => {
                const cell = cells[gridKey(row.weekStart, role)]
                return (
                  <td
                    key={role}
                    data-cell={gridKey(row.weekStart, role)}
                    className={cn(
                      'border-t border-[#F0EEE8] px-2 py-2 align-top leading-snug',
                      cell?.tone === 'new' && 'bg-[#FDF5E4] font-semibold text-brand-800',
                      !cell && 'text-parch-300',
                      cell && cell.tone !== 'new' && (row.past ? 'text-parch-400' : 'text-[#374151]'),
                    )}
                  >
                    {cell ? cell.name : '—'}
                    {cell?.tone === 'done' && <span className="ml-1 text-[#16A34A]" aria-label="marked done">✓</span>}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

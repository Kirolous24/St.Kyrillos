import { WeekMatrix } from '@/components/portal/WeekMatrix'
import type { ServantReport } from '@/lib/portal/data/servant-attendance'

function abbreviate(label: string): string {
  return (label.match(/\b\w/g) ?? []).join('').slice(0, 3).toUpperCase()
}

/**
 * Servants down the side, one group per week across the top with a column per
 * activity inside it — the prototype's two-header-row grid (OG L8080-8106).
 *
 * The "By servant" table above says a servant attended 3 of 5. This says which
 * two they missed, which is the question a coordinator is actually asking, and
 * the data for it was being computed and then discarded before it reached the
 * page. The grid itself is shared with the children's weekly report (2026-10-19).
 */
export function ServantWeekMatrix({ report }: { report: ServantReport }) {
  return (
    <WeekMatrix
      weeks={report.weeks}
      activities={report.activities.map((a) => ({ key: a.key, label: a.label, abbr: abbreviate(a.label) }))}
      rows={report.rows.map((r) => ({ id: r.servantId, name: r.name, cells: r.cells }))}
      personLabel="Servant"
    />
  )
}

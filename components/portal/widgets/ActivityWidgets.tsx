import Link from 'next/link'
import { AlertCircle, RefreshCw, Trophy } from 'lucide-react'
import { Card, Badge } from '@/components/portal/ui'
import { timeAgo } from '@/lib/portal/format'

/**
 * The prototype's dashboard widget column (OG L4390-4496 for a servant,
 * L1956-1969 for the church-wide twin). Each card hides itself when it has
 * nothing to say, exactly as the OG's `wCard` list did — an empty widget is
 * worse than no widget on a page a servant reads at a glance on a Sunday.
 */

export function NotCheckedInWidget({ students }: { students: { id: string; name: string }[] }) {
  if (students.length === 0) return null
  return (
    <Card
      title="Not checked in today"
      icon={<AlertCircle className="h-4 w-4" aria-hidden />}
      action={<Badge tone="bad">{students.length}</Badge>}
      bodyClassName="p-0"
    >
      <ul className="max-h-[260px] overflow-y-auto">
        {students.map((s) => (
          <li key={s.id} className="border-b-[0.5px] border-[#F0EEE8] px-[18px] py-2 last:border-b-0">
            <Link href={`/portal/students/${s.id}`} className="text-[12.5px] font-semibold text-parch-800 hover:text-brand-800">
              {s.name}
            </Link>
          </li>
        ))}
      </ul>
      <p className="px-[18px] py-2 text-[10.5px] text-parch-500">
        Based on today&rsquo;s check-ins so far &mdash; may still update.
      </p>
    </Card>
  )
}

export function TopPerformersWidget({
  students,
}: {
  students: { studentId: string; name: string; average: number; count: number }[]
}) {
  if (students.length === 0) return null
  const medals = ['🥇', '🥈', '🥉', '🏅']
  return (
    <Card title="Top performing students" icon={<Trophy className="h-4 w-4" aria-hidden />} bodyClassName="p-0">
      <ul>
        {students.map((s, i) => (
          <li
            key={s.studentId}
            className="flex items-center gap-2.5 border-b-[0.5px] border-[#F0EEE8] px-[18px] py-2.5 last:border-b-0"
          >
            <span aria-hidden className="w-5 shrink-0 text-center text-[15px]">
              {medals[i] ?? '🏅'}
            </span>
            <div className="min-w-0 flex-1">
              <Link href={`/portal/students/${s.studentId}`} className="block truncate text-[12.5px] font-semibold text-parch-800 hover:text-brand-800">
                {s.name}
              </Link>
              <p className="text-[11px] text-parch-500">
                {s.count} quiz{s.count === 1 ? '' : 'zes'} averaged
              </p>
            </div>
            <span className="shrink-0 text-[12px] font-bold tabular-nums text-[#D97706]">{s.average}%</span>
          </li>
        ))}
      </ul>
      {/* The ranking ignores anyone with a single score, so say so rather than
          leaving a servant to wonder why a child they know did well is absent. */}
      <p className="px-[18px] py-2 text-[10.5px] text-parch-500">
        Averaged over every quiz sat. A student needs at least two before they are ranked.
      </p>
    </Card>
  )
}

export function RecentActivityWidget({
  entries,
  now,
  churchWide,
}: {
  entries: { id: string; studentId: string; studentName: string; activityLabel: string; points: number; at: Date }[]
  now: Date
  churchWide: boolean
}) {
  if (entries.length === 0) return null
  return (
    <Card
      title="Recent activity"
      icon={<RefreshCw className="h-4 w-4" aria-hidden />}
      action={churchWide ? <span className="text-[11px] text-parch-500">Across every class</span> : undefined}
      bodyClassName="p-0"
    >
      <ul>
        {entries.map((e) => (
          <li
            key={e.id}
            className="flex items-center gap-2.5 border-b-[0.5px] border-[#F0EEE8] px-[18px] py-2.5 last:border-b-0"
          >
            <p className="min-w-0 flex-1 text-[12.5px] text-parch-800">
              <Link href={`/portal/students/${e.studentId}`} className="font-bold hover:text-brand-800">
                {e.studentName}
              </Link>{' '}
              earned {e.activityLabel}
            </p>
            <span
              className={`shrink-0 text-[11px] font-bold tabular-nums ${e.points >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}
            >
              {e.points >= 0 ? '+' : ''}
              {e.points}
            </span>
            <span className="w-[52px] shrink-0 text-right text-[10.5px] text-parch-500">{timeAgo(e.at, now)}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

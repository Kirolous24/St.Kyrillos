import Link from 'next/link'
import { Trophy } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '@/lib/portal/session'
import { listVisibleClasses } from '@/lib/portal/data/classes'
import { classTotals } from '@/lib/portal/data/dashboard'
import { studentName } from '@/lib/portal/data/students'
import { rankStudents } from '@/lib/portal/points-math'
import { PageHeader, Card, Avatar, Badge, EmptyState, ProgressBar } from '@/components/portal/ui'
import { ClassPicker } from '@/components/portal/ClassPicker'

export const metadata = { title: 'Leaderboard' }

/** The prototype's rank cell: a medal for the podium, "#n" for everyone else. */
const MEDALS = ['\u{1F947}', '\u{1F948}', '\u{1F949}']

export default async function LeaderboardPage({ searchParams }: { searchParams: { class?: string } }) {
  const user = await requirePortalUser()
  const classes = await listVisibleClasses(user)
  const selectable = classes
  const classId = selectable.some((c) => c.id === searchParams.class)
    ? searchParams.class!
    : user.role === 'STUDENT' || user.role === 'SERVANT'
      ? selectable[0]?.id ?? 'all'
      : 'all'
  const scopeIds = classId === 'all' ? selectable.map((c) => c.id) : [classId]

  // Independent queries, so pay one round trip to Neon rather than two.
  const [students, totals] = await Promise.all([
    prisma.student.findMany({
      where: { classId: { in: scopeIds } },
      select: { id: true, firstName: true, lastName: true, classId: true, class: { select: { name: true } }, account: { select: { photo: true } } },
    }),
    classTotals(scopeIds),
  ])
  const ranked = rankStudents(students.map((s) => ({ studentId: s.id, name: studentName(s), total: totals.get(s.id) ?? 0 })))
  const byId = new Map(students.map((s) => [s.id, s]))
  const canOpenProfiles = user.role !== 'STUDENT'
  const rows = ranked.slice(0, 100)
  const topTotal = Math.max(rows[0]?.total ?? 0, 1)

  return (
    <>
      <PageHeader
        title="Leaderboard"
        subtitle={classId === 'all' ? 'All students ranked by points' : classes.find((c) => c.id === classId)?.name}
        icon={<Trophy className="h-5 w-5" />}
      />
      {user.role !== 'STUDENT' && selectable.length > 1 && (
        <div className="mb-4">
          <ClassPicker value={classId} options={selectable.map((c) => ({ id: c.id, name: c.name }))} allowAll={user.role !== 'SERVANT'} />
        </div>
      )}
      {rows.length === 0 ? (
        <EmptyState title="No students yet" hint="Points appear here as soon as attendance is taken." />
      ) : (
        <Card title="Class leaderboard" icon={<Trophy className="h-4 w-4" />} bodyClassName="p-0">
          <ol>
            {rows.map((r) => {
              const s = byId.get(r.studentId)!
              const isMe = user.studentId === r.studentId
              const isFirst = r.rank === 1
              const isPodium = r.rank <= 3
              const pct = Math.round((r.total / topTotal) * 100)
              return (
                <li
                  key={r.studentId}
                  className={[
                    'flex items-center gap-3 border-b border-[#F5F2ED] px-[18px] py-[11px] transition-colors last:border-0',
                    isFirst
                      ? 'bg-[linear-gradient(90deg,#FDF5E4,#FBEFD8_60%,#FFFDF8)]'
                      : isMe
                        ? 'bg-brand-wash'
                        : isPodium
                          ? 'bg-parch-100/60'
                          : 'hover:bg-brand-hover',
                  ].join(' ')}
                >
                  <span
                    className={`w-7 shrink-0 text-center tabular-nums ${isPodium ? 'text-[17px]' : 'text-[12px] font-bold text-parch-500'}`}
                    aria-hidden={isPodium || undefined}
                  >
                    {isPodium ? MEDALS[r.rank - 1] : `#${r.rank}`}
                  </span>
                  {isPodium && <span className="sr-only">Rank {r.rank}</span>}
                  <Avatar name={r.name} photo={s.account.photo} size="sm" />
                  <div className="min-w-0 flex-1">
                    {canOpenProfiles ? (
                      <Link
                        href={`/portal/students/${r.studentId}`}
                        className="block truncate text-[12.5px] font-semibold text-parch-900 transition-colors hover:text-brand-800"
                      >
                        {r.name}
                      </Link>
                    ) : (
                      <span className={`block truncate text-[12.5px] font-semibold ${isMe ? 'text-brand-800' : 'text-parch-900'}`}>
                        {r.name}
                        {isMe ? ' (you)' : ''}
                      </span>
                    )}
                    {classId === 'all' && <p className="truncate text-[11px] text-parch-500">{s.class?.name}</p>}
                    <div className="mt-1.5">
                      <ProgressBar value={pct} tone="brand" label={`${r.total} points`} />
                    </div>
                  </div>
                  <span className="shrink-0">
                    <Badge tone={isPodium ? 'gold' : 'neutral'}>{r.total} pts</Badge>
                  </span>
                </li>
              )
            })}
          </ol>
        </Card>
      )}
    </>
  )
}

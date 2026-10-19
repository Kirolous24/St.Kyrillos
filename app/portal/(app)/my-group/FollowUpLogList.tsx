import Link from '@/components/portal/Link'
import { prisma } from '@/lib/prisma'
import { rosterWhere } from '@/lib/portal/class-members'
import { contactMethodLabel, contactResultLabel, writtenForGroupOf } from '@/lib/portal/followups'
import { studentName } from '@/lib/portal/data/students'
import { addDays, churchDayStart, churchToday, CHURCH_TIMEZONE } from '@/lib/portal/dates'
import { formatShortDate } from '@/lib/portal/format'
import { Badge, Card, EmptyState } from '@/components/portal/ui'

const DAYS = 60
const LIMIT = 200

function timeOfDay(at: Date): string {
  return at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: CHURCH_TIMEZONE })
}

/**
 * Who followed up on whom (2026-10-19): every call, text and visit logged for
 * a class, newest first, with who logged it and — when it was somebody other
 * than the child's own servant — whose group it was for. It is the class's own
 * record, readable by everyone who serves it.
 */
export async function FollowUpLogList({ classId, className }: { classId: string; className: string }) {
  const today = churchToday()
  const logs = await prisma.followUpLog.findMany({
    where: { student: rosterWhere(classId), at: { gte: churchDayStart(addDays(today, -DAYS)) } },
    orderBy: { at: 'desc' },
    take: LIMIT,
    select: {
      id: true,
      at: true,
      method: true,
      result: true,
      note: true,
      caseId: true,
      studentId: true,
      student: { select: { firstName: true, lastName: true } },
      by: { select: { displayName: true, servant: { select: { id: true } } } },
      groupServantId: true,
      groupServant: { select: { account: { select: { displayName: true } } } },
    },
  })

  if (logs.length === 0) {
    return (
      <EmptyState
        title={`No follow-ups logged in ${className} in the last ${DAYS} days`}
        hint="Every call, text or visit anyone logs on a child of this class shows here, with who made it."
      />
    )
  }

  const days: Array<{ day: string; rows: typeof logs }> = []
  for (const l of logs) {
    const day = churchToday(l.at)
    if (days[days.length - 1]?.day !== day) days.push({ day, rows: [] })
    days[days.length - 1]!.rows.push(l)
  }

  return (
    <div className="space-y-4" data-testid="follow-up-log">
      <p className="text-[12px] text-parch-600">
        Every follow-up logged on a child of {className} in the last {DAYS} days{logs.length >= LIMIT ? ` (the latest ${LIMIT})` : ''}, with who
        made it.
      </p>
      {days.map(({ day, rows }) => (
        <Card key={day} title={formatShortDate(day)} bodyClassName="p-0">
          <ul>
            {rows.map((l) => {
              const forGroup = writtenForGroupOf({
                groupServantId: l.groupServantId,
                groupServantName: l.groupServant?.account.displayName ?? null,
                byServantId: l.by?.servant?.id ?? null,
              })
              const result = contactResultLabel(l.result)
              return (
                <li key={l.id} className="border-b border-[#F5F2ED] px-[18px] py-2.5 text-[12.5px] last:border-0" data-testid="follow-up-log-row">
                  <p className="text-parch-800">
                    <span className="text-parch-500">{timeOfDay(l.at)} · </span>
                    <strong>{l.by?.displayName ?? 'A former servant'}</strong>
                    {' → '}
                    <Link href={`/portal/students/${l.studentId}`} className="font-semibold text-brand-800 underline-offset-2 hover:underline">
                      {studentName(l.student)}
                    </Link>
                    {forGroup && <span className="text-parch-500"> · for {forGroup}’s group</span>}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge tone={l.method === 'resolved' ? 'good' : 'brand'}>{contactMethodLabel(l.method)}</Badge>
                    {result && <Badge tone={l.result === 'reached' || l.result === 'will_come' ? 'good' : 'neutral'}>{result}</Badge>}
                    {l.caseId && (
                      <Link href={`/portal/follow-ups/${l.caseId}`} className="text-[11px] font-bold text-brand-800 underline decoration-brand-gold underline-offset-2">
                        case
                      </Link>
                    )}
                  </p>
                  {l.note && <p className="mt-1 whitespace-pre-wrap text-[12px] text-parch-700">{l.note}</p>}
                </li>
              )
            })}
          </ul>
        </Card>
      ))}
    </div>
  )
}

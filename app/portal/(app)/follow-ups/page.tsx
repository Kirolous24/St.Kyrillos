import Link from 'next/link'
import { HeartHandshake, MessageSquare, CalendarClock, CircleCheck, CircleAlert } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '@/lib/portal/session'
import { listVisibleClasses } from '@/lib/portal/data/classes'
import { studentName } from '@/lib/portal/data/students'
import { todayInNewYork, formatDateOnly, daysBetween } from '@/lib/portal/dates'
import { formatMonthDay } from '@/lib/portal/format'
import { PageHeader, Card, StatCard, Badge, EmptyState, LinkButton } from '@/components/portal/ui'
import { NewCaseForm } from './NewCaseForm'

export const metadata = { title: 'Follow-ups' }

export default async function FollowUpsPage({ searchParams }: { searchParams: { show?: string } }) {
  const user = await requirePortalUser()
  if (user.role === 'STUDENT')
    return (
      <>
        <PageHeader title="Follow-ups" icon={<HeartHandshake className="h-5 w-5" aria-hidden />} />
        <EmptyState title="Not available" hint="Follow-ups are a servant's tool." />
      </>
    )
  const classes = await listVisibleClasses(user)
  const classIds = classes.map((c) => c.id)
  const showDone = searchParams.show === 'done'
  const today = todayInNewYork()

  const cases = await prisma.followUpCase.findMany({
    where: { classId: { in: classIds }, status: showDone ? 'DONE' : 'OPEN' },
    orderBy: showDone ? { resolvedAt: 'desc' } : { createdAt: 'asc' },
    take: 200,
    select: {
      id: true, title: true, origin: true, consecutiveAbsences: true, createdAt: true, nextFollowUp: true, resolvedAt: true, resolveReason: true,
      student: { select: { id: true, firstName: true, lastName: true } },
      class: { select: { name: true } },
      _count: { select: { logs: true } },
    },
  })
  // Counts for the two summary tiles — display only, same class scope as above.
  const [openCount, doneCount] = await Promise.all([
    prisma.followUpCase.count({ where: { classId: { in: classIds }, status: 'OPEN' } }),
    prisma.followUpCase.count({ where: { classId: { in: classIds }, status: 'DONE' } }),
  ])
  const canCreate = user.role !== 'PASTOR'
  const students = canCreate
    ? await prisma.student.findMany({ where: { classId: { in: classIds } }, orderBy: [{ firstName: 'asc' }], select: { id: true, firstName: true, lastName: true, class: { select: { name: true } } } })
    : []

  return (
    <>
      <PageHeader
        title="Follow-ups"
        subtitle={showDone ? 'Cases that have been closed out' : 'Students who need a check-in'}
        icon={<HeartHandshake className="h-5 w-5" />}
        actions={
          <LinkButton href={showDone ? '/portal/follow-ups' : '/portal/follow-ups?show=done'} variant="secondary">
            {showDone ? 'Show open' : 'Show resolved'}
          </LinkButton>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          label="Open"
          value={openCount}
          tone={openCount > 0 ? 'warn' : 'good'}
          accent={openCount > 0 ? '#D97706' : '#16A34A'}
          icon={<CircleAlert className="h-6 w-6" />}
          hint={openCount > 0 ? 'Waiting on a contact' : 'Everyone is accounted for'}
        />
        <StatCard
          label="Resolved"
          value={doneCount}
          tone="good"
          accent="#16A34A"
          icon={<CircleCheck className="h-6 w-6" />}
          hint="Closed out to date"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {cases.length === 0 ? (
            <EmptyState
              title={showDone ? 'No resolved cases' : 'No open follow-ups'}
              hint={showDone ? undefined : 'Cases open automatically when a student misses Sunday School repeatedly.'}
            />
          ) : (
            cases.map((c) => {
              const ageDays = daysBetween(formatDateOnly(c.createdAt), today)
              const urgent = !showDone && ageDays >= 14
              return (
                <Card
                  key={c.id}
                  className={urgent ? 'border-l-red-600' : undefined}
                  title={
                    <Link href={`/portal/follow-ups/${c.id}`} className="font-serif text-[14px] font-bold text-parch-900 transition-colors hover:text-brand-800">
                      {studentName(c.student)}
                    </Link>
                  }
                  action={
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      <Badge tone={c.origin === 'AUTO' ? 'bad' : 'brand'}>
                        {c.origin === 'AUTO' ? `${c.consecutiveAbsences} missed` : 'Manual'}
                      </Badge>
                      {urgent && <Badge tone="bad">Open {ageDays}d</Badge>}
                      {showDone && <Badge tone="good">Resolved</Badge>}
                    </div>
                  }
                  bodyClassName="p-0"
                >
                  <p className="border-b border-[#F5F2ED] px-[18px] py-2.5 text-[12.5px] text-parch-700">{c.title}</p>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 sm:gap-x-4">
                    <Detail label="Class" value={c.class.name} />
                    <Detail label="Opened" value={`${formatMonthDay(formatDateOnly(c.createdAt))} · ${ageDays}d ago`} />
                    {c.origin === 'AUTO' && <Detail label="Missed in a row" value={String(c.consecutiveAbsences)} />}
                    <Detail
                      label="Contacts"
                      value={
                        <span className="inline-flex items-center gap-1">
                          <MessageSquare className="h-3.5 w-3.5 text-brand-gold-dark" aria-hidden />
                          {c._count.logs}
                        </span>
                      }
                    />
                    {c.nextFollowUp && (
                      <Detail
                        label="Next follow-up"
                        value={
                          <span className="inline-flex items-center gap-1">
                            <CalendarClock className="h-3.5 w-3.5 text-brand-gold-dark" aria-hidden />
                            {formatMonthDay(formatDateOnly(c.nextFollowUp))}
                          </span>
                        }
                      />
                    )}
                    {c.resolvedAt && (
                      <Detail
                        label="Resolved"
                        value={`${formatMonthDay(formatDateOnly(c.resolvedAt))}${c.resolveReason ? ` · ${c.resolveReason.replace('_', ' ')}` : ''}`}
                      />
                    )}
                  </dl>
                  <div className="px-[18px] pb-3.5 pt-3 print:hidden">
                    <LinkButton href={`/portal/follow-ups/${c.id}`} variant="secondary" size="sm">
                      Open case
                    </LinkButton>
                  </div>
                </Card>
              )
            })
          )}
        </div>
        {canCreate && <NewCaseForm students={students.map((s) => ({ id: s.id, label: `${studentName(s)} — ${s.class?.name ?? ''}` }))} />}
      </div>
    </>
  )
}

/** A key/value line in a case card, matching the prototype's `.cls-card` rows. */
function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-2 border-b border-[#F5F2ED] px-[18px] py-2 text-[12px] last:border-0">
      <dt className="shrink-0 text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">{label}</dt>
      <dd className="truncate text-right font-semibold text-parch-800">{value}</dd>
    </div>
  )
}

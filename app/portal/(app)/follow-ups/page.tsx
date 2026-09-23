import Link from 'next/link'
import { HeartHandshake, MessageSquare, CalendarClock, CircleCheck, CircleAlert } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '@/lib/portal/session'
import { resolveReasonLabel, contactMethodLabel } from '@/lib/portal/followups'
import { listVisibleClasses } from '@/lib/portal/data/classes'
import { studentName } from '@/lib/portal/data/students'
import { todayInNewYork, formatDateOnly, daysBetween } from '@/lib/portal/dates'
import { formatMonthDay } from '@/lib/portal/format'
import { PageHeader, Card, StatCard, Badge, EmptyState, LinkButton, Callout } from '@/components/portal/ui'
import { NewCaseForm } from './NewCaseForm'
import { formatPhone, waLink } from '@/lib/portal/phones'
import { CaseQuickActions, type Contact } from './CaseQuickActions'
import { ClosedCaseCleanup } from './ClosedCaseCleanup'

export const metadata = { title: 'Follow-ups' }

type CaseStudent = {
  parentEmails: string[]
  fatherPhone: string | null
  motherPhone: string | null
  account: { email: string | null; phone: string | null }
}

/** The prototype's contact list for the Send composer (OG L17367-17380). */
function emailsFor(s: CaseStudent): Contact[] {
  const out: Contact[] = []
  if (s.account.email) out.push({ label: "Student's email", value: s.account.email })
  s.parentEmails.filter(Boolean).forEach((e, i) => out.push({ label: `Parent email${i > 0 ? ` ${i + 1}` : ''}`, value: e }))
  return out
}

function phonesFor(s: CaseStudent): Contact[] {
  const out: Contact[] = []
  if (s.account.phone) out.push({ label: "Student's phone", value: formatPhone(s.account.phone) })
  if (s.fatherPhone) out.push({ label: "Father's phone", value: formatPhone(s.fatherPhone) })
  if (s.motherPhone) out.push({ label: "Mother's phone", value: formatPhone(s.motherPhone) })
  return out
}

const firstNumber = (s: CaseStudent) => s.account.phone || s.fatherPhone || s.motherPhone || null
const telFor = (s: CaseStudent) => { const n = firstNumber(s); return n ? `tel:${n.replace(/[^\d+]/g, '')}` : null }
const waFor = (s: CaseStudent) => waLink(firstNumber(s))

export default async function FollowUpsPage({ searchParams }: { searchParams: { show?: string; class?: string } }) {
  const user = await requirePortalUser()
  if (user.role === 'STUDENT')
    return (
      <>
        <PageHeader title="Follow-ups" icon={<HeartHandshake className="h-5 w-5" aria-hidden />} />
        <EmptyState title="Not available" hint="Follow-ups are a servant's tool." />
      </>
    )
  const visible = await listVisibleClasses(user)
  /**
   * The admin's class workspace links here with `?class=`. Narrowing only —
   * an id the viewer cannot already see is ignored rather than honoured, so the
   * parameter can never widen what anybody reads.
   */
  const scopedTo = visible.find((c) => c.id === searchParams.class) ?? null
  const classes = scopedTo ? [scopedTo] : visible
  const classIds = classes.map((c) => c.id)
  const showDone = searchParams.show === 'done'
  const today = todayInNewYork()

  const CASE_LIMIT = 200
  const cases = await prisma.followUpCase.findMany({
    where: { classId: { in: classIds }, status: showDone ? 'DONE' : 'OPEN' },
    // F0112 — open cases were listed oldest-first, which is *nearly* worst-first
    // and quietly is not: a child who missed six Sundays last month sat below a
    // child who missed two last year. Ordered by how many Sundays have been
    // missed, then by age as the tiebreak, so the top of the list is the child
    // who needs a call most.
    orderBy: showDone
      ? { resolvedAt: 'desc' }
      : [{ consecutiveAbsences: 'desc' }, { createdAt: 'asc' }],
    take: CASE_LIMIT,
    select: {
      id: true, classId: true, title: true, origin: true, consecutiveAbsences: true, createdAt: true, nextFollowUp: true, resolvedAt: true, resolveReason: true,
      // F0114 — the row said how long the case had been open but never when the
      // child was last actually seen, which is the number a servant calling
      // them needs to open with.
      lastSeen: true,
      student: {
        select: {
          id: true, firstName: true, lastName: true,
          fatherPhone: true, motherPhone: true, parentEmails: true,
          account: { select: { email: true, phone: true } },
        },
      },
      class: { select: { name: true } },
      _count: { select: { logs: true } },
      // F0111 — the most recent contact note. The prototype showed it on the
      // row so a servant could see what was already tried before ringing again.
      logs: {
        orderBy: { at: 'desc' },
        take: 1,
        select: { note: true, method: true, at: true, result: true },
      },
    },
  })
  // Counts for the two summary tiles — display only, same class scope as above.
  const [openCount, doneCount] = await Promise.all([
    prisma.followUpCase.count({ where: { classId: { in: classIds }, status: 'OPEN' } }),
    prisma.followUpCase.count({ where: { classId: { in: classIds }, status: 'DONE' } }),
  ])
  // F0121 — the list is capped but the tiles counted everything, so a church
  // with 250 open cases read "250" above a list of 200 and nothing said the
  // list had stopped.
  const shownCount = showDone ? doneCount : openCount
  const truncated = cases.length >= CASE_LIMIT && shownCount > cases.length
  // The pastor holds 'followup.write' and the prototype let them open manual
  // cases church-wide; only this page's own flag was stopping them.
  const canCreate = true

  /**
   * F0103 / F0455 — what actually opens a case.
   *
   * The real friction was never that a servant could not change the number; it
   * was that nobody knew what the number was, so "why has no case opened for
   * her?" had no answer on the page that raises them. Shown, not editable: the
   * person most tempted to raise this threshold is the servant who does not want
   * the chasing, and a tripwire that notices a child who has stopped coming is
   * the last thing anyone should be able to move for their own class. It is set
   * once a year, so needing an admin costs almost nothing.
   */
  const thresholds = await prisma.schoolClass.findMany({
    where: { id: { in: classIds } },
    select: { name: true, visitationThreshold: true },
    orderBy: { sortOrder: 'asc' },
  })
  const thresholdValues = Array.from(new Set(thresholds.map((t) => t.visitationThreshold))).sort((a, b) => a - b)
  const thresholdLine =
    thresholdValues.length === 0
      ? null
      : thresholdValues.length === 1
        ? `A case opens automatically after ${thresholdValues[0]} missed Sunday${thresholdValues[0] === 1 ? '' : 's'} in a row.`
        : `A case opens automatically after ${thresholdValues.join(' or ')} missed Sundays in a row, depending on the class.`

  const students = canCreate
    ? await prisma.student.findMany({ where: { classId: { in: classIds } }, orderBy: [{ firstName: 'asc' }], select: { id: true, firstName: true, lastName: true, class: { select: { name: true } } } })
    : []

  const caseCard = (c: (typeof cases)[number]) => {
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
                      {/* F0212 — every automatic case wore the same red pill, so
                          a child gone three Sundays looked exactly as urgent as
                          one gone ten and the list gave a servant nothing to
                          triage by eye. The prototype's Absence Alert reddened
                          at five weeks; below that it is amber. "Weeks" is the
                          unit the church counts absence in when it rings home. */}
                      <Badge tone={c.origin !== 'AUTO' ? 'brand' : c.consecutiveAbsences >= 5 ? 'bad' : 'warn'}>
                        {c.origin === 'AUTO'
                          ? `${c.consecutiveAbsences} ${c.consecutiveAbsences === 1 ? 'week' : 'weeks'} missed`
                          : 'Manual'}
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
                    {/* F0114 — when the child was actually last seen, which is
                        how a servant opens the phone call. */}
                    <Detail
                      label="Last seen"
                      value={
                        c.lastSeen
                          ? `${formatMonthDay(formatDateOnly(c.lastSeen))} · ${daysBetween(formatDateOnly(c.lastSeen), today)}d ago`
                          : 'No attendance recorded'
                      }
                    />
                    {c.resolvedAt && (
                      <Detail
                        label="Resolved"
                        value={`${formatMonthDay(formatDateOnly(c.resolvedAt))}${c.resolveReason ? ` · ${resolveReasonLabel(c.resolveReason)}` : ''}`}
                      />
                    )}
                  </dl>
                  {/* F0111 — what was already tried, so nobody repeats the call
                      that was made yesterday. */}
                  {c.logs[0] && (
                    <div className="border-t border-[#F5F2ED] px-[18px] py-2.5">
                      <p className="mb-0.5 text-[10.5px] font-bold uppercase tracking-[0.8px] text-parch-500">
                        Last contact · {contactMethodLabel(c.logs[0]!.method)} ·{' '}
                        {formatMonthDay(formatDateOnly(c.logs[0]!.at))}
                      </p>
                      <p className="text-[12.5px] text-parch-700">
                        {c.logs[0]!.note?.trim() || c.logs[0]!.result?.trim() || 'No note was left.'}
                      </p>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-1.5 px-[18px] pb-3.5 pt-3 print:hidden">
                    <LinkButton href={`/portal/follow-ups/${c.id}`} variant="secondary" size="sm">
                      Log follow-up
                    </LinkButton>
                    <CaseQuickActions
                      caseId={c.id}
                      studentName={studentName(c.student)}
                      emails={emailsFor(c.student)}
                      phones={phonesFor(c.student)}
                      primaryPhone={telFor(c.student)}
                      primaryWa={waFor(c.student)}
                    />
                  </div>
                </Card>
              )
  }

  // The pastor's church-wide view was one flat list with the class name buried
  // as a detail row (OG L18589-18602 grouped it into a card per class with an
  // open-count chip). At real scale — every class, up to 200 cases — a flat
  // list is unreadable for the one role whose job is the cross-class overview.
  const grouped = classes.length > 1
  const groups = grouped
    ? classes
        .map((cl) => ({ id: cl.id, name: cl.name, cases: cases.filter((c) => c.classId === cl.id) }))
        // A class with nothing open still shows, so "all clear" is visible
        // rather than inferred from an absence — but only while viewing open
        // cases, since an empty resolved list says nothing useful.
        .filter((g) => g.cases.length > 0 || !showDone)
    : [{ id: 'all', name: '', cases }]

  return (
    <>
      <PageHeader
        title="Follow-ups"
        subtitle={
          // Says which class when scoped, so a narrowed list can never be
          // mistaken for the whole church having only two open cases.
          scopedTo
            ? showDone
              ? `${scopedTo.name} · ${doneCount} case${doneCount === 1 ? '' : 's'} closed out`
              : `${scopedTo.name} · ${openCount} student${openCount === 1 ? '' : 's'} need a check-in`
            : showDone
              ? `${doneCount} case${doneCount === 1 ? '' : 's'} closed out`
              : `${openCount} student${openCount === 1 ? '' : 's'} need a check-in${grouped ? ` across ${classes.length} classes` : ''}`
        }
        icon={<HeartHandshake className="h-5 w-5" />}
        actions={
          <>
            {/* Keeps the class scope across the open/resolved toggle; without it
                the toggle silently drops back to every class. */}
            <LinkButton
              href={`/portal/follow-ups?${new URLSearchParams({
                ...(scopedTo ? { class: scopedTo.id } : {}),
                ...(showDone ? {} : { show: 'done' }),
              }).toString()}`}
              variant="secondary"
            >
              {showDone ? 'Show open' : 'Show resolved'}
            </LinkButton>
            {scopedTo && (
              <LinkButton href="/portal/follow-ups" variant="secondary">
                All classes
              </LinkButton>
            )}
          </>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        {/* F0119 / F0463 — two counts say how many; the prototype's donut said
            what share of the church's cases are still waiting, and twelve open
            against forty closed is a different church from twelve against
            three. That proportion is the question a servant opens this page
            with, and it is the one thing "14" and "61" side by side cannot
            answer. Inline SVG deliberately, not a <canvas>: a canvas lays out
            0x0 when it is hidden for print, and this tile prints. */}
        <div
          data-donut="cases"
          className="flex items-center gap-4 rounded-[16px] border border-parch-200 border-l-4 border-l-brand-gold bg-parch-50 p-5 shadow-panel"
        >
          <svg
            viewBox="0 0 36 36"
            className="h-[72px] w-[72px] shrink-0"
            role="img"
            aria-label={`${openCount} open, ${doneCount} resolved`}
          >
            {/* r = 15.915 makes the circumference exactly 100, so the dash
                array reads directly as a percentage. */}
            <circle cx="18" cy="18" r="15.915" fill="none" stroke="#DCFCE7" strokeWidth="4" />
            {openCount + doneCount > 0 && (
              <>
                <circle
                  cx="18"
                  cy="18"
                  r="15.915"
                  fill="none"
                  stroke="#8B1C2E"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={`${Math.round((openCount / (openCount + doneCount)) * 100)} 100`}
                  transform="rotate(-90 18 18)"
                />
                <text x="18" y="20.5" textAnchor="middle" fontSize="9" fontWeight="700" fill="#2F2930">
                  {Math.round((openCount / (openCount + doneCount)) * 100)}%
                </text>
              </>
            )}
          </svg>
          <div className="min-w-0">
            <span className="mb-0.5 block text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">
              Open vs resolved
            </span>
            <span className="block text-[13px] font-semibold text-parch-800">
              {openCount + doneCount === 0
                ? 'No cases yet'
                : `${openCount} of ${openCount + doneCount} still open`}
            </span>
          </div>
        </div>
      </div>

      {/* F0103 — the number that raises these cases, on the page that shows
          them. Read-only, with the way to change it named rather than offered. */}
      {thresholdLine && (
        <p className="mb-4 rounded-[12px] border border-parch-200 bg-parch-50 px-4 py-2.5 text-[12px] text-parch-700">
          {thresholdLine}{' '}
          {user.role === 'ADMIN' ? (
            <Link href="/portal/admin/classes" className="font-bold text-brand-800 underline decoration-brand-gold underline-offset-2">
              Change it on the class
            </Link>
          ) : (
            <span className="text-parch-500">Ask an admin if it needs changing.</span>
          )}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {cases.length === 0 ? (
            <EmptyState
              title={showDone ? 'No resolved cases' : 'No open follow-ups'}
              hint={showDone ? undefined : 'Cases open automatically when a student misses Sunday School repeatedly.'}
            />
          ) : (
            groups.map((g) => (
              <section key={g.id} className="space-y-3">
                {grouped && (
                  <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F0EBE3] pb-1.5 pt-1">
                    <h2 className="font-serif text-[13.5px] font-bold text-brand-800">{g.name}</h2>
                    {g.cases.length === 0 ? (
                      <Badge tone="good">All clear</Badge>
                    ) : (
                      <Badge tone="warn">
                        {g.cases.length} open
                      </Badge>
                    )}
                  </header>
                )}
                {g.cases.map((c) => caseCard(c))}
              </section>
            ))
          )}
          {/* F0121 — the tiles above count every case; the list stops at 200.
              Without saying so, a church with 250 open cases reads "250" over a
              list of 200 and has no way to know 50 children are not on it. */}
          {truncated && (
            <Callout tone="warn">
              Showing the {cases.length} most pressing of {shownCount}. Narrow by class to see the rest —
              the counts above are the true totals.
            </Callout>
          )}
        </div>
        <div className="space-y-5">
          {canCreate && <NewCaseForm today={today} students={students.map((s) => ({ id: s.id, label: `${studentName(s)} — ${s.class?.name ?? ''}` }))} />}
          {/* F0113 — only on the resolved list, and only for someone who may
              write follow-ups. An open case is a child nobody has reached yet. */}
          {showDone && canCreate && (
            <ClosedCaseCleanup
              cases={cases.map((c) => ({
                id: c.id,
                name: studentName(c.student),
                className: c.class.name,
                resolved: c.resolvedAt ? formatMonthDay(formatDateOnly(c.resolvedAt)) : '—',
              }))}
            />
          )}
        </div>
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

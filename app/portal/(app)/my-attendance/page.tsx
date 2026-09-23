import { Flame, CalendarCheck, Percent, QrCode, Star } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '@/lib/portal/session'
import { loadMyServantHistory, listServantActivities } from '@/lib/portal/data/servant-attendance'
import { addDays, formatDateOnly, mondayOf, todayInNewYork, toUTCDate } from '@/lib/portal/dates'
import { formatLongDate } from '@/lib/portal/format'
import {
  attendanceRate,
  presentStreak,
  rateBand,
  RATE_BAND_LABEL,
  type CheckInStatus,
  type SessionWeekRow,
} from '@/lib/portal/qr'
import { PageHeader, Card, StatCard, Badge, EmptyState, ProgressBar, TableWrap, Th, Td, Callout, LinkButton } from '@/components/portal/ui'
import { SelfCheckIn } from './SelfCheckIn'

export const metadata = { title: 'My Attendance' }

const WEEKS_BACK = 26

/* ── Shared pieces ────────────────────────────────────────────────────────── */

function toneFor(rate: number | null): 'brand' | 'good' | 'warn' | 'bad' {
  if (rate === null) return 'brand'
  return rate >= 80 ? 'good' : rate >= 50 ? 'warn' : 'bad'
}

function bandTone(band: ReturnType<typeof rateBand>) {
  return band === 'excellent' ? 'good' : band === 'can-do-better' ? 'warn' : band === 'none' ? 'neutral' : 'bad'
}

/** One session's standing: percent, bar, band — the prototype's rate tile. */
function RateCard({
  label,
  rate,
  attended,
  held,
  hint,
}: {
  label: string
  rate: number | null
  attended: number
  held: number
  hint?: string
}) {
  const band = rateBand(rate)
  const tone = toneFor(rate)
  const colour = { brand: '#6F1D1B', good: '#16A34A', warn: '#D97706', bad: '#DC2626' }[tone]
  return (
    <div className="rounded-[16px] border border-parch-200 border-l-4 border-l-brand-gold bg-parch-50 p-4 shadow-card">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">{label}</p>
          <p className="mt-0.5 text-[30px] font-bold leading-none tracking-[-0.5px] tabular-nums" style={{ color: colour }}>
            {rate === null ? '—' : `${rate}%`}
          </p>
        </div>
        <Badge tone={bandTone(band)}>{RATE_BAND_LABEL[band]}</Badge>
      </div>
      <ProgressBar value={rate ?? 0} tone={tone} label={label} />
      <p className="mt-2 text-[11.5px] text-parch-500">
        {attended} of {held} held{hint ? ` · ${hint}` : ''}
      </p>
    </div>
  )
}

/** The prototype's burgundy streak banner. */
function StreakBanner({ streak, unit }: { streak: number; unit: string }) {
  if (streak <= 0) return null
  return (
    <div className="mb-4 flex items-center gap-3.5 rounded-[12px] bg-[linear-gradient(135deg,#6F1D1B,#4A1212)] px-5 py-4 shadow-banner">
      <Flame className="h-8 w-8 shrink-0 text-brand-gold-light" aria-hidden />
      <div className="min-w-0">
        <p className="text-[30px] font-bold leading-none text-brand-gold tabular-nums">{streak}</p>
        <p className="mt-0.5 text-[12px] text-white/60">{unit} — keep it up!</p>
      </div>
      {streak >= 3 && (
        <span className="ml-auto hidden shrink-0 items-center gap-1.5 rounded-[20px] border border-brand-gold bg-brand-gold/20 px-3 py-1 text-[12px] font-bold text-brand-gold sm:inline-flex">
          <Star className="h-3.5 w-3.5" aria-hidden /> On a roll!
        </span>
      )}
    </div>
  )
}

/* ── Route ────────────────────────────────────────────────────────────────── */

export default async function MyAttendancePage() {
  const user = await requirePortalUser()
  const today = todayInNewYork()
  const fromWeek = addDays(mondayOf(today), -7 * (WEEKS_BACK - 1))

  const thisWeek = mondayOf(today)

  if (user.studentId) return <StudentAttendance studentId={user.studentId} fromWeek={fromWeek} />

  // The session only carries servantId for accounts whose profile existed when
  // they signed in, so look it up as well — an admin who just self-marked has
  // a Servant row but a stale token.
  const servantId =
    user.servantId ??
    (await prisma.servant.findUnique({ where: { accountId: user.accountId }, select: { id: true } }))?.id ??
    null
  if (servantId) return <ServantAttendance servantId={servantId} fromWeek={fromWeek} thisWeek={thisWeek} />

  // Staff with no Servant profile at all — a pure ADMIN who also serves on a
  // Sunday. They had no way to record themselves anywhere in the portal; the
  // profile is created the first time they mark a week.
  if (user.role === 'ADMIN' || user.role === 'PASTOR' || user.role === 'SERVANT') {
    const activities = await listServantActivities()
    return (
      <>
        <PageHeader
          eyebrow="Attendance"
          icon={<CalendarCheck className="h-5 w-5" aria-hidden />}
          title="My Attendance"
          subtitle="Nothing recorded yet — mark your first week below."
        />
        <SelfCheckIn
          weekStart={thisWeek}
          activities={activities.map((a) => ({ key: a.key, label: a.label, status: null }))}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader title="My Attendance" />
      <EmptyState
        title="Nothing to show"
        hint="This page follows a student's or a servant's own attendance. Your account has neither profile."
      />
    </>
  )
}

/* ── Servant ──────────────────────────────────────────────────────────────── */

async function ServantAttendance({ servantId, fromWeek, thisWeek }: { servantId: string; fromWeek: string; thisWeek: string }) {
  const [{ overall, byWeek }, allActivities] = await Promise.all([
    loadMyServantHistory(servantId, fromWeek),
    listServantActivities(),
  ])
  // Every active activity is offered for the current week, not only the ones
  // somebody has already recorded — otherwise the first person to mark a week
  // has nothing to click.
  const currentCells = byWeek.find((w) => w.week === thisWeek)?.cells ?? []
  const selfActivities = allActivities.map((a) => ({
    key: a.key,
    label: a.label,
    status: (currentCells.find((c) => c.key === a.key)?.status ?? null) as 'PRESENT' | 'EXCUSED' | 'ABSENT' | null,
  }))
  const streak = presentStreak(byWeek.map((w) => ({ week: w.week, attended: w.cells.some((c) => c.status === 'PRESENT') })))
  const band = rateBand(overall.rate)

  // Per-activity standing, so a servant sees which of the seven they miss.
  // Scored with the same attendanceRate() the overall figure uses, so an
  // excused week is left out of the denominator here exactly as it is there.
  const perActivity = (byWeek[0]?.cells ?? []).map((c) => {
    const slice: SessionWeekRow[] = byWeek
      .map((w) => ({ week: w.week, cell: w.cells.find((x) => x.key === c.key) }))
      .filter((r) => r.cell?.wasHeld)
      .map((r) => ({ sessionKey: c.key, week: r.week, status: r.cell!.status }))
    return { key: c.key, label: c.label, ...attendanceRate(slice) }
  })

  return (
    <>
      <PageHeader
        eyebrow="Attendance"
        icon={<CalendarCheck className="h-5 w-5" aria-hidden />}
        title="My Attendance"
        subtitle={`Your own check-ins since ${formatLongDate(fromWeek)}.`}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Attendance rate"
          value={overall.rate === null ? '—' : `${overall.rate}%`}
          tone="brand"
          icon={<Percent className="h-6 w-6" aria-hidden />}
          hint={`${overall.attended} of ${overall.held} held`}
        />
        <StatCard
          label="Weeks in a row"
          value={streak}
          icon={<Flame className="h-6 w-6" aria-hidden />}
          accent="#EA580C"
          hint="Consecutive weeks you were with us"
        />
        <StatCard
          label="Standing"
          value={RATE_BAND_LABEL[band]}
          tone={band === 'excellent' ? 'good' : band === 'can-do-better' ? 'warn' : band === 'none' ? 'default' : 'bad'}
          icon={<Star className="h-6 w-6" aria-hidden />}
        />
      </div>

      <StreakBanner streak={streak} unit="Week streak" />

      <div className="mb-4">
        <SelfCheckIn weekStart={thisWeek} activities={selfActivities} />
      </div>

      {byWeek.length === 0 ? (
        <EmptyState title="No weeks recorded yet" hint="Mark yourself above, or wait for a coordinator to record the week." />
      ) : (
        <>
          {perActivity.length > 0 && (
            <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {perActivity.map((a) => (
                <RateCard key={a.key} label={a.label} rate={a.rate} attended={a.attended} held={a.held} />
              ))}
            </div>
          )}

          <Card title="Week by week">
            <TableWrap>
              <thead>
                <tr>
                  <Th className="sticky left-0 z-10 bg-parch-50">Week of</Th>
                  {byWeek[0]!.cells.map((c) => (
                    <Th key={c.key} align="center" className="bg-brand-wash text-brand-800">{c.label}</Th>
                  ))}
                  <Th align="right">Rate</Th>
                </tr>
              </thead>
              <tbody>
                {byWeek.map((w) => (
                  <tr key={w.week}>
                    <Td className="sticky left-0 z-10 whitespace-nowrap bg-parch-50 text-[12.5px] font-bold text-parch-900">
                      {formatLongDate(w.week)}
                    </Td>
                    {w.cells.map((c) => (
                      <Td key={c.key} align="center" className="px-2">
                        {!c.wasHeld ? (
                          <span className="text-[#D1CBBE]">—</span>
                        ) : c.status === 'PRESENT' ? (
                          <span className="text-[15px] font-bold text-[#16A34A]" title="Attended">✓</span>
                        ) : c.status === 'EXCUSED' ? (
                          <span className="text-[12px] font-bold text-[#B45309]" title="Excused">E</span>
                        ) : (
                          <span className="text-[15px] font-bold text-[#DC2626]" title="Absent">✗</span>
                        )}
                      </Td>
                    ))}
                    <Td align="right" className="text-[12.5px] font-bold tabular-nums">
                      {w.rate.rate === null ? '—' : `${w.rate.rate}%`}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          </Card>
        </>
      )}
    </>
  )
}

/* ── Student ──────────────────────────────────────────────────────────────── */

const RANK: Record<CheckInStatus, number> = { PRESENT: 3, EXCUSED: 2, ABSENT: 1 }

async function StudentAttendance({ studentId, fromWeek }: { studentId: string; fromWeek: string }) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, classId: true, class: { select: { name: true } } },
  })
  if (!student?.classId) {
    return (
      <>
        <PageHeader title="My Attendance" />
        <EmptyState title="You are not in a class yet" hint="Once a servant adds you to a class, your attendance shows here." />
      </>
    )
  }

  const since = toUTCDate(fromWeek)
  const [sessions, heldPairs, mine] = await Promise.all([
    prisma.attendanceSession.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' }, select: { key: true, label: true, points: true } }),
    prisma.attendanceRecord.groupBy({
      by: ['sessionKey', 'date'],
      where: { classId: student.classId, date: { gte: since } },
    }),
    prisma.attendanceRecord.findMany({
      where: { studentId: student.id, date: { gte: since } },
      orderBy: { date: 'desc' },
      select: { sessionKey: true, date: true, status: true },
    }),
  ])

  const sessionLabel = new Map(sessions.map((s) => [s.key, s.label]))
  const heldWeeks = new Set<string>()
  for (const p of heldPairs) {
    if (!sessionLabel.has(p.sessionKey)) continue
    heldWeeks.add(`${p.sessionKey}|${mondayOf(formatDateOnly(p.date))}`)
  }

  const best = new Map<string, CheckInStatus>()
  for (const r of mine) {
    const k = `${r.sessionKey}|${mondayOf(formatDateOnly(r.date))}`
    const current = best.get(k)
    if (!current || RANK[r.status] > RANK[current]) best.set(k, r.status)
  }

  const rows: SessionWeekRow[] = Array.from(heldWeeks).map((k) => {
    const [sessionKey, week] = k.split('|') as [string, string]
    return { sessionKey, week, status: best.get(k) ?? null }
  })

  const overall = attendanceRate(rows)
  const band = rateBand(overall.rate)
  const bySession = sessions
    .map((s) => ({ ...s, ...attendanceRate(rows.filter((r) => r.sessionKey === s.key)) }))
    .filter((s) => s.held > 0)

  const sundayWeeks = rows
    .filter((r) => r.sessionKey === 'sunday')
    .sort((a, b) => (a.week < b.week ? 1 : -1))
  const streak = presentStreak(sundayWeeks.map((r) => ({ week: r.week, attended: r.status === 'PRESENT' })))

  const recent = mine.slice(0, 20)

  return (
    <>
      <PageHeader
        eyebrow="My progress"
        icon={<CalendarCheck className="h-5 w-5" aria-hidden />}
        title="My Attendance"
        subtitle={`${student.class?.name ?? ''} · since ${formatLongDate(fromWeek)}`}
        actions={<LinkButton href="/portal/my-qr" variant="secondary"><QrCode className="h-4 w-4" aria-hidden /> My QR code</LinkButton>}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Attendance rate"
          value={overall.rate === null ? '—' : `${overall.rate}%`}
          tone="brand"
          icon={<Percent className="h-6 w-6" aria-hidden />}
          hint={`${overall.attended} of ${overall.held} held`}
        />
        {/* F0715 — the raw count was hint text under the percentage. A child
            reads "how many times have I been?" before "what is my rate?", and a
            percentage with nothing behind it is the number a parent argues
            with. Same figure as the hint beside it, by construction. */}
        <StatCard
          label="Present"
          value={overall.attended}
          icon={<CalendarCheck className="h-6 w-6" aria-hidden />}
          accent="#16A34A"
          hint={`of ${overall.held} held`}
        />
        <StatCard
          label="Sundays in a row"
          value={streak}
          icon={<Flame className="h-6 w-6" aria-hidden />}
          accent="#EA580C"
          hint="Sunday School, most recent first"
        />
        <StatCard
          label="Standing"
          value={RATE_BAND_LABEL[band]}
          tone={band === 'excellent' ? 'good' : band === 'can-do-better' ? 'warn' : band === 'none' ? 'default' : 'bad'}
          icon={<Star className="h-6 w-6" aria-hidden />}
        />
        {/* F0716 — the only points figure on this page was "+N pts" buried in a
            per-session hint, so the child who shows up every week had no answer
            to "what has coming earned me?". Summed from the same per-session
            rows the cards below are built from — each present week is worth its
            session's points, which is exactly what the QR and manual save paths
            award (actions/qr.ts:412-419) — rather than a second query that
            could disagree with the tiles beside it. */}
        <StatCard
          label="Points earned"
          value={bySession.reduce((n, s) => n + s.attended * s.points, 0)}
          hint="From attendance, over this period"
          icon={<Star className="h-6 w-6" aria-hidden />}
          accent="#D97706"
        />
      </div>

      <StreakBanner streak={streak} unit="Sunday streak" />

      {band === 'excellent' && overall.rate !== null && (
        <div className="mb-4">
          <Callout tone="good" title="Well done">Keep it up — you have been here for most of what your class held.</Callout>
        </div>
      )}

      {bySession.length === 0 ? (
        <EmptyState title="Nothing recorded yet" hint="Your attendance shows here once your class starts taking it." />
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {bySession.map((s) => (
              <RateCard key={s.key} label={s.label} rate={s.rate} attended={s.attended} held={s.held} hint={`+${s.points} pts`} />
            ))}
          </div>

          <Card title="Recent">
            {recent.length === 0 ? (
              <p className="text-[12.5px] text-parch-500">Nothing recorded for you yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {recent.map((r) => (
                  <li
                    key={`${r.sessionKey}-${r.date.toISOString()}`}
                    className="flex items-center gap-3 rounded-[12px] border border-[#EFE9DC] bg-parch-100 px-3 py-2"
                  >
                    <span
                      aria-hidden
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{
                        background: r.status === 'PRESENT' ? '#16A34A' : r.status === 'EXCUSED' ? '#B45309' : '#DC2626',
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-bold text-parch-800">{sessionLabel.get(r.sessionKey) ?? r.sessionKey}</p>
                      <p className="text-[11px] text-parch-500">{formatLongDate(formatDateOnly(r.date))}</p>
                    </div>
                    <Badge tone={r.status === 'PRESENT' ? 'good' : r.status === 'EXCUSED' ? 'warn' : 'bad'}>
                      {r.status === 'PRESENT' ? 'Present' : r.status === 'EXCUSED' ? 'Excused' : 'Absent'}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      <p className="mt-4 text-[11px] leading-relaxed text-parch-500">
        A session counts only for the weeks your class recorded it. An excused absence never counts against you.
      </p>
    </>
  )
}

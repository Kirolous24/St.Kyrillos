import Link from 'next/link'
import { Star, CalendarCheck, Trophy, AlertTriangle, History, User, HeartHandshake, Camera, Award, GraduationCap, BookMarked, Flame } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '@/lib/portal/session'
import { requireStudentRead, studentName } from '@/lib/portal/data/students'
import { classTotals } from '@/lib/portal/data/dashboard'
import { can } from '@/lib/portal/permissions'
import { rankStudents, canUndo } from '@/lib/portal/points-math'
import { absenceStreakAgainst } from '@/lib/portal/attendance-rules'
import { presentStreak, readingStreak } from '@/lib/portal/achievements'
import { attendanceRate, heldOccasions, headlineSession, headlineRows } from '@/lib/portal/reports'
import { formatDateOnly, todayInNewYork, ageOn } from '@/lib/portal/dates'
import { formatPhone } from '@/lib/portal/phones'
import { formatLongDate, formatMonthDay, formatDateTime } from '@/lib/portal/format'
import { PageHeader, Card, StatCard, Avatar, Badge, Callout, LinkButton, buttonClass } from '@/components/portal/ui'
import { accentFor } from '@/lib/portal/accents'
import { StudentProfileActions } from './StudentProfileActions'
import { UndoEntryButton } from './PointsLedgerRow'
import { cn } from '@/lib/utils'

/** PointEntry.source, in the words a servant reads on the ledger. */
const POINT_SOURCE_LABEL: Record<string, string> = {
  ATTENDANCE: 'Attendance',
  MANUAL: 'Given',
  QUIZ: 'Quiz',
  UNDO: 'Undo',
  QR: 'QR scan',
}

export default async function StudentPage({ params }: { params: { id: string } }) {
  const user = await requirePortalUser()
  const s = await requireStudentRead(user, params.id)
  const ctx = { classId: s.classId ?? undefined, classStage: s.class?.stage, studentId: s.id }
  const canWrite = can(user, 'student.write', ctx)
  const isSelf = user.studentId === s.id
  const today = todayInNewYork()

  const [entries, attendance, sundayRows, cases, exams, classmates, heldSundays, readingDates] = await Promise.all([
    prisma.pointEntry.findMany({
      where: { studentId: s.id },
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: { id: true, points: true, activityLabel: true, reason: true, source: true, undone: true, undoOfId: true, createdAt: true, createdBy: { select: { displayName: true } } },
    }),
    // Display only: the most recent marks across every session, for the card.
    prisma.attendanceRecord.findMany({
      where: { studentId: s.id },
      orderBy: { date: 'desc' },
      take: 60,
      select: { id: true, date: true, sessionKey: true, status: true, reason: true },
    }),
    // The Sunday rate is scored over the whole record, not a slice of it: a
    // window of 60 rows across every session would leave a class that records
    // six sessions a week with ten Sundays and a Sunday-only class with sixty.
    prisma.attendanceRecord.findMany({
      where: { studentId: s.id },
      orderBy: { date: 'desc' },
      select: { date: true, status: true, sessionKey: true },
    }),
    prisma.followUpCase.findMany({ where: { studentId: s.id }, orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, title: true, status: true, createdAt: true } }),
    // The prototype's exam-history card (OG L5061-5067): last ten, newest
    // first, green at 70% and above. The port dropped it entirely, so a
    // servant asked "how is she doing in the quizzes?" had nowhere to look.
    prisma.quizResult.findMany({
      where: { studentId: s.id },
      orderBy: { submittedAt: 'desc' },
      take: 10,
      select: { id: true, score: true, total: true, percentage: true, submittedAt: true, exam: { select: { id: true, title: true } } },
    }),
    s.classId ? prisma.student.findMany({ where: { classId: s.classId }, select: { id: true, firstName: true, lastName: true } }) : Promise.resolve([]),
    // Class-wide, not student-scoped: a Sunday the class held but this
    // student has no row for (e.g. everyone else checked in by group QR)
    // still has to count against them.
    s.classId
      ? prisma.attendanceRecord.findMany({ where: { classId: s.classId }, distinct: ['sessionKey', 'date'], select: { date: true, sessionKey: true } })
      : Promise.resolve([]),
    // The prototype's Bible Reading Streak card (F0395). The log already
    // exists and already feeds the reading badges; the profile never read it.
    prisma.bibleReadingLog.findMany({
      where: { studentId: s.id },
      orderBy: { date: 'desc' },
      take: 400,
      select: { date: true },
    }),
  ])
  /**
   * F0175 / F0399 — a mistake and its correction, on the page a parent reads.
   *
   * A servant gives fifty points by mistake and undoes it. The ledger keeps both
   * lines, which is right: this is a child's points history and the record of
   * what happened should not be falsifiable for the sake of tidiness. But the
   * complaint behind this was a parent being shown "+50 Memory verse" struck
   * through, followed by "−50", and asking about it — two lines that net to
   * nothing and mean nothing to them.
   *
   * So the pair is hidden from the child's own view of their ledger and stays in
   * full for every servant, admin and pastor. Nothing is erased, the total is
   * computed from the stored sum and so is unaffected, and reversing this is a
   * one-line change — which is exactly why hiding was chosen over deleting.
   */
  const correctedIds = new Set<string>()
  for (const e of entries) {
    if (e.undoOfId) {
      correctedIds.add(e.id)
      correctedIds.add(e.undoOfId)
    }
  }
  const visibleEntries = isSelf ? entries.filter((e) => !correctedIds.has(e.id)) : entries
  const correctedHidden = entries.length - visibleEntries.length

  const totals = await classTotals(s.classId ? [s.classId] : [])
  const total = entries.length ? (await prisma.pointEntry.aggregate({ where: { studentId: s.id }, _sum: { points: true } }))._sum.points ?? 0 : 0
  const rank = rankStudents(classmates.map((c) => ({ studentId: c.id, name: studentName(c), total: totals.get(c.id) ?? 0 }))).find((r) => r.studentId === s.id)?.rank
  const allRows = sundayRows.map((a) => ({
    studentId: s.id,
    sessionKey: a.sessionKey,
    date: formatDateOnly(a.date),
    status: a.status,
  }))
  const heldAll = heldSundays.map((r) => ({ sessionKey: r.sessionKey, date: formatDateOnly(r.date) }))

  // The displayed rate follows the class: Sunday School where it is recorded,
  // otherwise whatever the class does record — a child in a Bible-study class
  // used to read "No sessions yet" on their own profile.
  const headlineKey = headlineSession(allRows)
  const rateRows = headlineRows(allRows)
  const rate = attendanceRate(rateRows, {
    occasions: heldOccasions(headlineKey ? heldAll.filter((h) => h.sessionKey === headlineKey) : heldAll),
    studentIds: [s.id],
  })

  // The absence streak stays Sunday-only on purpose: it is what raises a
  // follow-up case, and the church's rule is about missed Sundays. Widening it
  // here would quietly change who gets a case.
  const sundayDates = heldAll.filter((h) => h.sessionKey === 'sunday').map((h) => h.date)
  const sunday = allRows.filter((r) => r.sessionKey === 'sunday').map((r) => ({ date: r.date, status: r.status }))
  const streak = absenceStreakAgainst(sundayDates, sunday)
  // The prototype's Avg Score stat (F0393). `exams` is already loaded for the
  // card below, so this is arithmetic rather than another query. It is the
  // last ten, which is what the card shows — a stat that averaged everything
  // while the card listed ten would be two numbers for one question.
  const quizAverage = exams.length
    ? Math.round(exams.reduce((n, e) => n + e.percentage, 0) / exams.length)
    : null

  const readingDays = readingDates.map((r) => formatDateOnly(r.date))
  const reading = { streak: readingStreak(readingDays, today), today: readingDays.includes(today) }

  const sessionLabels = new Map((await prisma.attendanceSession.findMany({ select: { key: true, label: true } })).map((x) => [x.key, x.label]))
  const accent = accentFor(s.id)

  return (
    <>
      <PageHeader
        title={studentName(s)}
        subtitle={
          <>
            {!s.class ? 'No class' : isSelf ? (
              s.class.name
            ) : (
              <Link href={`/portal/classes/${s.class.id}`} className="underline-offset-2 hover:underline">{s.class.name}</Link>
            )}
            {s.dob && ` · ${ageOn(formatDateOnly(s.dob), today)} years old · born ${formatLongDate(formatDateOnly(s.dob))}`}
            {!isSelf && ` · ID ${s.account.loginId}`}
          </>
        }
        back={s.class && !isSelf ? { href: `/portal/classes/${s.class.id}`, label: s.class.name } : undefined}
        actions={
          <>
            {canWrite && (
              <>
                <LinkButton href={`/portal/students/${s.id}/edit`} variant="secondary">Edit</LinkButton>
              {/* /portal/photo was a fully working orphan — the uploader and both
                  server actions existed but nothing in the portal linked to them,
                  so no one could change a student's picture. The OG reached it by
                  clicking the avatar in the Edit Student modal (L10374). */}
                <LinkButton href={`/portal/photo?student=${s.id}`} variant="secondary">
                  <Camera className="h-4 w-4" aria-hidden /> Photo
                </LinkButton>
              {/* The report-card page always rendered the whole class, so handing
                  one family their child's sheet meant printing everyone's. */}
              </>
            )}
            {/* Outside the write gate on purpose: printing is read-only, and the
                pastor — who has no student.write — is exactly who hands a
                report card or a certificate to a family. That is how the class
                print buttons went missing. */}
            {!isSelf && s.classId && (
              <LinkButton
                href={`/portal/reports/cards?class=${encodeURIComponent(s.classId)}&student=${s.id}`}
                variant="secondary"
              >
                <Award className="h-4 w-4" aria-hidden /> Report card
              </LinkButton>
            )}
            {!isSelf && (
              <LinkButton href={`/portal/students/${s.id}/certificate`} variant="secondary">
                <Award className="h-4 w-4" aria-hidden /> Certificate
              </LinkButton>
            )}
          </>
        }
      />

      {s.importNotes && canWrite && (
        <div className="mb-3.5">
          <Callout tone="warn" title="Needs review">{s.importNotes}</Callout>
        </div>
      )}

      {/* Profile header: large avatar on a cream card with a gold left edge */}
      <div className="mb-3.5 flex flex-wrap items-center gap-4 rounded-[16px] border border-parch-200 border-l-4 border-l-brand-gold bg-parch-50 p-5 shadow-panel">
        <span className="shrink-0" style={{ borderRadius: '9999px', boxShadow: `0 0 0 3px ${accent}33` }}>
          <Avatar name={studentName(s)} photo={s.account.photo} size="xl" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-serif text-[21px] font-bold leading-tight text-parch-900">{studentName(s)}</p>
          <p className="mt-0.5 text-[12.5px] text-parch-500">
            {[s.grade ? `Grade ${s.grade}` : null, s.gender ? (s.gender === 'male' ? 'Boy' : 'Girl') : null, s.class?.name ?? 'No class']
              .filter(Boolean)
              .join(' · ')}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {rank && <Badge tone="gold">Rank #{rank}{classmates.length ? ` of ${classmates.length}` : ''}</Badge>}
            {streak >= (s.class?.visitationThreshold ?? 2) && <Badge tone="bad">{streak} missed in a row</Badge>}
            {!isSelf && <Badge tone="neutral">ID {s.account.loginId}</Badge>}
          </div>
        </div>
      </div>

      {/* F0141 / F0206 / F0394 — three findings, one tile. Six across now, so
          the row wraps 2/3/6 rather than five plus an orphan. */}
      <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Points" value={total} icon={<Star className="h-6 w-6" />} accent="#D97706" />
        {/* The profile named only what a child had missed. A servant ringing a
            family that has turned a corner had nothing on the page to open with,
            and "Missed in a row: 0" is not the same sentence as "here six
            Sundays running". The class roster already shows this number as a
            "6w streak" pill (F0387) and /portal/my-attendance shows the child
            their own, so the one page a servant opens before making the call was
            the only one without it — the two people on that phone call had no
            number in common. Scored with the same presentStreak() over the same
            headline rows as the roster, so the two cannot drift apart. */}
        <StatCard
          label="Present in a row"
          value={presentStreak(rateRows.map((r) => ({ date: r.date, status: r.status })))}
          hint={headlineKey === 'sunday' ? 'Sundays attended in a row' : 'Sessions attended in a row'}
          icon={<Flame className="h-6 w-6" />}
          accent="#16A34A"
        />
        <StatCard
          label={headlineKey === 'sunday' ? 'Sunday attendance' : 'Attendance'}
          value={rate.rate === null ? '—' : `${rate.rate}%`}
          /* F0392 — the prototype broke the misses down. "8 of 10" alone
             cannot tell a servant whether the two gone were excused, which is
             the difference between a child who was away and one who stopped
             coming. An excused absence is already out of the denominator, so
             it is reported separately rather than folded into the rate. */
          hint={`${rate.attended} of ${rate.held}${headlineKey === 'sunday' ? '' : ' · all sessions'}${
            rate.absent > 0 || rate.excused > 0
              ? ` · ${rate.absent} unexcused${rate.excused > 0 ? ` · ${rate.excused} excused` : ''}`
              : ''
          }`}
          tone={rate.rate === null ? 'default' : rate.rate >= 80 ? 'good' : rate.rate >= 50 ? 'warn' : 'bad'}
          icon={<CalendarCheck className="h-6 w-6" />}
          accent={rate.rate === null ? '#7C7A7A' : rate.rate >= 80 ? '#16A34A' : rate.rate >= 50 ? '#D97706' : '#DC2626'}
        />
        <StatCard
          label="Avg score"
          value={quizAverage === null ? '—' : `${quizAverage}%`}
          hint={exams.length ? `over ${exams.length} quiz${exams.length === 1 ? '' : 'zes'}` : 'none sat yet'}
          tone={quizAverage === null ? 'default' : quizAverage >= 70 ? 'good' : 'warn'}
          icon={<GraduationCap className="h-6 w-6" />}
          accent={quizAverage === null ? '#7C7A7A' : quizAverage >= 70 ? '#16A34A' : '#D97706'}
        />
        <StatCard
          label="Class rank"
          value={rank ? `#${rank}` : '—'}
          hint={classmates.length ? `of ${classmates.length}` : undefined}
          icon={<Trophy className="h-6 w-6" />}
          accent="#4F46E5"
        />
        <StatCard
          label="Missed in a row"
          value={streak}
          tone={streak >= (s.class?.visitationThreshold ?? 2) ? 'bad' : streak > 0 ? 'warn' : 'good'}
          icon={<AlertTriangle className="h-6 w-6" />}
          accent={streak >= (s.class?.visitationThreshold ?? 2) ? '#DC2626' : streak > 0 ? '#D97706' : '#16A34A'}
        />
      </div>

      <div className="grid gap-3.5 lg:grid-cols-3">
        <div className="space-y-3.5 lg:col-span-2">
          <Card title="Points ledger" icon={<History className="h-[15px] w-[15px]" />}>
            {visibleEntries.length === 0 ? <p className="text-[12.5px] text-parch-500">No points yet.</p> : (
              <ul className="divide-y divide-[#F5F2ED]">
                {visibleEntries.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 py-2 text-[12.5px]">
                    <span
                      className="w-12 shrink-0 text-right text-[13px] font-extrabold tabular-nums"
                      style={{ color: e.undone ? '#A9A49B' : e.points >= 0 ? '#16A34A' : '#DC2626', textDecoration: e.undone ? 'line-through' : undefined }}
                    >
                      {e.points >= 0 ? '+' : ''}{e.points}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={e.undone ? 'text-parch-400 line-through' : 'text-parch-800'}>{e.activityLabel}{e.reason ? ` — ${e.reason}` : ''}</p>
                      {/* Type and servant, as the prototype's ledger carried
                          them (OG L5102-5142): without the type a servant
                          cannot tell a quiz score from a hand-given point,
                          which is the question that comes up when a total looks
                          wrong. */}
                      <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-parch-500">
                        <span className="rounded-[20px] bg-parch-200/70 px-2 py-[1px] font-bold text-parch-600">
                          {POINT_SOURCE_LABEL[e.source] ?? e.source}
                        </span>
                        {formatDateTime(e.createdAt)}{!isSelf && e.createdBy ? ` · ${e.createdBy.displayName}` : ''}
                      </p>
                    </div>
                    {canWrite && canUndo(e) ? (
                      <UndoEntryButton entryId={e.id} label={`${e.points >= 0 ? '+' : ''}${e.points} ${e.activityLabel}`} />
                    ) : canWrite && e.source === 'ATTENDANCE' && !e.undone && s.classId ? (
                      /* F0424 — the same pointer the class points page carries
                         (F0178), on the page a servant is actually looking at
                         when they notice. Attendance points follow the register,
                         so cancelling one here would leave the ledger and the
                         sheet disagreeing; the old prototype allowed exactly that
                         and it was simply wrong. What was missing was not the
                         control — it was anything at all telling the servant
                         where the row lives, so they found no button and assumed
                         the points were stuck. */
                      <Link
                        href={`/portal/classes/${s.classId}/attendance`}
                        className={cn(
                          buttonClass('ghost', 'sm'),
                          'min-h-[40px] max-w-[104px] shrink-0 whitespace-normal px-2 text-right text-[11px] leading-tight',
                        )}
                      >
                        Fix on the attendance sheet
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {/* F0175 — said out loud rather than done silently. A total that does
                not add up to the lines shown is worse than the two lines were. */}
            {correctedHidden > 0 && (
              <p className="mt-2.5 text-[11.5px] text-parch-500">
                {correctedHidden === 2 ? 'One entry was' : `${correctedHidden / 2} entries were`} corrected by a
                servant and cancelled out. Your total already allows for that.
              </p>
            )}
          </Card>

          {/* Exam results — the prototype's card, restored. Ten most recent,
              green from 70%, and each row opens that exam's own page. */}
          <Card title={`Exam results${exams.length ? ` (${exams.length})` : ''}`} icon={<GraduationCap className="h-[15px] w-[15px]" />}>
            {exams.length === 0 ? (
              <p className="text-[12.5px] text-parch-500">No quizzes taken yet.</p>
            ) : (
              <ul className="divide-y divide-[#F5F2ED] text-[12.5px]">
                {exams.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-2 py-1.5">
                    <span className="min-w-0 flex-1">
                      {canWrite ? (
                        <Link href={`/portal/exams/${e.exam.id}`} className="block truncate font-semibold text-parch-800 hover:underline">
                          {e.exam.title}
                        </Link>
                      ) : (
                        <span className="block truncate font-semibold text-parch-800">{e.exam.title}</span>
                      )}
                      <span className="block text-[11px] text-parch-500">
                        {e.score}/{e.total}
                        {e.submittedAt ? ` · ${formatMonthDay(formatDateOnly(e.submittedAt))}` : ''}
                      </span>
                    </span>
                    <span
                      className="shrink-0 text-[15px] font-bold tabular-nums"
                      style={{ color: e.percentage >= 70 ? '#16A34A' : '#DC2626' }}
                    >
                      {e.percentage}%
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* F0395 — the prototype's Bible Reading Streak card. The log has
              existed since the reading badges were built; nothing read it on
              the profile, so a servant could not see the one habit the portal
              asks a child to keep daily. Shown only once there is a reading
              to report: a card that always says "0 days" trains people to
              ignore it. */}
          {readingDays.length > 0 && (
            <Card title="Bible reading" icon={<BookMarked className="h-[15px] w-[15px]" />}>
              <div className="flex items-center gap-3">
                <span className="text-[30px] font-bold leading-none tabular-nums text-brand-800">
                  {reading.streak}
                </span>
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-semibold text-parch-800">
                    day{reading.streak === 1 ? '' : 's'} in a row
                  </span>
                  <span className="block text-[11px] text-parch-500">
                    {readingDays.length} day{readingDays.length === 1 ? '' : 's'} read in total
                  </span>
                </span>
                <span className="ml-auto shrink-0">
                  {reading.today ? <Badge tone="good">Read today</Badge> : <Badge tone="neutral">Not yet today</Badge>}
                </span>
              </div>
            </Card>
          )}

          <Card title="Attendance" icon={<CalendarCheck className="h-[15px] w-[15px]" />}>
            {attendance.length === 0 ? <p className="text-[12.5px] text-parch-500">No attendance recorded yet.</p> : (
              <ul className="divide-y divide-[#F5F2ED] text-[12.5px]">
                {attendance.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 py-1.5">
                    <span className="text-parch-800">{formatMonthDay(formatDateOnly(a.date))} · {sessionLabels.get(a.sessionKey) ?? a.sessionKey}</span>
                    <Badge tone={a.status === 'PRESENT' ? 'good' : a.status === 'EXCUSED' ? 'warn' : 'bad'}>
                      {a.status === 'PRESENT' ? 'Present' : a.status === 'EXCUSED' ? `Excused${a.reason ? ` (${a.reason})` : ''}` : 'Absent'}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-3.5">
          {!isSelf && (
            <Card title="Family & contact" icon={<User className="h-[15px] w-[15px]" />}>
              <dl className="space-y-2.5 text-[12.5px]">
                {/* The child's own details, which the port captured nowhere. */}
                {s.account.phone || s.account.email ? (
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">Student</dt>
                    <dd className="break-all text-parch-800">
                      {s.account.phone && <a className="font-semibold text-brand-800" href={`tel:${s.account.phone}`}>{formatPhone(s.account.phone)}</a>}
                      {s.account.phone && s.account.email ? ' · ' : null}
                      {s.account.email && <a className="font-semibold text-brand-800" href={`mailto:${s.account.email}`}>{s.account.email}</a>}
                    </dd>
                  </div>
                ) : null}
                {s.fatherName || s.fatherPhone ? (
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">Father</dt>
                    <dd className="text-parch-800">{s.fatherName}{s.fatherPhone && <> · <a className="font-semibold text-brand-800" href={`tel:${s.fatherPhone}`}>{formatPhone(s.fatherPhone)}</a></>}</dd>
                  </div>
                ) : null}
                {s.motherName || s.motherPhone ? (
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">Mother</dt>
                    <dd className="text-parch-800">{s.motherName}{s.motherPhone && <> · <a className="font-semibold text-brand-800" href={`tel:${s.motherPhone}`}>{formatPhone(s.motherPhone)}</a></>}</dd>
                  </div>
                ) : null}
                {s.parentEmails.length > 0 && (
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">Parent email</dt>
                    <dd className="break-all">{s.parentEmails.map((e) => <a key={e} href={`mailto:${e}`} className="block font-semibold text-brand-800">{e}</a>)}</dd>
                  </div>
                )}
                {s.address && <div><dt className="text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">Address</dt><dd className="text-parch-800">{s.address}</dd></div>}
                {s.notes && <div><dt className="text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">Notes</dt><dd className="whitespace-pre-wrap text-parch-800">{s.notes}</dd></div>}
                <div><dt className="text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">Last sign-in</dt><dd className="text-parch-800">{s.account.lastLoginAt ? formatDateTime(s.account.lastLoginAt) : 'Never'}</dd></div>
              </dl>
            </Card>
          )}

          {!isSelf && cases.length > 0 && (
            <Card title="Follow-up cases" icon={<HeartHandshake className="h-[15px] w-[15px]" />}>
              <ul className="space-y-2 text-[12.5px]">
                {cases.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2">
                    <Link href={`/portal/follow-ups/${c.id}`} className="truncate text-parch-800 underline-offset-2 hover:text-brand-800 hover:underline">{c.title}</Link>
                    <Badge tone={c.status === 'OPEN' ? 'bad' : 'neutral'}>{c.status === 'OPEN' ? 'Open' : 'Done'}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {canWrite && (
            <StudentProfileActions studentId={s.id} hasImportNotes={!!s.importNotes} isAdmin={user.role === 'ADMIN'} loginEnabled={s.account.isActive} />
          )}
        </div>
      </div>
    </>
  )
}

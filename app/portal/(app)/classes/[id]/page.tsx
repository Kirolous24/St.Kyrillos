import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Users, UserCog, Star, CalendarCheck, QrCode, Printer, KeyRound, MessageSquare, BookOpen, ClipboardList, HeartHandshake, Camera, Trophy, History } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { cn } from '@/lib/utils'
import { requirePortalUser } from '@/lib/portal/session'
import { requireClassAccess } from '@/lib/portal/data/classes'
import { PhotoUpload } from '@/components/portal/PhotoUpload'
import { setClassPhoto, removeClassPhoto } from '@/lib/portal/actions/photos'
import { classTotals } from '@/lib/portal/data/dashboard'
import { classMonthDigest } from '@/lib/portal/data/class-digest'
import { presentStreak } from '@/lib/portal/achievements'
import { studentName } from '@/lib/portal/data/students'
import { can } from '@/lib/portal/permissions'
import { rankStudents } from '@/lib/portal/points-math'
import { attendanceRate, heldOccasions, headlineSession, headlineRows, monthOf, type AttendanceRow } from '@/lib/portal/reports'
import { PageHeader, Card, StatCard, Avatar, Badge, EmptyState, LinkButton, SectionTitle } from '@/components/portal/ui'
import { STAGE_LABEL, TITLE_LABEL, timeAgo } from '@/lib/portal/format'
import { accentFor } from '@/lib/portal/accents'
import { RosterExportButton } from './RosterExportButton'
import { RosterFilter } from './RosterFilter'
import { formatDateOnly, todayInNewYork, ageOn } from '@/lib/portal/dates'

export default async function ClassPage({ params, searchParams }: { params: { id: string }; searchParams: { q?: string } }) {
  const user = await requirePortalUser()
  // `class.read` is granted to a student for their own class (the feed and
  // leaderboard need it), but the staff roster below shows every classmate's
  // attendance rate, follow-up flag and import notes. Staff only.
  if (user.role === 'STUDENT') notFound()
  const cls = await requireClassAccess(user, params.id, 'class.read')
  const ctx = { classId: cls.id, classStage: cls.stage }
  const canWrite = can(user, 'attendance.write', ctx)
  const canEditStudents = can(user, 'student.write', ctx)

  const [students, servants, openCases, sundayRows, quizByStudent, recentPoints] = await Promise.all([
    prisma.student.findMany({
      where: { classId: cls.id },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      select: { id: true, firstName: true, lastName: true, dob: true, grade: true, importNotes: true, account: { select: { photo: true, loginId: true } } },
    }),
    prisma.classServant.findMany({
      where: { classId: cls.id },
      orderBy: [{ title: 'asc' }, { sortOrder: 'asc' }],
      select: { title: true, servant: { select: { id: true, account: { select: { displayName: true, photo: true, phone: true } } } } },
    }),
    prisma.followUpCase.findMany({ where: { classId: cls.id, status: 'OPEN' }, select: { studentId: true } }),
    // Every session, not just Sunday School: which one this class's headline
    // rate is scored on is decided below, so a class whose register is Bible
    // Study no longer reads "No sessions yet" while its attendance sits in the
    // reports.
    prisma.attendanceRecord.findMany({
      where: { classId: cls.id },
      select: { studentId: true, date: true, status: true, sessionKey: true },
    }),
    // The prototype's roster cards carried a quiz-average pill beside the
    // attendance one (F0386). One grouped query for the whole class.
    prisma.quizResult.groupBy({
      by: ['studentId'],
      where: { classId: cls.id },
      _avg: { percentage: true },
      _count: { _all: true },
    }),
    /* F0342 — the prototype's "Recent Activity" preview. The class page is the
       hub a servant opens first, and it could tell them the class's totals but
       not the last thing that happened in it: "did Abanoub already get his point
       for the memory verse?" meant opening the points page and searching. Six
       rows, with a link to the full ledger rather than a second copy of it.
       Reversals are excluded — an undo and the row it cancels would otherwise
       fill the preview with a pair that nets to nothing. */
    prisma.pointEntry.findMany({
      where: { classId: cls.id, undone: false, undoOfId: null },
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: {
        id: true,
        points: true,
        activityLabel: true,
        createdAt: true,
        student: { select: { firstName: true, lastName: true } },
      },
    }),
  ])
  const totals = await classTotals([cls.id])
  const digest = await classMonthDigest(user, cls.id, monthOf(todayInNewYork()))
  const ranked = new Map(
    rankStudents(students.map((s) => ({ studentId: s.id, name: studentName(s), total: totals.get(s.id) ?? 0 }))).map((r) => [r.studentId, r]),
  )
  const openSet = new Set(openCases.map((c) => c.studentId))
  const today = todayInNewYork()

  // Scored the same way as the official Reports page: one verdict per (student,
  // week), every student on the roster expected at every Sunday the class held,
  // and an EXCUSED row taken out of that student's denominator. Counting rows
  // instead would score a student against only the Sundays they have a row for.
  const allMarks: AttendanceRow[] = sundayRows.map((r) => ({
    studentId: r.studentId,
    sessionKey: r.sessionKey,
    date: formatDateOnly(r.date),
    status: r.status,
  }))
  // Sunday School when the class records it — so no existing figure moves —
  // otherwise everything it does record.
  const headlineKey = headlineSession(allMarks)
  const marks = headlineRows(allMarks)
  const occasions = heldOccasions(marks)
  const roster = students.map((s) => s.id)

  const quizAvgByStudent = new Map(
    quizByStudent.map((q) => [q.studentId, q._avg.percentage === null ? null : Math.round(q._avg.percentage)]),
  )
  // The prototype's "Nw streak" pill (F0387): consecutive sessions attended,
  // counting back from the most recent. Read off the marks already loaded, and
  // scored on the same headline session as the attendance pill beside it so
  // the two pills cannot describe different registers.
  const streakByStudent = new Map(
    students.map((s) => [
      s.id,
      presentStreak(marks.filter((m) => m.studentId === s.id).map((m) => ({ date: m.date, status: m.status }))),
    ]),
  )

  // Roster search, restored from the prototype's Students page. It filters as
  // you type in <RosterFilter>; `?q=` is only the starting value, so a link to
  // a filtered roster still opens filtered. Rank and the class stats above are
  // always computed across the whole class, never the filtered slice.
  const q = (searchParams.q ?? '').trim()
  const perStudent = new Map(
    roster.map((id) => [id, attendanceRate(marks.filter((m) => m.studentId === id), { occasions, studentIds: [id] })]),
  )
  const classWide = attendanceRate(marks, { occasions, studentIds: roster })
  const classPresent = classWide.attended
  const classHeld = classWide.held
  const classRate = classWide.rate
  const pointsSum = students.reduce((n, s) => n + (totals.get(s.id) ?? 0), 0)
  const avgPoints = students.length ? Math.round(pointsSum / students.length) : 0

  return (
    <>
      <PageHeader
        title={cls.name}
        subtitle={`${STAGE_LABEL[cls.stage]} · ${students.length} students · ${servants.length} servants`}
        back={{ href: '/portal/classes', label: 'Classes' }}
        /* F0153 — the class's photo, shown on the page that offers the upload.
           Without it the control saved an image that was drawn nowhere: a
           servant would set a photo, see the preview, and never find it again. */
        icon={
          cls.photo ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={cls.photo}
              alt=""
              className="h-8 w-8 rounded-[9px] border border-brand-gold/60 object-cover"
            />
          ) : undefined
        }
        actions={
          /* Printing and exporting are read-only, so they are offered to anyone
             who may open the class — including the pastor, who is precisely the
             person who prints. Gating them behind attendance.write hid them from
             that role entirely. Only the write actions below are gated. */
          <>
            {canWrite && (
              <>
                <LinkButton href={`/portal/classes/${cls.id}/attendance`}>Take attendance</LinkButton>
                <LinkButton href={`/portal/classes/${cls.id}/points`} variant="secondary">Points</LinkButton>
                {canEditStudents && <LinkButton href={`/portal/classes/${cls.id}/students/new`} variant="secondary">Add student</LinkButton>}
              {/* Restored from the prototype's class profile header (OG L4830-4831),
                  where these were the only route to either printout. The port moved
                  them to /portal/qr and /portal/reports, so admins who knew the OG
                  came here and found nothing. Both pages accept ?class=, so these
                  land pre-scoped to this class. */}
                <LinkButton href={`/portal/qr/cards?class=${cls.id}`} variant="secondary">
                  <QrCode className="h-4 w-4" aria-hidden /> Print QR Codes
                </LinkButton>
                <RosterExportButton classId={cls.id} />
              </>
            )}
            {/* Admin only, and it lives behind its own confirm: the prototype's
                plaintext PIN export cannot be copied (PINs are hashed), so the
                equivalent is to reset and print them once. */}
            {user.role === 'ADMIN' && (
              <LinkButton href={`/portal/classes/${cls.id}/credentials`} variant="secondary">
                <KeyRound className="h-4 w-4" aria-hidden /> Logins &amp; PINs
              </LinkButton>
            )}
            {/* F0278 — the class profile had no route to the class's own feed,
                so a servant looking for "what did we post to this class?" had to
                go to Posts and pick the class again. /portal/feed already takes
                ?class=, and the page carries no role gate, so this is reachable
                by everyone who can open the class. Read-only, hence outside the
                write gate above. */}
            <LinkButton href={`/portal/feed?class=${cls.id}`} variant="secondary">
              <MessageSquare className="h-4 w-4" aria-hidden /> Class posts
            </LinkButton>
            {/* F0542 — the prototype's class workspace put Lesson Prep and
                Exams one click from the class; here a servant had to open each
                page and pick the class over again. Both destinations validate
                ?class= against what the viewer may already see.

                Lesson Prep is behind canWrite because /portal/lessons falls
                back to the viewer's first *writable* class when ?class= is not
                one of them — a stage coordinator would otherwise land silently
                on somebody else's lesson plan believing it was this class's.
                Exams validates against every visible class, so it needs no gate
                and stays available to the pastor, who reaches this page too.

                QR scan and Follow-ups are deliberately not here: neither page
                reads ?class= at all (qr/page.tsx takes only tab/mode,
                follow-ups/page.tsx only show), so those links would look scoped
                and quietly not be. */}
            {canWrite && (
              <LinkButton href={`/portal/lessons?class=${cls.id}`} variant="secondary">
                {/* F0227 — named for the page it opens, which the rail also
                    now calls "Lessons". */}
                <BookOpen className="h-4 w-4" aria-hidden /> Lessons
              </LinkButton>
            )}
            <LinkButton href={`/portal/exams?class=${cls.id}`} variant="secondary">
              <ClipboardList className="h-4 w-4" aria-hidden /> Exams
            </LinkButton>
            <LinkButton href={`/portal/reports/cards?class=${cls.id}`} variant="secondary">
              <Printer className="h-4 w-4" aria-hidden /> Print Report Cards
            </LinkButton>
            {/* The prototype's own class-report printout (printServantClassReport,
                OG L4831/L18034): the class's own numbers with every student's
                row, one click, no filters to set first. */}
            <LinkButton href={`/portal/reports/class/${cls.id}`} variant="secondary">
              <Printer className="h-4 w-4" aria-hidden /> Print Class Report
            </LinkButton>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Students" value={students.length} icon={<Users className="h-6 w-6" />} accent="#16A34A" />
        <StatCard label="Servants" value={servants.length} icon={<UserCog className="h-6 w-6" />} accent="#DC2626" />
        <StatCard label="Avg points" value={avgPoints} hint="per student" icon={<Star className="h-6 w-6" />} accent="#D97706" />
        {/* F0336 — pointsSum was computed above and then only ever divided by the
            roster. The average hides the size of the class: forty points a head
            is a very different year in a class of six and a class of thirty, and
            the total is the number a coordinator quotes when this class is set
            beside the one next door. */}
        <StatCard
          label="Total points"
          value={pointsSum.toLocaleString()}
          hint="awarded all time"
          icon={<Star className="h-6 w-6" />}
          accent="#C89B3C"
        />
        {/* Named for what it actually counts, so the number is never read as
            something it is not. */}
        <StatCard
          label={headlineKey === 'sunday' ? 'Sunday rate' : 'Attendance'}
          value={classRate === null ? '—' : `${classRate}%`}
          hint={classHeld ? `${classPresent} of ${classHeld}${headlineKey === 'sunday' ? '' : ' · all sessions'}` : 'No sessions yet'}
          tone={classRate === null ? 'default' : classRate >= 85 ? 'good' : classRate >= 60 ? 'warn' : 'bad'}
          icon={<CalendarCheck className="h-6 w-6" />}
          accent={classRate === null ? '#7C7A7A' : classRate >= 85 ? '#16A34A' : classRate >= 60 ? '#D97706' : '#DC2626'}
        />
        {/* F0150 — the prototype's class profile carried Follow-up / Open Cases
            as its fourth headline tile. Here the only aggregate lived inside
            the Monthly Digest, where an all-time number sat among month-scoped
            ones — so a servant reading "3" next to "this month" could not tell
            whether three children are waiting now or waited in March. It is a
            lifetime figure and it belongs with the other lifetime figures.
            `openCases` is already loaded above, so this costs no query, and it
            sits outside every write gate — the pastor needs it most. */}
        <StatCard
          label="Open cases"
          value={openCases.length}
          hint={openCases.length === 0 ? 'nobody waiting' : 'waiting to be visited'}
          tone={openCases.length === 0 ? 'good' : 'warn'}
          icon={<HeartHandshake className="h-6 w-6" />}
          accent={openCases.length === 0 ? '#16A34A' : '#D97706'}
        />
      </div>

      {/* Monthly Digest — deliberately outside every canWrite branch: it is a
          read-only summary, and putting read-only things behind a write gate is
          exactly how the print buttons got hidden from the pastor. */}
      <Card
        className="mb-5"
        title={`${digest.label} so far`}
        icon={<CalendarCheck className="h-4 w-4" aria-hidden />}
        action={
          digest.openCases > 0 ? (
            <Badge tone="warn">{digest.openCases} open follow-up{digest.openCases === 1 ? '' : 's'}</Badge>
          ) : (
            <Badge tone="good">No open follow-ups</Badge>
          )
        }
      >
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            {
              k: 'Attendance',
              v: digest.attendanceRate === null ? '—' : `${digest.attendanceRate}%`,
              hint: digest.held > 0 ? `${digest.attended} of ${digest.held}` : 'nothing recorded',
            },
            { k: 'Points given', v: digest.pointsAwarded.toLocaleString(), hint: 'this month' },
            {
              k: 'Quiz average',
              v: digest.quizAverage === null ? '—' : `${digest.quizAverage}%`,
              hint: `${digest.quizzesSat} sat`,
            },
            { k: 'New students', v: digest.newStudents, hint: 'joined this month' },
            /* F0337 — "Open cases / all time" used to sit here, which is the
               confusion F0150 names: an all-time figure among month-scoped ones.
               It now has its own tile in the lifetime strip above, and the card
               header still flags whether anyone is waiting, so the count is not
               lost — it is only stated once, in the right place.
               F0339 — the slot goes to the month's top student, the one name a
               month-scoped card could not give: the class leaderboard is all-time,
               so a child who turned a corner in November is invisible on it
               behind a year of somebody else's points. */
            {
              k: 'Top this month',
              v: digest.topStudent ? digest.topStudent.name : '—',
              hint: digest.topStudent ? `${digest.topStudent.points} points` : 'no points yet this month',
            },
          ].map((d) => (
            <div key={d.k} className="rounded-[12px] border border-[#EFE9DC] bg-parch-100 px-3 py-2.5">
              <dt className="text-[10.5px] font-bold uppercase tracking-[0.8px] text-parch-500">{d.k}</dt>
              <dd className="mt-0.5 text-[19px] font-bold leading-none tabular-nums text-parch-900">{d.v}</dd>
              <dd className="mt-1 text-[11px] text-parch-500">{d.hint}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionTitle>Roster</SectionTitle>
          {students.length === 0 ? (
            <EmptyState
              title="No students in this class yet"
              hint="Add your first student to get started."
              action={canEditStudents ? <LinkButton href={`/portal/classes/${cls.id}/students/new`}>Add student</LinkButton> : undefined}
            />
          ) : (
            /* The cards stay server-rendered — they carry figures that belong
               there — and are handed to the filter as nodes, so filtering as
               you type costs no round trip and duplicates no markup. */
            <RosterFilter
              initial={q}
              total={students.length}
              items={students.map((s) => {
                const r = ranked.get(s.id)
                const pct = perStudent.get(s.id)?.rate ?? null
                const accent = accentFor(s.id)
                return {
                  id: s.id,
                  text: [studentName(s), s.account.loginId, s.grade ?? ''].join(' ').toLowerCase(),
                  node: (
                  /* `block` is load-bearing: a Next <Link> renders an <a>, which
                     is display:inline by default, so an inline box wrapping these
                     block spans fragments across lines — the card came apart into
                     narrow slivers, each carrying its own coloured top border, in
                     between the ones that happened to fit. Tailwind's preflight
                     does not set a display on anchors, so it has to be said. */
                  <Link
                    key={s.id}
                    href={`/portal/students/${s.id}`}
                    className="block rounded-[14px] border border-parch-200 bg-parch-50 px-3.5 py-[18px] text-center shadow-card transition-shadow hover:shadow-panel"
                    style={{ borderTop: `3px solid ${accent}` }}
                  >
                    <span className="mx-auto mb-2.5 block w-fit">
                      <Avatar name={studentName(s)} photo={s.account.photo} size="lg" />
                    </span>
                    <span className="block truncate text-[13px] font-bold text-parch-900">{studentName(s)}</span>
                    <span className="mb-3 block truncate text-[11px] text-parch-500">
                      {s.grade || (s.dob ? `Age ${ageOn(formatDateOnly(s.dob), today)}` : '—')}
                    </span>
                    <span className="flex flex-wrap items-center justify-center gap-1.5">
                      {pct !== null && (
                        <span
                          className="rounded-[20px] px-2 py-[3px] text-[10.5px] font-bold"
                          style={
                            pct >= 85
                              ? { background: '#F0FDF4', color: '#166534' }
                              : pct >= 60
                                ? { background: '#FDF5E4', color: '#8B5A0F' }
                                : { background: '#FEF2F2', color: '#991B1B' }
                          }
                        >
                          {pct}%
                        </span>
                      )}
                      <span className="rounded-[20px] bg-brand-wash px-2 py-[3px] text-[10.5px] font-bold text-brand-gold-dark tabular-nums">
                        {r?.total ?? 0} pts
                      </span>
                      {quizAvgByStudent.get(s.id) != null && (
                        <span
                          className="rounded-[20px] px-2 py-[3px] text-[10.5px] font-bold tabular-nums"
                          style={{ background: '#EEF2FF', color: '#4F46E5' }}
                          title="Average quiz score"
                        >
                          {quizAvgByStudent.get(s.id)}% quiz
                        </span>
                      )}
                      {(streakByStudent.get(s.id) ?? 0) >= 2 && (
                        <span
                          className="rounded-[20px] px-2 py-[3px] text-[10.5px] font-bold tabular-nums"
                          style={{ background: '#F0FDF4', color: '#166534' }}
                          title="Sessions attended in a row"
                        >
                          {streakByStudent.get(s.id)}w streak
                        </span>
                      )}
                      {openSet.has(s.id) && <Badge tone="bad">Follow-up</Badge>}
                      {s.importNotes && <Badge tone="warn">Review</Badge>}
                    </span>
                  </Link>
                  ),
                }
              })}
            />
          )}
        </div>

        <div className="space-y-5">
          {/* F0342 — the last six things that happened in this class. A preview,
              not a second ledger: it links on to the points page rather than
              repeating its search, filters and grouping. */}
          {recentPoints.length > 0 && (
            <Card
              title="Recent activity"
              icon={<History className="h-[15px] w-[15px]" />}
              action={
                <LinkButton href={`/portal/classes/${cls.id}/points`} variant="secondary" size="sm">
                  Full ledger
                </LinkButton>
              }
            >
              <ul className="divide-y divide-[#F5F2ED]">
                {recentPoints.map((e) => (
                  <li key={e.id} className="flex items-baseline justify-between gap-2 py-2">
                    <span className="min-w-0">
                      <span className="block truncate text-[12.5px] font-semibold text-parch-900">
                        {studentName(e.student)}
                      </span>
                      <span className="block truncate text-[11px] text-parch-500">
                        {e.activityLabel} · {timeAgo(e.createdAt)}
                      </span>
                    </span>
                    <span
                      className={cn(
                        'shrink-0 rounded-[20px] px-2 py-[3px] text-[11px] font-extrabold tabular-nums',
                        e.points < 0 ? 'bg-[#FEE2E2] text-[#B91C1C]' : 'bg-[#DCFCE7] text-[#15803D]',
                      )}
                    >
                      {e.points > 0 ? '+' : ''}
                      {e.points}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* F0340 — the prototype named the class's leading student on the class
              page itself. Without it, the question a servant is asked every month
              — who is ahead? — meant leaving the class, opening the leaderboard
              and picking the same class again. Read off the ranking this page
              already computes, so it costs no query and cannot disagree with the
              pts pills on the roster below. A tie shows both names, because a
              shared first place is the honest answer. */}
          {Array.from(ranked.values())
            .filter((r) => r.rank === 1 && r.total > 0)
            .map((r) => (
              <Card
                key={r.studentId}
                title="Most active student"
                icon={<Star className="h-[15px] w-[15px]" />}
                action={
                  <LinkButton href={`/portal/leaderboard?class=${cls.id}`} variant="secondary" size="sm">
                    <Trophy className="h-4 w-4" aria-hidden /> Leaderboard
                  </LinkButton>
                }
              >
                <Link href={`/portal/students/${r.studentId}`} className="flex items-center gap-2.5">
                  <Avatar
                    name={r.name}
                    photo={students.find((s) => s.id === r.studentId)?.account.photo ?? null}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-semibold text-parch-900">{r.name}</p>
                    <p className="text-[11px] text-parch-500">{r.total.toLocaleString()} points all time</p>
                  </div>
                  <Badge tone="gold">#1</Badge>
                </Link>
              </Card>
            ))}

          <Card title="Servants" icon={<UserCog className="h-[15px] w-[15px]" />}>
            {servants.length === 0 ? (
              <p className="text-[12.5px] text-parch-500">No servants assigned.</p>
            ) : (
              <ul className="space-y-2.5">
                {servants.map((m) => (
                  <li key={m.servant.id} className="flex items-center gap-2.5">
                    <Avatar name={m.servant.account.displayName} photo={m.servant.account.photo} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-semibold text-parch-900">{m.servant.account.displayName}</p>
                      <p className="text-[11px] text-parch-500">{m.title ? TITLE_LABEL[m.title] : 'Servant'}</p>
                    </div>
                    {m.title && <Badge tone="gold">{TITLE_LABEL[m.title]}</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* F0839 — SchoolClass.photo and setClassPhoto have both existed
              since the photo feature was built and nothing ever called either,
              so a class had no picture anywhere and no way to give it one.
              Gated on student.write, which is the same permission the action
              itself enforces, so the control is never shown to somebody the
              server is going to refuse. */}
          {canEditStudents && <ClassPhotoCard classId={cls.id} name={cls.name} />}
        </div>
      </div>
    </>
  )
}

/**
 * Loaded on its own rather than through requireClassAccess, whose select is
 * shared by every class page and deliberately does not carry the photo blob.
 */
async function ClassPhotoCard({ classId, name }: { classId: string; name: string }) {
  const row = await prisma.schoolClass.findUnique({ where: { id: classId }, select: { photo: true } })
  return (
    <Card title="Class photo" icon={<Camera className="h-[15px] w-[15px]" />}>
      <PhotoUpload
        current={row?.photo ?? null}
        name={name}
        action={setClassPhoto.bind(null, classId)}
        removeAction={removeClassPhoto.bind(null, classId)}
        saveLabel="Save class photo"
      />
    </Card>
  )
}

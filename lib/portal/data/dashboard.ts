import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { todayInNewYork, addDays, formatDateOnly, toUTCDate, mondayOf, newYorkDayStart, sundayOnOrBefore } from '../dates'
import { upcomingBirthdays, birthdaysInWeek } from '../birthdays'
import { rankStudents } from '../points-math'
import { presentStreak } from '../achievements'
import { attendanceRate, headlineRows, heldOccasions, topQuizPerformers, attendanceDelta, registerStatus, type RegisterStatus } from '../reports'
import type { PortalUser } from '../permissions'
import { listVisibleClasses } from './classes'
import { examScopeWhere, studentExams } from './exams'
import { examStatusFor } from '../exams'
import { studentName } from './students'

export async function classTotals(classIds: string[]) {
  const sums = await prisma.pointEntry.groupBy({
    by: ['studentId'],
    where: { student: { classId: { in: classIds } } },
    _sum: { points: true },
  })
  return new Map(sums.map((s) => [s.studentId, s._sum.points ?? 0]))
}

export async function staffOverview(user: PortalUser) {
  const today = todayInNewYork()
  const classes = await listVisibleClasses(user)
  const classIds = classes.map((c) => c.id)

  const [openCases, takenToday, students, recentSundays] = await Promise.all([
    prisma.followUpCase.groupBy({
      by: ['classId'],
      where: { classId: { in: classIds }, status: 'OPEN' },
      _count: { _all: true },
    }),
    prisma.attendanceRecord.groupBy({
      by: ['classId', 'sessionKey'],
      where: { classId: { in: classIds }, date: toUTCDate(today) },
    }),
    prisma.student.findMany({
      where: { classId: { in: classIds } },
      select: { id: true, firstName: true, lastName: true, dob: true, classId: true },
    }),
    prisma.attendanceRecord.findMany({
      // Every session: which one each class's headline figure is scored on is
      // decided per class below, so a class whose register is not Sunday School
      // no longer reads "No sessions yet" on its own card.
      where: { classId: { in: classIds }, date: { gte: toUTCDate(addDays(today, -28)) } },
      select: { classId: true, studentId: true, status: true, date: true, sessionKey: true },
    }),
  ])

  const openByClass = new Map(openCases.map((c) => [c.classId, c._count._all]))
  const takenByClass = new Map<string, string[]>()
  for (const t of takenToday) takenByClass.set(t.classId, [...(takenByClass.get(t.classId) ?? []), t.sessionKey])

  // Roster-aware, like the official Reports page: a student with no row at
  // all for a session the class held still counts against the rate, not just
  // the students who happened to get a row that day (e.g. a group QR code).
  const studentIdsByClass = new Map<string, string[]>()
  for (const s of students) studentIdsByClass.set(s.classId!, [...(studentIdsByClass.get(s.classId!) ?? []), s.id])

  const rateByClass = new Map<string, number | null>()
  /**
   * F0164 — did each class take its register for the most recent Sunday?
   *
   * Free: the 28-day window above already holds every row this needs, and the
   * most recent Sunday is always inside it. The dashboard could only answer
   * this on a Sunday, which is not the day a coordinator has time to chase it.
   */
  const sunday = sundayOnOrBefore(today)
  const registerByClass = new Map<string, RegisterStatus>()
  for (const id of classIds) {
    const rows = recentSundays
      .filter((r) => r.classId === id)
      .map((r) => ({ studentId: r.studentId, date: formatDateOnly(r.date), sessionKey: r.sessionKey, status: r.status }))
    rateByClass.set(id, attendanceRate(headlineRows(rows), { studentIds: studentIdsByClass.get(id) ?? [] }).rate)
    registerByClass.set(id, registerStatus({
      sunday,
      rosterSize: (studentIdsByClass.get(id) ?? []).length,
      rows,
    }))
  }

  // A trend line over the four weeks already fetched above — no extra query.
  // Scored with the same rule as every other number on this dashboard
  // (attendanceRate, which drops excused absences from the denominator), so a
  // servant comparing the chart with the cards beside it sees one story.
  const allMarks = recentSundays.map((r) => ({
    studentId: r.studentId,
    date: formatDateOnly(r.date),
    sessionKey: r.sessionKey,
    status: r.status,
  }))
  const headline = headlineRows(allMarks)
  const rosterIds = students.map((s) => s.id)
  const attendanceTrend = Array.from(new Set(headline.map((m) => m.date)))
    .sort()
    .map((date) => ({
      date,
      rate: attendanceRate(
        headline.filter((m) => m.date === date),
        { studentIds: rosterIds },
      ).rate,
    }))

  const birthdays = upcomingBirthdays(
    students.map((s) => ({ id: s.id, name: studentName(s), dob: s.dob ? formatDateOnly(s.dob) : null, classId: s.classId })),
    today,
    14,
  )

  const churchWide = user.role === 'ADMIN' || user.role === 'PASTOR'

  const servantCount = churchWide
    ? await prisma.servant.count()
    : await prisma.servant.count({ where: { classes: { some: { classId: { in: classIds } } } } })

  // The prototype's pastor overview carried a church-wide Quiz Avg tile, and
  // each class card named its servant, its quiz average and its top student,
  // with a print button (OG L15352-15426). The port gave the pastor the same
  // four admin tiles and class cards with no actions at all, so the numbers the
  // role exists to watch were either gone or two navigations away.
  // Quiz figures are for everyone, not just church-wide roles: the servant
  // dashboard showed admin-shaped church totals and none of the teaching
  // numbers the prototype gave a servant about their own classes.
  const quizOverall = await prisma.quizResult.aggregate({
    where: { classId: { in: classIds } },
    _avg: { percentage: true },
    _max: { percentage: true },
    _count: { _all: true },
  })
  const monthStart = `${today.slice(0, 7)}-01`
  const newStudentsThisMonth = classIds.length
    ? await prisma.student.count({ where: { classId: { in: classIds }, createdAt: { gte: newYorkDayStart(monthStart) } } })
    : 0

  // ── The prototype's remaining dashboard tiles and widgets ────────────────
  // OG L4526-4544 (the stat row) and L4390-4496 (the widget column). These are
  // all read-only aggregates over data the portal already stores.
  const churchWideRole = user.role === 'ADMIN' || user.role === 'PASTOR'
  const dayStart = newYorkDayStart(today)
  const [examTotal, examActive, quizScoreRows, activityRows, presentToday, pointsToday] = await Promise.all([
    prisma.exam.count({ where: examScopeWhere(user) }),
    prisma.exam.count({
      where: {
        AND: [
          examScopeWhere(user),
          { status: 'PUBLISHED' },
          { OR: [{ dueDate: null }, { dueDate: { gte: toUTCDate(today) } }] },
        ],
      },
    }),
    prisma.quizResult.findMany({
      where: { classId: { in: classIds } },
      select: { studentId: true, percentage: true },
    }),
    prisma.pointEntry.findMany({
      where: { classId: { in: classIds }, undone: false },
      orderBy: { createdAt: 'desc' },
      take: churchWideRole ? 6 : 5,
      select: {
        id: true, points: true, activityLabel: true, createdAt: true,
        student: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    prisma.attendanceRecord.findMany({
      where: { classId: { in: classIds }, date: toUTCDate(today), status: 'PRESENT' },
      select: { studentId: true },
    }),
    prisma.pointEntry.findMany({
      where: { classId: { in: classIds }, createdAt: { gte: dayStart }, undone: false },
      select: { studentId: true },
    }),
  ])

  const nameById = new Map(students.map((s) => [s.id, studentName(s)]))
  const topStudents = topQuizPerformers(
    quizScoreRows.map((r) => ({ studentId: r.studentId, name: nameById.get(r.studentId) ?? 'Student', percentage: r.percentage })),
  ).filter((t) => nameById.has(t.studentId))

  const recentActivity = activityRows.map((p) => ({
    id: p.id,
    studentId: p.student.id,
    studentName: studentName(p.student),
    activityLabel: p.activityLabel,
    points: p.points,
    at: p.createdAt,
  }))

  // "Not Checked In Today". The prototype counted a student as checked in if
  // they had earned any points today; this portal records real attendance, so
  // either signal counts — a child marked present by a servant has plainly
  // checked in even if nobody awarded them a point for it.
  const checkedInToday = new Set<string>([...presentToday.map((r) => r.studentId), ...pointsToday.map((p) => p.studentId)])
  const notCheckedInToday = checkedInToday.size
    ? students.filter((s) => !checkedInToday.has(s.id)).map((s) => ({ id: s.id, name: studentName(s) }))
    : []

  const [quizPerClass, pointSums, servantRows] = churchWide
    ? await Promise.all([
        prisma.quizResult.groupBy({
          by: ['classId'],
          where: { classId: { in: classIds } },
          _avg: { percentage: true },
          _count: { _all: true },
        }),
        classTotals(classIds),
        prisma.classServant.findMany({
          where: { classId: { in: classIds } },
          orderBy: [{ sortOrder: 'asc' }],
          select: {
            classId: true,
            title: true,
            servant: { select: { id: true, account: { select: { displayName: true, photo: true } } } },
          },
        }),
      ])
    : [null, null, null]

  const quizAvgByClass = new Map(
    (quizPerClass ?? []).map((q) => [q.classId ?? '', q._avg.percentage === null ? null : Math.round(q._avg.percentage)]),
  )
  const servantNamesByClass = new Map<string, string[]>()
  for (const r of servantRows ?? []) {
    servantNamesByClass.set(r.classId, [...(servantNamesByClass.get(r.classId) ?? []), r.servant.account.displayName])
  }
  const topByClass = new Map<string, { name: string; points: number } | null>()
  if (pointSums) {
    for (const id of classIds) {
      let best: { name: string; points: number } | null = null
      for (const s of students.filter((st) => st.classId === id)) {
        const points = pointSums.get(s.id) ?? 0
        if (points > 0 && (!best || points > best.points)) best = { name: studentName(s), points }
      }
      topByClass.set(id, best)
    }
  }

  return {
    today,
    classes: classes.map((c) => ({
      ...c,
      openCases: openByClass.get(c.id) ?? 0,
      sessionsToday: takenByClass.get(c.id) ?? [],
      sundayRate4w: rateByClass.get(c.id) ?? null,
      quizAverage: quizAvgByClass.get(c.id) ?? null,
      servantNames: servantNamesByClass.get(c.id) ?? [],
      topStudent: topByClass.get(c.id) ?? null,
      register: registerByClass.get(c.id) ?? null,
    })),
    /** The Sunday every class's `register` above is judged on. */
    registerSunday: sunday,
    totals: {
      students: students.length,
      // Distinct servant accounts, not the sum of class assignments: a servant
      // on two classes is one person, and servants with no class still count.
      servants: servantCount,
      openCases: openCases.reduce((n, c) => n + c._count._all, 0),
      classesWithoutServants: classes.filter((c) => c.servantCount === 0).length,
      quizAverage: quizOverall._avg.percentage === null ? null : Math.round(quizOverall._avg.percentage),
      quizBest: quizOverall._max.percentage === null ? null : Math.round(quizOverall._max.percentage),
      quizzesSat: quizOverall._count._all,
      newStudentsThisMonth,
    },
    birthdays,
    attendanceTrend,
    // The whole window as one number, plus the prototype's "vs last session"
    // arrow. Both are read off the trend already computed above.
    attendanceOverall: {
      rate: attendanceRate(headline, { studentIds: rosterIds }).rate,
      delta: attendanceDelta(attendanceTrend),
    },
    exams: { total: examTotal, active: examActive },
    topStudents,
    recentActivity,
    notCheckedInToday,
  }
}

export async function studentOverview(user: PortalUser) {
  const today = todayInNewYork()
  const me = await prisma.student.findUnique({
    where: { id: user.studentId ?? '' },
    select: {
      id: true, firstName: true, lastName: true, dob: true, classId: true,
      class: { select: { id: true, name: true } },
      account: { select: { photo: true, loginId: true } },
    },
  })
  if (!me) return null

  const classmates = me.classId
    ? await prisma.student.findMany({ where: { classId: me.classId }, select: { id: true, firstName: true, lastName: true, dob: true } })
    : [me]
  const totals = await classTotals(me.classId ? [me.classId] : [])
  const ranked = rankStudents(classmates.map((s) => ({ studentId: s.id, name: studentName(s), total: totals.get(s.id) ?? 0 })))
  const mine = ranked.find((r) => r.studentId === me.id)

  const [entries, sunday, heldSundays, myResults, examRows, monthPoints] = await Promise.all([
    prisma.pointEntry.findMany({
      where: { studentId: me.id },
      orderBy: { createdAt: 'desc' },
      take: 15,
      select: { id: true, points: true, activityLabel: true, reason: true, createdAt: true, source: true, undone: true },
    }),
    prisma.attendanceRecord.findMany({
      where: { studentId: me.id, sessionKey: 'sunday' },
      orderBy: { date: 'desc' },
      take: 12,
      select: { date: true, status: true },
    }),
    // Class-wide, not student-scoped: a Sunday the class held but this
    // student has no row for (e.g. everyone else checked in by group QR)
    // still has to count against them, same window as `sunday` above.
    me.classId
      ? prisma.attendanceRecord.findMany({
          where: { classId: me.classId, sessionKey: 'sunday' },
          orderBy: { date: 'desc' },
          distinct: ['date'],
          take: 12,
          select: { date: true },
        })
      : Promise.resolve([]),
    // The prototype's Quiz Avg tile, score trend and Recent Quizzes list all
    // read off one query (OG L11660-11670, L11896).
    prisma.quizResult.findMany({
      where: { studentId: me.id },
      orderBy: { submittedAt: 'desc' },
      select: {
        id: true, percentage: true, score: true, correctCount: true, questionCount: true,
        submittedAt: true, exam: { select: { id: true, title: true } },
      },
    }),
    // Exactly the rows the Quizzes widget below reads, so the hero tile and
    // the widget can never disagree about what is still waiting: "pending"
    // has one definition (examStatusFor), not two.
    studentExams(me.id),
    prisma.pointEntry.aggregate({
      where: { studentId: me.id, undone: false, createdAt: { gte: newYorkDayStart(`${today.slice(0, 7)}-01`) } },
      _sum: { points: true },
    }),
  ])

  const birthdays = upcomingBirthdays(
    classmates.map((s) => ({ id: s.id, name: studentName(s), dob: s.dob ? formatDateOnly(s.dob) : null })),
    today,
    30,
  )

  // Chronological, so "the previous quiz" means the one before this one.
  const chrono = [...myResults].reverse()
  const quizAverage = myResults.length
    ? Math.round(myResults.reduce((n, r) => n + r.percentage, 0) / myResults.length)
    : null
  const quizTrend =
    chrono.length >= 2 ? chrono[chrono.length - 1]!.percentage - chrono[chrono.length - 2]!.percentage : null

  const submittedExamIds = new Set(myResults.map((r) => r.exam.id))
  const pendingExams = examRows.rows
    .filter((e) => examStatusFor(e, me.id, submittedExamIds, examRows.today) === 'available')
    .sort((a, b) => {
      if (!a.dueDate) return 1
      if (!b.dueDate) return -1
      return a.dueDate < b.dueDate ? -1 : 1
    })
  const nextDue = pendingExams.find((e) => e.dueDate)
  // "New" is the prototype's 48 hours since the quiz was written (OG L11710).
  const cutoff = Date.now() - 48 * 60 * 60 * 1000
  const newExams = pendingExams.filter((e) => e.createdAt.getTime() >= cutoff)

  return {
    today,
    me,
    className: me.class?.name ?? 'No class yet',
    quizAverage,
    quizTrend,
    recentQuizzes: myResults.slice(0, 3).map((r) => ({
      id: r.id,
      examId: r.exam.id,
      title: r.exam.title,
      percentage: r.percentage,
      correctCount: r.correctCount,
      questionCount: r.questionCount,
      score: r.score,
    })),
    scoreTrend: chrono.slice(-8).map((r) => ({ title: r.exam.title, percentage: r.percentage })),
    pending: {
      count: pendingExams.length,
      nextTitle: nextDue?.title ?? null,
      nextDue: nextDue?.dueDate ?? null,
    },
    newExams: newExams.map((e) => ({ id: e.id, title: e.title })),
    pointsThisMonth: monthPoints._sum.points ?? 0,
    // The prototype's "Current Streak" mini widget. The same computation
    // already powers the attendance badges, so the dashboard and the
    // achievements page cannot report different numbers.
    streak: presentStreak(sunday.map((r) => ({ date: formatDateOnly(r.date), status: r.status }))),
    total: mine?.total ?? 0,
    rank: mine?.rank ?? null,
    classSize: ranked.length,
    top3: ranked.slice(0, 3),
    // The leader's total, for the prototype's "Points vs leader" bar. It is
    // the top of the ranking, which is 0 when nobody has scored yet — the bar
    // guards against that rather than dividing by it.
    leaderPoints: ranked[0]?.total ?? 0,
    entries,
    sunday: sunday.map((r) => ({ date: formatDateOnly(r.date), status: r.status })),
    rate: attendanceRate(
      sunday.map((r) => ({ studentId: me.id, sessionKey: 'sunday', date: formatDateOnly(r.date), status: r.status })),
      { occasions: heldOccasions(heldSundays.map((r) => ({ sessionKey: 'sunday', date: formatDateOnly(r.date) }))), studentIds: [me.id] },
    ),
    birthdays,
  }
}

/**
 * The single birthday the top bar shows: the soonest one in the next week
 * among the people this user can see. Null when there is none.
 *
 * This runs in the layout, so it is on the critical path of EVERY portal
 * navigation. The answer only changes when the date does, so it is cached per
 * (account, day) rather than re-queried on every click.
 */
export function nextBirthdayForTopbar(
  user: PortalUser,
  today: string,
): Promise<{ name: string; on: string; more: number } | null> {
  return unstable_cache(
    () => computeNextBirthday(user, today),
    ['portal-topbar-birthday', user.accountId, today],
    { revalidate: 3600, tags: ['portal-topbar-birthday'] },
  )()
}

async function computeNextBirthday(
  user: PortalUser,
  today: string,
): Promise<{ name: string; on: string; more: number } | null> {
  const classes = await listVisibleClasses(user)
  const classIds = classes.map((c) => c.id)
  if (classIds.length === 0) return null

  // Scoped exactly like /portal/birthdays, which is where the chip goes. A
  // church-wide chip over a class-scoped page would name someone the servant
  // then could not find when they followed it.
  const [students, servants] = await Promise.all([
    prisma.student.findMany({
      where: { classId: { in: classIds }, dob: { not: null } },
      select: { id: true, firstName: true, lastName: true, dob: true, classId: true },
    }),
    // The prototype's chip counted servants too — a servant's own birthday is
    // exactly the one their colleagues would otherwise miss. Students do not
    // see servants here, matching the page.
    user.role === 'STUDENT'
      ? Promise.resolve([] as { id: string; birthday: Date | null; account: { displayName: string } }[])
      : prisma.servant.findMany({
          where:
            user.role === 'SERVANT'
              ? { birthday: { not: null }, classes: { some: { classId: { in: classIds } } } }
              : { birthday: { not: null } },
          select: { id: true, birthday: true, account: { select: { displayName: true } } },
        }),
  ])

  const people = [
    ...students.map((s) => ({ id: s.id, name: studentName(s), dob: s.dob ? formatDateOnly(s.dob) : null })),
    ...servants.map((s) => ({ id: s.id, name: s.account.displayName, dob: s.birthday ? formatDateOnly(s.birthday) : null })),
  ]

  // The calendar week, so the chip agrees with the Birthdays page instead of
  // sliding forward a day at a time and dropping people already greeted.
  const week = birthdaysInWeek(people, mondayOf(today), today)
  if (week.length === 0) return null
  // Headline the next one still to come; if the week's birthdays have all
  // passed, keep showing the last of them rather than emptying the chip.
  const first = week.find((b) => b.daysUntil >= 0) ?? week[week.length - 1]!
  return { name: first.name, on: first.on, more: week.length - 1 }
}

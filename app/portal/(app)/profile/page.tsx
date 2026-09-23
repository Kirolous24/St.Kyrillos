import Link from 'next/link'
import { User, Camera, Star, Trophy, ClipboardList, CalendarCheck } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '@/lib/portal/session'
import { studentName } from '@/lib/portal/data/students'
import { classTotals } from '@/lib/portal/data/dashboard'
import { rankStudents } from '@/lib/portal/points-math'
import { assignmentsForServant } from '@/lib/portal/data/agenda'
import { groupAssignmentsByWeek } from '@/lib/portal/agenda'
import { loadMyServantHistory } from '@/lib/portal/data/servant-attendance'
import { PageHeader, Card, StatCard, Avatar, Badge, LinkButton, SectionTitle } from '@/components/portal/ui'
import { ROLE_LABEL, STAGE_LABEL, TITLE_LABEL, formatLongDate } from '@/lib/portal/format'
import { formatDateOnly, ageOn, todayInNewYork, addDays, mondayOf } from '@/lib/portal/dates'
import { formatPhone } from '@/lib/portal/phones'
import { ProfileForm } from './ProfileForm'

export const metadata = { title: 'My Profile' }

/** One label/value row; the prototype's infoRow(), including its em-dash fallback. */
function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[#EFE9DC] py-2.5 last:border-0">
      <span className="shrink-0 text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">{label}</span>
      <span className="min-w-0 text-right text-[13px] text-parch-900">{value?.trim() ? value : '—'}</span>
    </div>
  )
}

/**
 * "My Profile", restored from the prototype (servant svLoad('myprofile'),
 * student stLoad('profile')). The port shipped no self-profile page at all:
 * /portal/settings only changed a PIN, so a servant could not see or correct
 * their own contact details and a student could not see theirs.
 */
export default async function MyProfilePage() {
  const user = await requirePortalUser()
  const today = todayInNewYork()

  const account = await prisma.account.findUnique({
    where: { id: user.accountId },
    select: {
      displayName: true, email: true, phone: true, photo: true, loginId: true, lastLoginAt: true,
      servant: {
        select: {
          birthday: true, address: true, stageOversight: true,
          classes: { select: { class: { select: { id: true, name: true } }, title: true } },
        },
      },
      student: {
        select: {
          id: true, firstName: true, lastName: true, grade: true, dob: true, address: true,
          fatherName: true, fatherPhone: true, motherName: true, motherPhone: true, classId: true,
          class: { select: { name: true, stage: true } },
        },
      },
    },
  })
  if (!account) return null

  const st = account.student
  let stats: { points: number; quizzes: number; present: number; rank?: number } | null = null
  if (st) {
    const [points, quizzes, present, classmates, totals] = await Promise.all([
      prisma.pointEntry.aggregate({ where: { studentId: st.id }, _sum: { points: true } }),
      prisma.quizResult.count({ where: { studentId: st.id } }),
      prisma.attendanceRecord.count({ where: { studentId: st.id, status: 'PRESENT' } }),
      prisma.student.findMany({ where: { classId: st.classId }, select: { id: true, firstName: true, lastName: true } }),
      classTotals(st.classId ? [st.classId] : []),
    ])
    const rank = rankStudents(
      classmates.map((c) => ({ studentId: c.id, name: studentName(c), total: totals.get(c.id) ?? 0 })),
    ).find((r) => r.studentId === st.id)?.rank
    stats = { points: points._sum.points ?? 0, quizzes, present, rank }
  }

  const sv = account.servant
  const subtitleBits = [ROLE_LABEL[user.role]]
  // F0646 — a coordinator read the bare word "Servant" under their own name.
  // The prototype's line was the title and where they hold it ("Coordinator ·
  // Elementary"), which is how the church tells apart two servants with the
  // same role. stageOversight alone is null for nearly all of them, so on its
  // own it left the line generic for exactly the people it was meant to name.
  // Capped at three, and it says so when it caps.
  const classBits = (sv?.classes ?? []).map((c) => (c.title ? `${TITLE_LABEL[c.title]}, ${c.class.name}` : c.class.name))
  subtitleBits.push(...classBits.slice(0, 3))
  if (classBits.length > 3) subtitleBits.push(`+${classBits.length - 3} more`)
  if (sv?.stageOversight) subtitleBits.push(STAGE_LABEL[sv.stageOversight])
  if (st?.class) subtitleBits.push(st.class.name)

  /**
   * F0644 / F0645 — the stat strip rendered only for a student account, so a
   * servant opening their own profile got a hero and two cards of contact
   * details and not one fact about their own serving. These are the two the
   * prototype put here: what they are down to do next, and whether they have
   * been turning up. Both tiles are links, because both are a summary of a page
   * that answers the question properly.
   *
   * The attendance window is the last four Mondays in church time, not UTC, so
   * the figure does not change what it means after 8pm.
   */
  const servantId = user.servantId ?? null
  const fourWeeksAgo = addDays(mondayOf(today), -21)
  const [assignments, attendance] = servantId
    ? await Promise.all([assignmentsForServant(servantId, today), loadMyServantHistory(servantId, fourWeeksAgo)])
    : [null, null]
  const upcomingWeeks = assignments ? groupAssignmentsByWeek(assignments, today).upcoming : []
  const upcomingCount = upcomingWeeks.reduce((n, w) => n + w.items.length, 0)
  const nextAssignment = upcomingWeeks[0]?.items[0] ?? null

  return (
    <>
      <PageHeader
        title="My Profile"
        subtitle="Your details as the portal has them"
        icon={<User className="h-5 w-5" />}
        actions={
          <LinkButton href="/portal/photo" variant="secondary">
            <Camera className="h-4 w-4" aria-hidden /> Change photo
          </LinkButton>
        }
      />

      {/* Hero, matching the prototype's burgundy profile header. */}
      <Card className="mb-4 border-brand-800 bg-brand-800 text-parch-50">
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/portal/photo" aria-label="Change my photo" className="shrink-0 rounded-full">
            <Avatar name={account.displayName} photo={account.photo} size="xl" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="font-serif text-[22px] font-bold leading-tight">{account.displayName}</p>
            <p className="mt-0.5 text-[12.5px] text-parch-50/75">{subtitleBits.join(' · ')}</p>
            <p className="mt-0.5 text-[12.5px] text-parch-50/75">{account.email || 'No email on file'}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <Badge tone="gold">ID {account.loginId}</Badge>
            {stats?.rank ? <Badge tone="gold">Rank #{stats.rank} in class</Badge> : null}
          </div>
        </div>
      </Card>

      {stats && (
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Points" value={stats.points} icon={<Star className="h-4 w-4" />} />
          <StatCard label="Quizzes taken" value={stats.quizzes} icon={<ClipboardList className="h-4 w-4" />} />
          <StatCard label="Sessions present" value={stats.present} icon={<CalendarCheck className="h-4 w-4" />} />
          <StatCard label="Class rank" value={stats.rank ? `#${stats.rank}` : '—'} icon={<Trophy className="h-4 w-4" />} />
        </div>
      )}

      {servantId && (
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link href="/portal/assignments" className="block rounded-[16px]">
            <StatCard
              label="My assignments"
              value={upcomingCount}
              hint={nextAssignment ? `Next: ${nextAssignment.title}` : 'Nothing coming up'}
              icon={<ClipboardList className="h-4 w-4" />}
              accent="#4F46E5"
            />
          </Link>
          <Link href="/portal/my-attendance" className="block rounded-[16px]">
            <StatCard
              label="My attendance"
              value={attendance && attendance.overall.rate !== null ? `${attendance.overall.rate}%` : '—'}
              hint={
                attendance && attendance.overall.held > 0
                  ? `${attendance.overall.attended} of ${attendance.overall.held} over 4 weeks`
                  : 'Nothing recorded in the last 4 weeks'
              }
              icon={<CalendarCheck className="h-4 w-4" />}
              accent="#16A34A"
            />
          </Link>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <SectionTitle>Personal information</SectionTitle>
          <Card>
            {st ? (
              <>
                <Row label="Full name" value={`${st.firstName} ${st.lastName}`} />
                <Row label="Class" value={st.class?.name} />
                <Row label="Grade" value={st.grade} />
                <Row
                  label="Date of birth"
                  value={st.dob ? `${formatLongDate(formatDateOnly(st.dob))} (age ${ageOn(formatDateOnly(st.dob), today)})` : null}
                />
                <Row label="Email" value={account.email} />
                <Row label="Phone" value={account.phone ? formatPhone(account.phone) : null} />
                <Row label="Address" value={st.address} />
                <Row label="Father" value={[st.fatherName, st.fatherPhone ? formatPhone(st.fatherPhone) : null].filter(Boolean).join(' · ')} />
                <Row label="Mother" value={[st.motherName, st.motherPhone ? formatPhone(st.motherPhone) : null].filter(Boolean).join(' · ')} />
              </>
            ) : (
              <>
                <Row label="Full name" value={account.displayName} />
                <Row label="Role" value={ROLE_LABEL[user.role]} />
                <Row label="Classes" value={sv?.classes.map((c) => c.class.name).join(', ')} />
                <Row label="Email" value={account.email} />
                <Row label="Phone" value={account.phone ? formatPhone(account.phone) : null} />
                {/* A pure ADMIN account has no Servant row, so it has nowhere to
                    store a birthday or address and the edit form hides both —
                    don't advertise rows that can never be filled. */}
                {sv && <Row label="Birthday" value={sv.birthday ? formatLongDate(formatDateOnly(sv.birthday)) : null} />}
                {sv && <Row label="Address" value={sv.address} />}
              </>
            )}
          </Card>
        </div>

        <div>
          <SectionTitle>{st ? 'Changing your details' : 'Keep it current'}</SectionTitle>
          {st ? (
            <Card>
              <p className="text-[13px] leading-relaxed text-parch-500">
                Your servant keeps these details. If something here is wrong — or your address or a parent&apos;s phone
                number has changed — tell your servant and they will update it for you.
              </p>
            </Card>
          ) : (
            <>
              <ProfileForm
                showServantFields={!!user.servantId}
                initial={{
                  email: account.email ?? '',
                  phone: account.phone ?? '',
                  address: sv?.address ?? '',
                  birthday: sv?.birthday ? formatDateOnly(sv.birthday) : '',
                }}
              />
              {/* F0647 — the form offers email, phone, address and birthday and
                  nothing else, so a servant whose name is spelled wrong, or who
                  has been moved to another class, goes hunting for a field that
                  is not there and then asks nobody. The student branch above has
                  said who to ask since the page was built; staff never did. */}
              <p className="mt-3 text-[12px] leading-relaxed text-parch-500">
                Your name, the classes you serve and the position you hold on them are kept by the Sunday School
                admin — ask them to change any of those.
              </p>
            </>
          )}
        </div>
      </div>
    </>
  )
}

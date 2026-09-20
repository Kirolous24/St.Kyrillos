import { BookOpenCheck, CalendarCheck, Lock, Sparkles, Trophy } from 'lucide-react'
import { requirePortalUser } from '@/lib/portal/session'
import { requireStudentRead, studentName } from '@/lib/portal/data/students'
import { loadAchievements } from '@/lib/portal/data/community'
import { LEVELS } from '@/lib/portal/achievements'
import { todayInNewYork } from '@/lib/portal/dates'
import { PageHeader, StatCard, ProgressBar, EmptyState } from '@/components/portal/ui'
import { cn } from '@/lib/utils'

export const metadata = { title: 'Achievements' }

const AWARDED_FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

export default async function AchievementsPage({ searchParams }: { searchParams: { student?: string } }) {
  const user = await requirePortalUser()
  const today = todayInNewYork()

  // A student only ever sees their own record; anyone else must ask for a
  // student they are allowed to read (this 404s otherwise).
  let studentId = user.studentId ?? null
  let heading = 'My Achievements'
  if (searchParams.student && searchParams.student !== user.studentId) {
    const student = await requireStudentRead(user, searchParams.student)
    studentId = student.id
    heading = `${studentName(student)}’s Achievements`
  }

  if (!studentId) {
    return (
      <>
        <PageHeader title="Achievements" subtitle="Levels, points and badges." />
        <EmptyState
          title="Achievements belong to students"
          hint="Open a student from their class roster to see the badges they have earned."
        />
      </>
    )
  }

  const { level, next, pointsToNext, percent, earned, locked, stats, awardedAt } = await loadAchievements(studentId, today)

  return (
    <>
      <PageHeader
        title={heading}
        subtitle="Levels come from points earned all year; badges come from what you actually do."
      />

      {/* Level hero — the prototype's burgundy panel with the bar beneath. */}
      <div className="mb-4 rounded-[14px] bg-[linear-gradient(135deg,#6F1D1B,#4A1212)] px-5 py-6 text-center">
        <p className="text-[11px] font-bold uppercase tracking-[1px] text-white/50">Your level</p>
        <p className="mt-1.5 font-serif text-[30px] font-bold leading-none text-parch-50">
          <span aria-hidden className="mr-1.5">{level.emoji}</span>
          {level.name}
        </p>
        <p className="mt-2 text-[12px] font-semibold text-brand-gold">
          {stats.lifetimePoints} pts · {next ? `Level ${level.index} of ${LEVELS.length}` : 'Max level'}
        </p>
        <div className="mx-auto mt-4 max-w-md">
          {/* Amber fill, not burgundy: the bar sits on a burgundy hero. */}
          <ProgressBar value={percent} tone="warn" label={next ? `Progress to ${next.name}` : 'Top level'} />
          <p className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-white/45">
            <span className="tabular-nums">{level.minPoints} pts</span>
            <span>
              {next
                ? `${pointsToNext} more to ${next.emoji} ${next.name}`
                : 'You reached the highest level!'}
            </span>
            <span className="tabular-nums">{next ? `${next.minPoints} pts` : ''}</span>
          </p>
        </div>
        <ol className="mt-3.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10.5px] font-bold uppercase tracking-[0.6px]">
          {LEVELS.map((l) => (
            <li key={l.key} className={cn(l.index <= level.index ? 'text-brand-gold' : 'text-white/35')}>
              <span aria-hidden className="mr-1">{l.emoji}</span>
              {l.name}
            </li>
          ))}
        </ol>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Points" value={stats.lifetimePoints} tone="brand" accent="#C89B3C" icon={<Trophy className="h-5 w-5" aria-hidden />} />
        <StatCard label="Sunday streak" value={stats.attendanceStreak} hint="in a row" accent="#16A34A" icon={<CalendarCheck className="h-5 w-5" aria-hidden />} />
        <StatCard label="Reading streak" value={stats.readingStreak} hint={`${stats.readingDays} days total`} accent="#6F1D1B" icon={<BookOpenCheck className="h-5 w-5" aria-hidden />} />
        <StatCard label="Quizzes" value={stats.quizzesCompleted} hint={stats.bestQuizPercentage > 0 ? `best ${stats.bestQuizPercentage}%` : 'none yet'} accent="#2563EB" icon={<Sparkles className="h-5 w-5" aria-hidden />} />
      </div>

      <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">
        Earned badges ({earned.length})
      </p>
      {earned.length === 0 ? (
        <EmptyState title="No badges yet" hint="Come to Sunday School, take a quiz, read your Bible — they add up fast." />
      ) : (
        <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
          {earned.map((b) => {
            const at = awardedAt.get(b.badge.key)
            return (
              <li key={b.badge.key}>
                <div className="relative h-full rounded-[14px] border-[1.5px] border-brand-gold bg-parch-50 px-2.5 py-4 text-center shadow-card">
                  <span className="absolute right-2 top-2 rounded-[20px] bg-brand-wash px-[7px] py-px text-[10px] font-bold text-brand-gold-dark">
                    ✓
                  </span>
                  <span aria-hidden className="block text-[28px] leading-none">{b.badge.emoji}</span>
                  <p className="mt-2 text-[12px] font-bold text-parch-900">{b.badge.name}</p>
                  <p className="mt-1 text-[11px] leading-[1.4] text-parch-500">{b.badge.requirement}</p>
                  {at && (
                    <p className="mt-1.5 text-[10.5px] font-bold uppercase tracking-[0.5px] text-brand-gold-dark">
                      {AWARDED_FORMAT.format(at)}
                    </p>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {locked.length > 0 && (
        <>
          <p className="mb-2.5 mt-6 text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">
            Locked badges ({locked.length})
          </p>
          <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
            {locked.map((b) => (
              <li key={b.badge.key}>
                <div className="relative h-full rounded-[14px] border-[1.5px] border-parch-200 bg-parch-50 px-2.5 py-4 text-center">
                  <span aria-hidden className="absolute right-2 top-2 text-parch-400">
                    <Lock className="h-3 w-3" aria-hidden />
                  </span>
                  <span aria-hidden className="block text-[28px] leading-none opacity-40 grayscale">{b.badge.emoji}</span>
                  <p className="mt-2 text-[12px] font-bold text-parch-600">{b.badge.name}</p>
                  <p className="mt-1 text-[11px] leading-[1.4] text-parch-500">{b.badge.requirement}</p>
                  <div className="mt-2.5">
                    <ProgressBar value={b.percent} tone="warn" label={b.badge.requirement} />
                    <p className="mt-1 text-[10.5px] font-bold tabular-nums text-parch-500">
                      {b.current} / {b.target}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}

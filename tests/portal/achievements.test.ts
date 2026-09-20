import { describe, it, expect } from 'vitest'
import {
  LEVELS,
  BADGES,
  levelFor,
  progressToNextLevel,
  evaluateAchievements,
  mergePersistedBadges,
  readingStreak,
  presentStreak,
  type AchievementStats,
} from '@/lib/portal/achievements'

const base: AchievementStats = {
  lifetimePoints: 0,
  attendanceStreak: 0,
  quizzesCompleted: 0,
  bestQuizPercentage: 0,
  readingStreak: 0,
  readingDays: 0,
  isBirthdayMonth: false,
}

describe('LEVELS and BADGES', () => {
  it('has five levels, ascending, starting at zero', () => {
    expect(LEVELS).toHaveLength(5)
    expect(LEVELS[0].minPoints).toBe(0)
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i].minPoints).toBeGreaterThan(LEVELS[i - 1].minPoints)
      expect(LEVELS[i].index).toBe(i + 1)
    }
  })

  it('has eleven badges with unique keys and positive targets', () => {
    expect(BADGES).toHaveLength(11)
    expect(new Set(BADGES.map((b) => b.key)).size).toBe(11)
    for (const b of BADGES) expect(b.target).toBeGreaterThan(0)
  })
})

describe('levelFor', () => {
  it('picks the highest band the points reach', () => {
    expect(levelFor(0).key).toBe('seed')
    expect(levelFor(49).key).toBe('seed')
    expect(levelFor(50).key).toBe('candle')
    expect(levelFor(399).key).toBe('lampstand')
    expect(levelFor(400).key).toBe('crown')
    expect(levelFor(10_000).key).toBe('star')
  })

  it('never falls off the bottom on junk input', () => {
    expect(levelFor(-25).key).toBe('seed')
    expect(levelFor(Number.NaN).key).toBe('seed')
  })
})

describe('progressToNextLevel', () => {
  it('measures progress through the current band, not from zero', () => {
    const p = progressToNextLevel(100) // candle (50) → lampstand (150)
    expect(p.level.key).toBe('candle')
    expect(p.next?.key).toBe('lampstand')
    expect(p.pointsToNext).toBe(50)
    expect(p.percent).toBe(50)
  })

  it('reports a full bar with no next level at the top', () => {
    const p = progressToNextLevel(900)
    expect(p.level.key).toBe('star')
    expect(p.next).toBeNull()
    expect(p.pointsToNext).toBe(0)
    expect(p.percent).toBe(100)
  })

  it('starts a fresh student at zero percent of the first band', () => {
    const p = progressToNextLevel(0)
    expect(p.level.key).toBe('seed')
    expect(p.pointsToNext).toBe(50)
    expect(p.percent).toBe(0)
  })
})

describe('evaluateAchievements', () => {
  it('earns nothing for a brand-new student and locks all eleven', () => {
    const r = evaluateAchievements(base)
    expect(r.earned).toHaveLength(0)
    expect(r.locked).toHaveLength(11)
  })

  it('earns cumulative point badges together', () => {
    const r = evaluateAchievements({ ...base, lifetimePoints: 120 })
    const keys = r.earned.map((e) => e.badge.key)
    expect(keys).toContain('first-fruits')
    expect(keys).toContain('hundredfold')
    expect(keys).not.toContain('treasure')
  })

  it('earns both streak badges when the longer one is met', () => {
    const keys = evaluateAchievements({ ...base, attendanceStreak: 9 }).earned.map((e) => e.badge.key)
    expect(keys).toEqual(expect.arrayContaining(['faithful', 'steadfast']))
  })

  it('caps progress at the target and never exceeds 100%', () => {
    const r = evaluateAchievements({ ...base, lifetimePoints: 5000 })
    const treasure = r.earned.find((e) => e.badge.key === 'treasure')!
    expect(treasure.current).toBe(500)
    expect(treasure.percent).toBe(100)
  })

  it('reports partial progress on locked badges', () => {
    const r = evaluateAchievements({ ...base, readingStreak: 3 })
    const week = r.locked.find((l) => l.badge.key === 'week-in-the-word')!
    expect(week.earned).toBe(false)
    expect(week.current).toBe(3)
    expect(week.percent).toBe(43)
  })

  it('orders locked badges nearest-first so the next one in reach is first', () => {
    const r = evaluateAchievements({ ...base, lifetimePoints: 9, quizzesCompleted: 0 })
    expect(r.locked[0].badge.key).toBe('first-fruits')
  })

  it('treats the birthday month as a boolean badge', () => {
    expect(evaluateAchievements({ ...base, isBirthdayMonth: false }).earned.map((e) => e.badge.key)).not.toContain('birthday-blessing')
    expect(evaluateAchievements({ ...base, isBirthdayMonth: true }).earned.map((e) => e.badge.key)).toContain('birthday-blessing')
  })

  it('only awards the perfect-score badge at exactly 100%', () => {
    expect(evaluateAchievements({ ...base, bestQuizPercentage: 99 }).earned.map((e) => e.badge.key)).not.toContain('perfect-score')
    expect(evaluateAchievements({ ...base, bestQuizPercentage: 100 }).earned.map((e) => e.badge.key)).toContain('perfect-score')
  })

  it('carries the level progress alongside the badges', () => {
    const r = evaluateAchievements({ ...base, lifetimePoints: 150 })
    expect(r.level.key).toBe('lampstand')
    expect(r.next?.key).toBe('crown')
  })
})

describe('mergePersistedBadges', () => {
  it('keeps a badge whose streak has lapsed', () => {
    const live = evaluateAchievements({ ...base, readingStreak: 0, readingDays: 12 })
    expect(live.earned.map((e) => e.badge.key)).not.toContain('week-in-the-word')

    const merged = mergePersistedBadges(live, ['week-in-the-word'])
    expect(merged.earned.map((e) => e.badge.key)).toContain('week-in-the-word')
    expect(merged.locked.map((l) => l.badge.key)).not.toContain('week-in-the-word')
  })

  it('keeps the birthday badge after the month turns over', () => {
    const live = evaluateAchievements({ ...base, isBirthdayMonth: false })
    const merged = mergePersistedBadges(live, new Set(['birthday-blessing']))
    expect(merged.earned.map((e) => e.badge.key)).toEqual(['birthday-blessing'])
  })

  it('never loses or duplicates a badge', () => {
    const live = evaluateAchievements({ ...base, lifetimePoints: 120, attendanceStreak: 4 })
    const merged = mergePersistedBadges(live, ['week-in-the-word', 'birthday-blessing'])
    const keys = [...merged.earned, ...merged.locked].map((r) => r.badge.key)
    expect(keys).toHaveLength(BADGES.length)
    expect(new Set(keys).size).toBe(BADGES.length)
  })

  it('leaves progress numbers truthful on a restored badge', () => {
    const live = evaluateAchievements({ ...base, readingStreak: 2 })
    const week = mergePersistedBadges(live, ['week-in-the-word']).earned.find(
      (e) => e.badge.key === 'week-in-the-word',
    )!
    expect(week.earned).toBe(true)
    expect(week.current).toBe(2)
  })

  it('keeps earned badges in BADGES order', () => {
    const live = evaluateAchievements({ ...base, lifetimePoints: 120 })
    const merged = mergePersistedBadges(live, ['faithful'])
    expect(merged.earned.map((e) => e.badge.key)).toEqual(['first-fruits', 'hundredfold', 'faithful'])
  })

  it('ignores keys that no longer name a badge, and is a no-op with none', () => {
    const live = evaluateAchievements({ ...base, lifetimePoints: 120 })
    expect(mergePersistedBadges(live, [])).toBe(live)
    const merged = mergePersistedBadges(live, ['retired-badge'])
    expect(merged.earned.map((e) => e.badge.key)).toEqual(['first-fruits', 'hundredfold'])
    expect(merged.earned).toHaveLength(2)
  })
})

describe('readingStreak', () => {
  const today = '2026-09-19'

  it('is zero with no rows', () => {
    expect(readingStreak([], today)).toBe(0)
  })

  it('counts consecutive days ending today', () => {
    expect(readingStreak(['2026-09-19', '2026-09-18', '2026-09-17'], today)).toBe(3)
  })

  it('keeps yesterday-ending streaks alive before today is checked in', () => {
    expect(readingStreak(['2026-09-18', '2026-09-17'], today)).toBe(2)
  })

  it('breaks when the last read was two days ago', () => {
    expect(readingStreak(['2026-09-17', '2026-09-16'], today)).toBe(0)
  })

  it('stops at the first gap', () => {
    expect(readingStreak(['2026-09-19', '2026-09-18', '2026-09-16', '2026-09-15'], today)).toBe(2)
  })

  it('ignores order and duplicates', () => {
    expect(readingStreak(['2026-09-17', '2026-09-19', '2026-09-18', '2026-09-18'], today)).toBe(3)
  })

  it('crosses a month boundary', () => {
    expect(readingStreak(['2026-09-01', '2026-08-31', '2026-08-30'], '2026-09-01')).toBe(3)
  })
})

describe('presentStreak', () => {
  it('counts back from the most recent session regardless of input order', () => {
    const rows = [
      { date: '2026-09-06', status: 'PRESENT' as const },
      { date: '2026-09-20', status: 'PRESENT' as const },
      { date: '2026-09-13', status: 'PRESENT' as const },
    ]
    expect(presentStreak(rows)).toBe(3)
  })

  it('stops at an absence', () => {
    expect(
      presentStreak([
        { date: '2026-09-20', status: 'PRESENT' },
        { date: '2026-09-13', status: 'ABSENT' },
        { date: '2026-09-06', status: 'PRESENT' },
      ]),
    ).toBe(1)
  })

  it('skips excused absences without breaking or counting them', () => {
    expect(
      presentStreak([
        { date: '2026-09-20', status: 'PRESENT' },
        { date: '2026-09-13', status: 'EXCUSED' },
        { date: '2026-09-06', status: 'PRESENT' },
      ]),
    ).toBe(2)
  })

  it('is zero when the latest session was missed', () => {
    expect(presentStreak([{ date: '2026-09-20', status: 'ABSENT' }])).toBe(0)
    expect(presentStreak([])).toBe(0)
  })
})

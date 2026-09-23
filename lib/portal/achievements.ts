// Levels and badges for the student Achievements screen.
//
// Everything here is pure: the page gathers the raw signals from Postgres,
// hands them over as `AchievementStats`, and this module decides what has been
// earned. The prototype scattered the same thresholds through half a dozen
// render functions; keeping them in one table is what makes them testable and
// what makes "earned on" dates stable (the page persists earned keys to
// StudentAchievement, and only badges named here can ever be written).

import { addDays } from './dates'
import type { Status } from './attendance-rules'

/* ── Levels ───────────────────────────────────────────────────────────────── */

export interface Level {
  /** 1-based; also the order in LEVELS. */
  index: number
  key: string
  name: string
  emoji: string
  /** Lifetime points needed to reach this level. */
  minPoints: number
}

export const LEVELS: readonly Level[] = [
  { index: 1, key: 'seed', name: 'Seed', emoji: '🌱', minPoints: 0 },
  { index: 2, key: 'candle', name: 'Candle', emoji: '🕯️', minPoints: 50 },
  { index: 3, key: 'lampstand', name: 'Lampstand', emoji: '🪔', minPoints: 150 },
  { index: 4, key: 'crown', name: 'Crown', emoji: '👑', minPoints: 400 },
  { index: 5, key: 'star', name: 'Shining Star', emoji: '✨', minPoints: 800 },
] as const

/** The highest level whose threshold the student has passed. Never null. */
export function levelFor(points: number): Level {
  const safe = Number.isFinite(points) ? points : 0
  let current = LEVELS[0]
  for (const level of LEVELS) {
    if (safe >= level.minPoints) current = level
  }
  return current
}

export interface LevelProgress {
  level: Level
  /** null once the top level is reached. */
  next: Level | null
  /** Points still needed for `next`; 0 at the top. */
  pointsToNext: number
  /** 0–100 through the current band; 100 at the top. */
  percent: number
}

export function progressToNextLevel(points: number): LevelProgress {
  const safe = Number.isFinite(points) ? Math.max(0, points) : 0
  const level = levelFor(safe)
  const next = LEVELS.find((l) => l.index === level.index + 1) ?? null
  if (!next) return { level, next: null, pointsToNext: 0, percent: 100 }
  const span = next.minPoints - level.minPoints
  const into = safe - level.minPoints
  return {
    level,
    next,
    pointsToNext: Math.max(0, next.minPoints - safe),
    percent: span <= 0 ? 100 : Math.max(0, Math.min(100, Math.round((into / span) * 100))),
  }
}

/* ── Badges ───────────────────────────────────────────────────────────────── */

/** The raw signals a badge can be earned from. All of them come from real rows. */
export interface AchievementStats {
  /** SUM(PointEntry.points) over the student's whole history. */
  lifetimePoints: number
  /** Consecutive Sunday School sessions attended, most recent first. */
  attendanceStreak: number
  /**
   * F0734 / F0735 — distinct Sundays ever attended, all time.
   *
   * Separate from `attendanceStreak` on purpose: a streak resets the moment a
   * child misses one Sunday, so every attendance badge the portal had rewarded
   * turning up *without a gap*. A child who comes faithfully every other week
   * all year earned nothing at all, which is the gap this closes. A count, not
   * a slice, so it does not quietly cap at whatever window the query takes.
   */
  sundaysAttended: number
  /** QuizResult rows. */
  quizzesCompleted: number
  /** Best QuizResult.percentage, 0 when none. */
  bestQuizPercentage: number
  /** Consecutive days of BibleReadingLog ending today (or yesterday). */
  readingStreak: number
  /** Distinct days ever checked in. */
  readingDays: number
  /** True during the calendar month of the student's birthday. */
  isBirthdayMonth: boolean
}

export interface Badge {
  key: string
  name: string
  emoji: string
  /** Shown under a locked badge: what it takes to earn it. */
  requirement: string
  /** Progress is measured against this. */
  target: number
  /** How far along the student is, in the same unit as `target`. */
  value: (stats: AchievementStats) => number
}

export const BADGES: readonly Badge[] = [
  {
    key: 'first-fruits',
    name: 'First Fruits',
    emoji: '🌾',
    requirement: 'Earn your first 10 points',
    target: 10,
    value: (s) => s.lifetimePoints,
  },
  {
    key: 'hundredfold',
    name: 'Hundredfold',
    emoji: '💯',
    requirement: 'Reach 100 points',
    target: 100,
    value: (s) => s.lifetimePoints,
  },
  {
    key: 'treasure',
    name: 'Treasure in Heaven',
    emoji: '👑',
    requirement: 'Reach 500 points',
    target: 500,
    value: (s) => s.lifetimePoints,
  },
  {
    key: 'faithful',
    name: 'Faithful',
    emoji: '🕊️',
    requirement: 'Attend 3 Sundays in a row',
    target: 3,
    value: (s) => s.attendanceStreak,
  },
  {
    key: 'steadfast',
    name: 'Steadfast',
    emoji: '⛪',
    requirement: 'Attend 8 Sundays in a row',
    target: 8,
    value: (s) => s.attendanceStreak,
  },
  /**
   * F0734 / F0735 — the badge the old app had and this one did not.
   *
   * The old app's 'faithful' meant ten Sundays *altogether*; here it means three
   * in a row, and every other attendance badge is a streak too. So the child who
   * comes every other Sunday all year — often the one whose family drives
   * furthest — could never earn a single attendance badge.
   *
   * Added as its own key rather than by re-pointing 'faithful' at a lifetime
   * count. Changing what an existing key means would take the badge away from
   * every child currently holding it, dated; the name and the picture here are
   * decoration and can be changed freely, but this key must not be.
   */
  {
    key: 'ten-sundays',
    name: 'Ten Sundays',
    emoji: '🗓️',
    requirement: 'Come to 10 Sundays altogether',
    target: 10,
    value: (s) => s.sundaysAttended,
  },
  {
    key: 'word-student',
    name: 'Student of the Word',
    emoji: '📖',
    requirement: 'Finish your first quiz',
    target: 1,
    value: (s) => s.quizzesCompleted,
  },
  {
    key: 'scholar',
    name: 'Scholar',
    emoji: '🎓',
    requirement: 'Finish 5 quizzes',
    target: 5,
    value: (s) => s.quizzesCompleted,
  },
  {
    key: 'perfect-score',
    name: 'Perfect Score',
    emoji: '🏅',
    requirement: 'Score 100% on a quiz',
    target: 100,
    value: (s) => s.bestQuizPercentage,
  },
  {
    key: 'week-in-the-word',
    name: 'Week in the Word',
    emoji: '📜',
    requirement: 'Read the Bible 7 days in a row',
    target: 7,
    value: (s) => s.readingStreak,
  },
  {
    key: 'month-in-the-word',
    name: 'Month in the Word',
    emoji: '🔥',
    requirement: 'Read the Bible 30 days in a row',
    target: 30,
    value: (s) => s.readingStreak,
  },
  {
    key: 'birthday-blessing',
    name: 'Birthday Blessing',
    emoji: '🎂',
    requirement: 'Open the portal during your birthday month',
    target: 1,
    value: (s) => (s.isBirthdayMonth ? 1 : 0),
  },
] as const

export interface BadgeProgress {
  badge: Badge
  earned: boolean
  current: number
  target: number
  /** 0–100 toward the badge. */
  percent: number
}

export interface AchievementResult extends LevelProgress {
  earned: BadgeProgress[]
  locked: BadgeProgress[]
}

function progressFor(badge: Badge, stats: AchievementStats): BadgeProgress {
  const raw = badge.value(stats)
  const current = Number.isFinite(raw) ? Math.max(0, raw) : 0
  const capped = Math.min(current, badge.target)
  return {
    badge,
    earned: current >= badge.target,
    current: capped,
    target: badge.target,
    percent: badge.target <= 0 ? 100 : Math.max(0, Math.min(100, Math.round((capped / badge.target) * 100))),
  }
}

/**
 * Split every badge into earned / locked, each carrying its progress.
 * Locked badges come back nearest-first so "the next one in reach" is simply
 * `locked[0]`.
 */
export function evaluateAchievements(stats: AchievementStats): AchievementResult {
  const rows = BADGES.map((b) => progressFor(b, stats))
  return {
    ...progressToNextLevel(stats.lifetimePoints),
    earned: rows.filter((r) => r.earned),
    locked: rows.filter((r) => !r.earned).sort((a, b) => b.percent - a.percent),
  }
}

const BADGE_ORDER = new Map(BADGES.map((b, i) => [b.key, i]))

/**
 * A badge, once earned, is kept forever.
 *
 * Five of the eleven badges hang off a streak or a window — three Sundays in a
 * row, a seven-day reading streak, the student's birthday month — so evaluating
 * only today's signals would silently un-earn them the moment the streak lapses
 * or the month turns over. `evaluateAchievements` stays pure and answers "what
 * does today qualify for"; this folds the persisted StudentAchievement keys back
 * in so the answer becomes "what has this student ever earned".
 *
 * Progress numbers are left truthful (a lapsed reading streak still reads 0/7);
 * only membership moves.
 */
export function mergePersistedBadges(
  result: AchievementResult,
  persistedKeys: Iterable<string>,
): AchievementResult {
  const keys = persistedKeys instanceof Set ? persistedKeys : new Set(persistedKeys)
  if (keys.size === 0) return result
  const rows = [...result.earned, ...result.locked].map((row) =>
    row.earned || !keys.has(row.badge.key) ? row : { ...row, earned: true },
  )
  return {
    ...result,
    earned: rows
      .filter((r) => r.earned)
      .sort((a, b) => (BADGE_ORDER.get(a.badge.key) ?? 0) - (BADGE_ORDER.get(b.badge.key) ?? 0)),
    locked: rows.filter((r) => !r.earned).sort((a, b) => b.percent - a.percent),
  }
}

/* ── Streaks ──────────────────────────────────────────────────────────────── */

/**
 * Consecutive Bible-reading days ending today. Yesterday still counts as a live
 * streak so the number does not collapse before the student checks in today.
 * Order of `dates` does not matter; duplicates are ignored.
 */
export function readingStreak(dates: string[], today: string): number {
  const seen = new Set(dates)
  let cursor = seen.has(today) ? today : addDays(today, -1)
  if (!seen.has(cursor)) return 0
  let streak = 0
  // A student cannot have a streak longer than a few years of daily rows.
  while (seen.has(cursor) && streak < 4000) {
    streak += 1
    cursor = addDays(cursor, -1)
  }
  return streak
}

/**
 * Consecutive attended sessions counting back from the most recent one.
 * Excused absences are skipped rather than counted or fatal — the same
 * treatment `attendanceRate` gives them.
 */
export function presentStreak(history: Array<{ date: string; status: Status }>): number {
  const sorted = [...history].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  let streak = 0
  for (const row of sorted) {
    if (row.status === 'PRESENT') streak += 1
    else if (row.status === 'EXCUSED') continue
    else break
  }
  return streak
}

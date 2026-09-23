/**
 * Grouping for the Daily Readings page (F0751 / F0521).
 *
 * The prototype filed the day's readings under the service they are read at (OG
 * L13434-13446). The port drew them as a flat grid of a dozen equal cards, so
 * whoever is reading at the altar had to scan every title to find the one about
 * to be read — the church reads by service, not by card.
 *
 * It lives here rather than inside the page because of the one rule this
 * grouping must never break: no reading may fall through it. The labels come
 * from `SECTION_LABELS` in lib/coptic-api.ts, and a future feed change or a new
 * label added there must not make a reading disappear off the page. A pure
 * function can be held to that by a test; JSX in a `.map()` cannot.
 */

export interface ReadingService {
  label: string
  glyph: string
  colour: string
}

/**
 * In the order the church prays them: the Coptic day begins at sunset, so
 * Vespers comes first, then Matins at dawn, then the Liturgy.
 */
export const READING_SERVICES: readonly (ReadingService & { test: RegExp })[] = [
  { label: 'Vespers', glyph: '\u{1F56F}️', colour: '#6F1D1B', test: /^vespers\b/i },
  { label: 'Matins', glyph: '\u{1F305}', colour: '#C89B3C', test: /^matins\b/i },
  // The Pauline, the Catholic and Acts are all read in the Liturgy, before the
  // Liturgy Gospel — which is why they group here rather than standing alone.
  { label: 'Liturgy', glyph: '✟', colour: '#166534', test: /^(liturgy\b|pauline\b|catholic\b|acts$)/i },
  { label: 'Evening Prayer', glyph: '\u{1F319}', colour: '#3F3D56', test: /^evening\b/i },
] as const

/** Anything the list above does not claim — Prophecies today, and whatever a
 *  future feed adds. It exists so that nothing can ever be dropped silently. */
export const OTHER_READINGS: ReadingService = {
  label: 'Other readings',
  glyph: '\u{1F4D6}',
  colour: '#7C7A7A',
}

/**
 * Buckets the day's sections by service, in liturgical order, dropping services
 * that have no readings today. Every input section comes out in exactly one
 * bucket. Matched case-insensitively, since these labels render uppercase.
 */
export function groupReadingsByService<T extends { section: string }>(
  sections: readonly T[],
): Array<{ service: ReadingService; sections: T[] }> {
  const out: Array<{ service: ReadingService; sections: T[] }> = []
  const claimed = new Set<T>()
  for (const { label, glyph, colour, test } of READING_SERVICES) {
    const mine = sections.filter((s) => test.test(s.section))
    for (const s of mine) claimed.add(s)
    if (mine.length > 0) out.push({ service: { label, glyph, colour }, sections: mine })
  }
  const rest = sections.filter((s) => !claimed.has(s))
  if (rest.length > 0) out.push({ service: OTHER_READINGS, sections: rest })
  return out
}

/**
 * The days of the calendar month `todayKey` falls in (F0329 / F0754).
 *
 * The port drew a rolling 30-day window ending today. The prototype drew the
 * month, and the difference is not cosmetic: a child on the 3rd of the month saw
 * 27 squares belonging to *last* month, so "9/30" described a stretch nobody
 * thinks in. A month grid answers the question a child actually asks — "how have
 * I done this month?" — and resets, which is the point of it.
 *
 * Days after today are returned marked `future` so they can be drawn as not-yet
 * rather than as missed: a month grid necessarily contains days that have not
 * happened, and colouring them the same as a skipped day would tell a child on
 * the 2nd that they had already missed 29 days.
 *
 * Pure string maths, no Date parsing of the church day, so it cannot slip a
 * month at either end the way a UTC parse does.
 */
export function readingMonthDays(todayKey: string): Array<{ date: string; future: boolean }> {
  const year = Number(todayKey.slice(0, 4))
  const month = Number(todayKey.slice(5, 7))
  // Day 0 of the next month is the last day of this one.
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const out: Array<{ date: string; future: boolean }> = []
  for (let d = 1; d <= lastDay; d++) {
    const date = `${todayKey.slice(0, 7)}-${String(d).padStart(2, '0')}`
    out.push({ date, future: date > todayKey })
  }
  return out
}

/** "September 2026" — the label the prototype put above the grid. */
export function readingMonthLabel(todayKey: string): string {
  const year = Number(todayKey.slice(0, 4))
  const month = Number(todayKey.slice(5, 7))
  return `${new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' })} ${year}`
}

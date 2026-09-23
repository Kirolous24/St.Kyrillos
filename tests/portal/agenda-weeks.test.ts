import { describe, it, expect } from 'vitest'
import {
  ordinalLabel, weeksInMonth, schoolYearWeeks, agendaWeekName, AGPEYA_HOURS,
  agendaBlankTemplateRows, AGENDA_CSV_HEADERS, AGENDA_ACTIVITIES, csvRowsToAgenda,
} from '@/lib/portal/agenda'
import { toCsv, parseCsvRecords } from '@/lib/portal/csv'
import { schoolYearMonths } from '@/lib/portal/reports'

describe('ordinalLabel', () => {
  it('handles the ordinary cases', () => {
    expect([1, 2, 3, 4, 5].map(ordinalLabel)).toEqual(['1st', '2nd', '3rd', '4th', '5th'])
  })

  it('handles the teens, which do not follow the last digit', () => {
    expect([11, 12, 13].map(ordinalLabel)).toEqual(['11th', '12th', '13th'])
  })

  it('handles 21st through 23rd', () => {
    expect([21, 22, 23].map(ordinalLabel)).toEqual(['21st', '22nd', '23rd'])
  })
})

describe('weeksInMonth', () => {
  it('starts on the Monday on or before the 1st, as the prototype did', () => {
    // 1 Sep 2026 is a Tuesday, so the first week starts Monday 31 Aug.
    expect(weeksInMonth('2026-09')[0]).toBe('2026-08-31')
  })

  it('covers every week that touches the month', () => {
    const weeks = weeksInMonth('2026-09')
    expect(weeks.length).toBeGreaterThanOrEqual(4)
    expect(weeks.length).toBeLessThanOrEqual(6)
    // Every entry is a Monday.
    for (const w of weeks) expect(new Date(`${w}T12:00:00Z`).getUTCDay()).toBe(1)
  })

  it('does not run past the end of the month', () => {
    const weeks = weeksInMonth('2026-09')
    expect(weeks[weeks.length - 1]! <= '2026-09-30').toBe(true)
  })

  it('handles a month that begins on a Monday without adding a week before it', () => {
    // 1 Jun 2026 is a Monday.
    expect(weeksInMonth('2026-06')[0]).toBe('2026-06-01')
  })
})

describe('schoolYearWeeks', () => {
  it('runs September through August', () => {
    const weeks = schoolYearWeeks('2026-10-15')
    expect(weeks[0]!.label).toMatch(/Week of SEP/)
    expect(weeks[weeks.length - 1]!.label).toMatch(/Week of AUG/)
  })

  it('treats a date before September as the back half of the year that started last September', () => {
    const weeks = schoolYearWeeks('2027-02-10')
    expect(weeks[0]!.key.startsWith('2026-08') || weeks[0]!.key.startsWith('2026-09')).toBe(true)
  })

  it('names weeks the way the church does', () => {
    const weeks = schoolYearWeeks('2026-10-15')
    expect(weeks[0]!.label).toBe('1st Week of SEP')
    expect(weeks[1]!.label).toBe('2nd Week of SEP')
  })

  it('gives every week a distinct Monday key', () => {
    const weeks = schoolYearWeeks('2026-10-15')
    expect(new Set(weeks.map((w) => w.key)).size).toBe(weeks.length)
  })

  it('never skips a month\u2019s first week', () => {
    // A week straddling two months belongs to exactly one of them, so every
    // month that appears at all must start its count at 1. Dropping the
    // duplicate instead would leave a month whose weeks began at "2nd".
    const weeks = schoolYearWeeks('2026-10-15')
    const firstSeen = new Map<string, string>()
    for (const w of weeks) {
      const month = w.label.split(' of ')[1]!
      if (!firstSeen.has(month)) firstSeen.set(month, w.label)
    }
    for (const [month, label] of Array.from(firstSeen.entries())) {
      expect(label, `${month} should start at 1st`).toBe(`1st Week of ${month}`)
    }
  })

  it('numbers each month\u2019s weeks consecutively', () => {
    const weeks = schoolYearWeeks('2026-10-15')
    const byMonth = new Map<string, number[]>()
    for (const w of weeks) {
      const [ord, , , month] = w.label.split(' ')
      const n = Number(ord!.replace(/\D/g, ''))
      byMonth.set(month!, [...(byMonth.get(month!) ?? []), n])
    }
    for (const [month, ns] of Array.from(byMonth.entries())) {
      expect(ns, month).toEqual(ns.map((_v: number, i: number) => i + 1))
    }
  })
})

describe('agendaWeekName', () => {
  it('names a week inside the school year', () => {
    expect(agendaWeekName('2026-09-07', '2026-10-15')).toBe('2nd Week of SEP')
  })

  it('falls back to null outside the school year rather than inventing a name', () => {
    expect(agendaWeekName('2021-01-04', '2026-10-15')).toBeNull()
  })
})

describe('AGPEYA_HOURS', () => {
  it('is the prototype’s six hours, in its order', () => {
    expect(AGPEYA_HOURS).toEqual(['1st', '2nd', '3rd', '9th', '11th', '12th'])
  })
})

describe('agendaBlankTemplateRows', () => {
  const rows = agendaBlankTemplateRows('2026-10-15')

  it('uses the same header the importer reads, so the file can come back', () => {
    expect(rows[0]).toEqual([...AGENDA_CSV_HEADERS])
  })

  it('covers the whole school year, ten activities a week', () => {
    const weeks = schoolYearWeeks('2026-10-15')
    expect(rows.length - 1).toBe(weeks.length * AGENDA_ACTIVITIES.length)
  })

  it('leaves the topic and servant columns empty', () => {
    const topicIdx = (AGENDA_CSV_HEADERS as readonly string[]).indexOf('Topic')
    const servantIdx = (AGENDA_CSV_HEADERS as readonly string[]).indexOf('Servant')
    for (const r of rows.slice(1)) {
      expect(r[topicIdx]).toBe('')
      expect(r[servantIdx]).toBe('')
    }
  })

  it('round-trips through the importer without inventing content', () => {
    // The point of the template: what it emits, the importer must accept.
    // Goes through the real pipeline — serialise, then parse — rather than
    // hand-building records, because `csvRowsToAgenda` expects the header
    // names `parseCsvRecords` produces, not the ones the file carries.
    const parsed = csvRowsToAgenda(parseCsvRecords(toCsv(rows)))
    expect(parsed.skipped, 'every template row must be readable').toBe(0)
    expect(parsed.weeks.length).toBe(schoolYearWeeks('2026-10-15').length)
    // And it must not smuggle in content: every parsed topic is blank.
    for (const w of parsed.weeks) {
      for (const item of w.items) expect(item.topic ?? '').toBe('')
    }
  })
})

describe('schoolYearMonths', () => {
  it('runs September through August, not January through December', () => {
    const m = schoolYearMonths('2026-10-15')
    expect(m).toHaveLength(12)
    expect(m[0]!.abbr).toBe('SEP')
    expect(m[11]!.abbr).toBe('AUG')
  })

  it('rolls the year over in January, not in September', () => {
    const m = schoolYearMonths('2026-10-15')
    expect(m[0]!.key).toBe('2026-09')
    expect(m[4]!.key).toBe('2027-01')
    expect(m[11]!.key).toBe('2027-08')
  })

  it('treats a spring date as the back half of the year that began last September', () => {
    const m = schoolYearMonths('2027-02-10')
    expect(m[0]!.key).toBe('2026-09')
  })

  it('gives every month a distinct key', () => {
    const m = schoolYearMonths('2026-10-15')
    expect(new Set(m.map((x) => x.key)).size).toBe(12)
  })
})

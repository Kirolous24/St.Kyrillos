import { describe, it, expect } from 'vitest'
import { parseCsvRecords } from '@/lib/portal/csv'
import {
  isLegacyAgendaCsv,
  legacyAgendaCsvToRecords,
  csvRowsToAgenda,
  agendaToCsvRows,
} from '@/lib/portal/agenda'

/**
 * F0216 — a schedule exported from the old Firebase app.
 *
 * The header below is built exactly as the prototype built it
 * (`agendaCsvRowsForClass`, OG L8691-8713): `Week, Date`, then a
 * `<label> - Topic` / `<label> - Servant` pair per activity in the old app's own
 * wording, then `Slide Link, Lead Servant, Back-Up, Notes`. Before this reader
 * existed such a file imported as *nothing* — its `Week` column reads
 * "1st Week of SEP", which is not a date, so every row was skipped.
 */
const OG_HEADER = [
  'Week', 'Date',
  'Agpeya Prayer - Topic', 'Agpeya Prayer - Servant',
  'Song - Topic', 'Song - Servant',
  'The Seasons of the Coptic Church - Topic', 'The Seasons of the Coptic Church - Servant',
  'LESSON - Topic', 'LESSON - Servant',
  'Bible Study - Topic', 'Bible Study - Servant',
  'Coptic - Topic', 'Coptic - Servant',
  'Ritual - Topic', 'Ritual - Servant',
  'Verse - Topic', 'Verse - Servant',
  'Memorization - Topic', 'Memorization - Servant',
  'SAINT - Topic', 'SAINT - Servant',
  'Slide Link', 'Lead Servant', 'Back-Up', 'Notes',
].join(',')

const ogCsv = (...rows: string[]) => [OG_HEADER, ...rows].join('\n')

describe('the old app’s schedule format', () => {
  it('is recognised, and the current format is not mistaken for it', () => {
    const legacy = parseCsvRecords(ogCsv('1st Week of SEP,9/7/2026,,,,,,,,,,,,,,,,,,,,,,,,'))
    expect(isLegacyAgendaCsv(legacy)).toBe(true)

    // The portal's own export must never be run through the legacy reader.
    const ours = parseCsvRecords(agendaToCsvRows([
      { weekStart: '2026-09-07', slideLink: null, notes: null, leadServantName: null, backupServantName: null, items: [] },
    ]).map((r) => r.join(',')).join('\n'))
    expect(isLegacyAgendaCsv(ours)).toBe(false)
  })

  it('reads a week the old app wrote, date column and all', () => {
    const csv = ogCsv(
      '1st Week of SEP,9/7/2026,3rd,Mina,Psalm 150,Mariam,Nayrouz,,The Good Shepherd,Abanoub,James 1,,Alphabet,,Incense,,John 3:16,Mina,Ten Commandments,,St. Moses the Black,Mariam,https://slides.example.com/1,Mina,Mariam,Bring the new hymn sheets',
    )
    const records = parseCsvRecords(csv)
    const rows = legacyAgendaCsvToRecords(records)
    const { weeks, skipped } = csvRowsToAgenda(rows)

    expect(skipped).toBe(0)
    expect(weeks).toHaveLength(1)
    const week = weeks[0]!
    // 7 Sep 2026 is a Monday, and both apps run weeks Monday to Sunday.
    expect(week.weekStart).toBe('2026-09-07')
    expect(week.slideLink).toBe('https://slides.example.com/1')
    expect(week.notes).toBe('Bring the new hymn sheets')
    expect(week.leadServantName).toBe('Mina')
    expect(week.backupServantName).toBe('Mariam')

    const topics = new Map(week.items.map((i) => [i.activityKey, i.topic]))
    // The old app's own wordings resolve to this portal's activity keys.
    expect(topics.get('agpeya')).toBe('3rd')
    expect(topics.get('seasons')).toBe('Nayrouz')
    expect(topics.get('lesson')).toBe('The Good Shepherd')
    expect(topics.get('saint')).toBe('St. Moses the Black')
    expect(topics.get('memorization')).toBe('Ten Commandments')
  })

  it('snaps a date mid-week back to its Monday', () => {
    // The old app wrote Mondays, but a hand-edited file may not.
    const rows = legacyAgendaCsvToRecords(
      parseCsvRecords(ogCsv('2nd Week of SEP,9/10/2026,,,,,,,The Sower,Abanoub,,,,,,,,,,,,,,,,')),
    )
    const { weeks } = csvRowsToAgenda(rows)
    expect(weeks[0]!.weekStart).toBe('2026-09-07')
  })

  it('leaves out activities nobody filled in', () => {
    const rows = legacyAgendaCsvToRecords(
      parseCsvRecords(ogCsv('1st Week of SEP,9/7/2026,,,,,,,The Sower,,,,,,,,,,,,,,,,,')),
    )
    // One filled activity means one row, not ten blank ones.
    expect(rows).toHaveLength(1)
    expect(rows[0]!['activity key']).toBe('lesson')
    expect(rows[0]!.topic).toBe('The Sower')
  })

  it('keeps a week that has notes but no topics yet', () => {
    // A servant who booked the room before planning the lesson.
    const rows = legacyAgendaCsvToRecords(
      parseCsvRecords(ogCsv('1st Week of SEP,9/7/2026,,,,,,,,,,,,,,,,,,,,,,,,Room booked')),
    )
    const { weeks } = csvRowsToAgenda(rows)
    expect(weeks).toHaveLength(1)
    expect(weeks[0]!.notes).toBe('Room booked')
  })

  it('reports an unusable date against its own line rather than dropping it', () => {
    const rows = legacyAgendaCsvToRecords(
      parseCsvRecords(ogCsv(
        '1st Week of SEP,9/7/2026,,,,,,,The Sower,,,,,,,,,,,,,,,,,',
        'TOTALS,,,,,,,,,,,,,,,,,,,,,,,,,',
      )),
    )
    const { weeks, skipped, skippedRowDetail } = csvRowsToAgenda(rows)
    expect(weeks).toHaveLength(1)
    expect(skipped).toBe(1)
    expect(skippedRowDetail[0]!.reason).toContain('no week start')
  })

  it('carries a whole year without losing a week', () => {
    // 40 Mondays from 7 Sep 2026, one lesson each — the case the church would
    // otherwise have retyped by hand.
    const lines: string[] = []
    for (let i = 0; i < 40; i++) {
      const d = new Date(Date.UTC(2026, 8, 7 + i * 7))
      const date = `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`
      lines.push(`Week ${i + 1},${date},,,,,,,Lesson ${i + 1},Mina,,,,,,,,,,,,,,,,`)
    }
    const { weeks, skipped } = csvRowsToAgenda(legacyAgendaCsvToRecords(parseCsvRecords(ogCsv(...lines))))
    expect(skipped).toBe(0)
    expect(weeks).toHaveLength(40)
    expect(new Set(weeks.map((w) => w.weekStart)).size).toBe(40)
  })
})

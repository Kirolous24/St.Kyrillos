import { describe, it, expect } from 'vitest'
import { parseCsvRecords, toCsv } from '@/lib/portal/csv'
import {
  AGENDA_ACTIVITIES,
  agendaActivityLabel,
  agendaToCsvRows,
  buildWeekGrid,
  csvRowsToAgenda,
  groupAssignmentsByWeek,
  isAgendaActivityKey,
  isWeekEmpty,
  normaliseWeekDraft,
  normaliseWeekStart,
  parseLessonLinks,
  resolveActivityKey,
  safeUrl,
  weekDistanceLabel,
  weekLabel,
  type Assignment,
  type AgendaWeekDraft,
} from '@/lib/portal/agenda'

describe('AGENDA_ACTIVITIES', () => {
  it('is the ten fixed activities in running order', () => {
    expect(AGENDA_ACTIVITIES).toHaveLength(10)
    expect(AGENDA_ACTIVITIES.map((a) => a.key)).toEqual([
      'agpeya', 'song', 'seasons', 'lesson', 'bibleStudy',
      'coptic', 'ritual', 'verse', 'memorization', 'saint',
    ])
    expect(AGENDA_ACTIVITIES.map((a) => a.order)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  it('has unique keys and labels', () => {
    expect(new Set(AGENDA_ACTIVITIES.map((a) => a.key)).size).toBe(10)
    expect(new Set(AGENDA_ACTIVITIES.map((a) => a.label)).size).toBe(10)
  })

  it('recognises keys and resolves display labels back to keys', () => {
    expect(isAgendaActivityKey('bibleStudy')).toBe(true)
    expect(isAgendaActivityKey('snacks')).toBe(false)
    expect(resolveActivityKey('bibleStudy')).toBe('bibleStudy')
    expect(resolveActivityKey('Bible Study')).toBe('bibleStudy')
    expect(resolveActivityKey('  saint of the week ')).toBe('saint')
    expect(resolveActivityKey('nonsense')).toBeNull()
    expect(resolveActivityKey('')).toBeNull()
    expect(agendaActivityLabel('memorization')).toBe('Memorization')
  })
})

describe('week keys', () => {
  it('snaps any day to its Monday', () => {
    expect(normaliseWeekStart('2026-09-16')).toBe('2026-09-14') // Wednesday
    expect(normaliseWeekStart('2026-09-14')).toBe('2026-09-14') // Monday itself
    expect(normaliseWeekStart('2026-09-20')).toBe('2026-09-14') // Sunday belongs to the week before
    expect(normaliseWeekStart('9/16/2026')).toBe('2026-09-14')
  })

  it('returns null for unusable input instead of an Invalid Date', () => {
    expect(normaliseWeekStart('not-a-date')).toBeNull()
    expect(normaliseWeekStart('')).toBeNull()
    expect(normaliseWeekStart(null)).toBeNull()
    expect(normaliseWeekStart('2026-02-30')).toBeNull()
  })

  it('labels a week Monday-to-Sunday', () => {
    expect(weekLabel('2026-09-14')).toBe('Sep 14 – Sep 20, 2026')
    expect(weekLabel('2026-09-17')).toBe('Sep 14 – Sep 20, 2026')
    expect(weekLabel('2026-12-28')).toBe('Dec 28 – Jan 3, 2027')
    expect(weekLabel('rubbish')).toBe('Unknown week')
  })

  it('describes distance from today', () => {
    const today = '2026-09-16'
    expect(weekDistanceLabel('2026-09-14', today)).toBe('This week')
    expect(weekDistanceLabel('2026-09-21', today)).toBe('Next week')
    expect(weekDistanceLabel('2026-09-07', today)).toBe('Last week')
    expect(weekDistanceLabel('2026-10-05', today)).toBe('In 3 weeks')
    expect(weekDistanceLabel('2026-08-31', today)).toBe('2 weeks ago')
  })
})

describe('buildWeekGrid', () => {
  it('always returns the ten activities in order, blanks where nothing is stored', () => {
    const grid = buildWeekGrid('2026-09-14', [
      { activityKey: 'lesson', topic: 'The Good Samaritan', servantId: 's1', servantName: 'Mina' },
    ])
    expect(grid.rows).toHaveLength(10)
    expect(grid.rows.map((r) => r.key)).toEqual(AGENDA_ACTIVITIES.map((a) => a.key))
    const lesson = grid.rows.find((r) => r.key === 'lesson')!
    expect(lesson).toMatchObject({ topic: 'The Good Samaritan', servantId: 's1', servantName: 'Mina', label: 'Lesson' })
    const agpeya = grid.rows.find((r) => r.key === 'agpeya')!
    expect(agpeya.topic).toBeNull()
    expect(agpeya.servantId).toBeNull()
  })

  it('normalises the week start and whitespace-only values', () => {
    const grid = buildWeekGrid('2026-09-17', [{ activityKey: 'song', topic: '   ', servantName: '' }])
    expect(grid.weekStart).toBe('2026-09-14')
    expect(grid.label).toBe('Sep 14 – Sep 20, 2026')
    expect(grid.rows.find((r) => r.key === 'song')!.topic).toBeNull()
  })

  it('ignores unknown activities and keeps the first row for a duplicated key', () => {
    const grid = buildWeekGrid('2026-09-14', [
      { activityKey: 'verse', topic: 'Psalm 23' },
      { activityKey: 'verse', topic: 'Psalm 51' },
      { activityKey: 'pizza', topic: 'Pepperoni' },
    ])
    expect(grid.rows).toHaveLength(10)
    expect(grid.rows.find((r) => r.key === 'verse')!.topic).toBe('Psalm 23')
    expect(grid.rows.some((r) => (r.key as string) === 'pizza')).toBe(false)
  })
})

describe('isWeekEmpty', () => {
  const bare = { slideLink: null, notes: null, leadServantName: null, backupServantName: null, items: [] }
  it('is true for a week with nothing filled in', () => {
    expect(isWeekEmpty(bare)).toBe(true)
    expect(isWeekEmpty({ ...bare, slideLink: '   ', items: [{ topic: '', servantName: null }] })).toBe(true)
  })
  it('is false once anything is set', () => {
    expect(isWeekEmpty({ ...bare, notes: 'Bring the projector' })).toBe(false)
    expect(isWeekEmpty({ ...bare, leadServantName: 'Mina' })).toBe(false)
    expect(isWeekEmpty({ ...bare, items: [{ topic: 'Psalm 23', servantName: null }] })).toBe(false)
  })
})

describe('agenda CSV round-trip', () => {
  const draft: AgendaWeekDraft = {
    weekStart: '2026-09-14',
    slideLink: 'https://example.org/slides,2026',
    notes: 'Bring the "projector"\nand the speaker',
    leadServantName: 'Mina Adel',
    backupServantName: 'Mariam Fayez',
    items: [
      { activityKey: 'lesson', topic: 'The Good Samaritan', servantName: 'Mina Adel' },
      { activityKey: 'verse', topic: 'Luke 10:27', servantName: null },
    ],
  }

  it('writes a header plus ten rows per week', () => {
    const rows = agendaToCsvRows([draft])
    expect(rows[0]![0]).toBe('Week Start')
    expect(rows).toHaveLength(11)
    expect(rows.slice(1).every((r) => r[0] === '2026-09-14')).toBe(true)
    expect(rows.slice(1).map((r) => r[5])).toEqual(AGENDA_ACTIVITIES.map((a) => a.key))
  })

  it('survives a full export → parse → import cycle, commas and quotes included', () => {
    const csv = toCsv(agendaToCsvRows([draft]))
    const { weeks, skipped } = csvRowsToAgenda(parseCsvRecords(csv))
    expect(skipped).toBe(0)
    expect(weeks).toEqual([normaliseWeekDraft(draft)])
    expect(weeks[0]!.notes).toBe('Bring the "projector"\nand the speaker')
    expect(weeks[0]!.slideLink).toBe('https://example.org/slides,2026')
  })

  it('round-trips several weeks and orders them oldest first', () => {
    const second: AgendaWeekDraft = { ...draft, weekStart: '2026-09-21', notes: null, items: [] }
    const csv = toCsv(agendaToCsvRows([second, draft]))
    const { weeks } = csvRowsToAgenda(parseCsvRecords(csv))
    expect(weeks.map((w) => w.weekStart)).toEqual(['2026-09-14', '2026-09-21'])
    expect(weeks[1]!.items).toHaveLength(10)
    expect(weeks[1]!.items.every((i) => i.topic === null)).toBe(true)
  })

  it('accepts a hand-edited file: loose headers, a day mid-week, display labels', () => {
    const csv = [
      'week start,activity,topic,servant,lead servant',
      '2026-09-16,Bible Study,Acts 2,Mina,Mariam',
    ].join('\n')
    const { weeks, skipped } = csvRowsToAgenda(parseCsvRecords(csv))
    expect(skipped).toBe(0)
    expect(weeks).toHaveLength(1)
    expect(weeks[0]!.weekStart).toBe('2026-09-14')
    expect(weeks[0]!.leadServantName).toBe('Mariam')
    expect(weeks[0]!.items.find((i) => i.activityKey === 'bibleStudy')!.topic).toBe('Acts 2')
  })

  it('skips unusable rows rather than losing the whole file', () => {
    const csv = [
      'Week Start,Activity Key,Topic',
      'not-a-date,lesson,Ignored',
      '2026-09-14,pizza,Ignored too',
      '2026-09-14,lesson,Kept',
      '2026-09-14,lesson,Duplicate',
    ].join('\n')
    const { weeks, skipped } = csvRowsToAgenda(parseCsvRecords(csv))
    expect(skipped).toBe(3)
    expect(weeks).toHaveLength(1)
    expect(weeks[0]!.items.find((i) => i.activityKey === 'lesson')!.topic).toBe('Kept')
  })

  it('round-trips values a spreadsheet would read as a formula', () => {
    // escapeCsvField guards a leading =, +, - or @ with an apostrophe; the
    // import has to take it back off or a dashed notes list comes back broken.
    const guarded: AgendaWeekDraft = {
      weekStart: '2026-09-14',
      slideLink: null,
      notes: '- bring the projector',
      leadServantName: '@Mina',
      backupServantName: null,
      items: [
        { activityKey: 'lesson', topic: '-Psalm 50', servantName: null },
        { activityKey: 'verse', topic: '=Luke 10:27', servantName: '+Mariam' },
      ],
    }
    const csv = toCsv(agendaToCsvRows([guarded]))
    expect(csv).toContain("'-Psalm 50")
    const { weeks, skipped } = csvRowsToAgenda(parseCsvRecords(csv))
    expect(skipped).toBe(0)
    expect(weeks).toEqual([normaliseWeekDraft(guarded)])
    expect(weeks[0]!.notes).toBe('- bring the projector')
    expect(weeks[0]!.leadServantName).toBe('@Mina')
    expect(weeks[0]!.items.find((i) => i.activityKey === 'lesson')!.topic).toBe('-Psalm 50')
    expect(weeks[0]!.items.find((i) => i.activityKey === 'verse')!.topic).toBe('=Luke 10:27')
    expect(weeks[0]!.items.find((i) => i.activityKey === 'verse')!.servantName).toBe('+Mariam')
  })

  it('leaves an apostrophe alone when it is part of the text', () => {
    const csv = [
      'Week Start,Activity Key,Topic',
      "2026-09-14,lesson,'Tis the season",
    ].join('\n')
    const { weeks } = csvRowsToAgenda(parseCsvRecords(csv))
    expect(weeks[0]!.items.find((i) => i.activityKey === 'lesson')!.topic).toBe("'Tis the season")
  })

  it('returns nothing for an empty file', () => {
    expect(csvRowsToAgenda(parseCsvRecords(''))).toEqual({ weeks: [], skipped: 0, skippedRowDetail: [] })
  })

  // F0797 — "12 rows skipped" told a servant nothing they could act on: not which
  // lines, and not whether the problem was the date column or the activity name.
  describe('skipped rows say which line and why (F0797)', () => {
    const header = 'Week Start,Activity,Topic\n'

    it('names the row and the column when the week start is not a date', () => {
      const { skipped, skippedRowDetail } = csvRowsToAgenda(parseCsvRecords(`${header}not-a-date,Lesson,Creation\n`))
      expect(skipped).toBe(1)
      expect(skippedRowDetail).toHaveLength(1)
      expect(skippedRowDetail[0]!.row).toBe(1)
      expect(skippedRowDetail[0]!.reason).toContain('not-a-date')
      expect(skippedRowDetail[0]!.reason).toContain('week start')
    })

    it('names the activity when that is the unreadable column', () => {
      const { skippedRowDetail } = csvRowsToAgenda(parseCsvRecords(`${header}2026-09-14,Interpretive Dance,x\n`))
      expect(skippedRowDetail[0]!.reason).toContain('Interpretive Dance')
      expect(skippedRowDetail[0]!.reason).not.toContain('week start')
    })

    it('says both when both columns are wrong', () => {
      const { skippedRowDetail } = csvRowsToAgenda(parseCsvRecords(`${header}nope,also-nope,x\n`))
      expect(skippedRowDetail[0]!.reason).toContain('week start')
      expect(skippedRowDetail[0]!.reason).toContain('also-nope')
    })

    it('says so when a column is simply empty rather than quoting nothing', () => {
      const { skippedRowDetail } = csvRowsToAgenda(parseCsvRecords(`${header},Lesson,x\n`))
      expect(skippedRowDetail[0]!.reason).toContain('no week start')
      expect(skippedRowDetail[0]!.reason).not.toContain('""')
    })

    it('explains the duplicate-activity case, which nobody guesses', () => {
      const csv = `${header}2026-09-14,Lesson,First\n2026-09-14,Lesson,Second\n`
      const { weeks, skipped, skippedRowDetail } = csvRowsToAgenda(parseCsvRecords(csv))
      expect(skipped).toBe(1)
      expect(skippedRowDetail[0]!.row).toBe(2)
      expect(skippedRowDetail[0]!.reason).toContain('already set')
      // The first one is the one kept, which the message implies.
      expect(weeks[0]!.items.find((i) => i.activityKey === 'lesson')!.topic).toBe('First')
    })

    it('numbers rows as a spreadsheet does once the header is accounted for', () => {
      const csv = `${header}2026-09-14,Lesson,Fine\nbad,Lesson,x\n`
      const { skippedRowDetail } = csvRowsToAgenda(parseCsvRecords(csv))
      expect(skippedRowDetail[0]!.row).toBe(2)
    })
  })
})

describe('link handling', () => {
  it('allows only http and https', () => {
    expect(safeUrl('https://example.org/a')).toBe('https://example.org/a')
    expect(safeUrl('http://example.org/')).toBe('http://example.org/')
    expect(safeUrl('javascript:alert(1)')).toBeNull()
    expect(safeUrl('data:text/html,<script>')).toBeNull()
    expect(safeUrl('/portal/lessons')).toBeNull()
    expect(safeUrl('   ')).toBeNull()
    expect(safeUrl(42)).toBeNull()
    expect(safeUrl(null)).toBeNull()
  })

  it('reads Lesson.links defensively', () => {
    expect(parseLessonLinks(null)).toEqual([])
    expect(parseLessonLinks('https://example.org')).toEqual([])
    expect(parseLessonLinks([{ label: 'Slides', url: 'https://example.org/s' }])).toEqual([
      { label: 'Slides', url: 'https://example.org/s' },
    ])
    expect(parseLessonLinks([{ url: 'https://example.org/s' }])[0]!.label).toBe('https://example.org/s')
    expect(parseLessonLinks([{ label: 'Bad', url: 'javascript:alert(1)' }, null, 7])).toEqual([])
  })

  it('caps the number of links it will render', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ label: `L${i}`, url: `https://example.org/${i}` }))
    expect(parseLessonLinks(many)).toHaveLength(12)
  })
})

describe('groupAssignmentsByWeek', () => {
  const base = { classId: 'c1', className: '5th–6th Boys', detail: null, date: null, href: '/portal/agenda' }
  const make = (id: string, kind: Assignment['kind'], weekStart: string | null, title = id): Assignment => ({
    ...base, id, kind, weekStart, title,
  })

  it('splits upcoming from past around today’s Monday', () => {
    const grouped = groupAssignmentsByWeek(
      [
        make('a', 'agenda', '2026-09-21'),
        make('b', 'agenda', '2026-09-14'),
        make('c', 'agenda', '2026-09-07'),
        make('d', 'agenda', '2026-08-31'),
      ],
      '2026-09-16',
    )
    expect(grouped.upcoming.map((w) => w.weekStart)).toEqual(['2026-09-14', '2026-09-21'])
    expect(grouped.past.map((w) => w.weekStart)).toEqual(['2026-09-07', '2026-08-31'])
  })

  it('keeps the current week as upcoming, not past', () => {
    const grouped = groupAssignmentsByWeek([make('a', 'lead', '2026-09-20')], '2026-09-16')
    expect(grouped.past).toHaveLength(0)
    expect(grouped.upcoming[0]!.weekStart).toBe('2026-09-14')
    expect(grouped.upcoming[0]!.label).toBe('Sep 14 – Sep 20, 2026')
  })

  it('orders lead, then backup, then lessons, then agenda items by running order', () => {
    const grouped = groupAssignmentsByWeek(
      [
        { ...make('x', 'agenda', '2026-09-14', 'Verse'), sortHint: 7 },
        { ...make('y', 'agenda', '2026-09-14', 'Agpeya'), sortHint: 0 },
        make('z', 'lesson', '2026-09-14', 'The Good Samaritan'),
        make('w', 'backup', '2026-09-14', 'Backup servant'),
        make('v', 'lead', '2026-09-14', 'Lead servant'),
      ],
      '2026-09-14',
    )
    expect(grouped.upcoming[0]!.items.map((i) => i.id)).toEqual(['v', 'w', 'z', 'y', 'x'])
  })

  it('parks undated lessons separately', () => {
    const grouped = groupAssignmentsByWeek(
      [make('a', 'lesson', null, 'Someday'), make('b', 'agenda', '2026-09-14')],
      '2026-09-16',
    )
    expect(grouped.undated.map((i) => i.id)).toEqual(['a'])
    expect(grouped.upcoming).toHaveLength(1)
  })

  it('treats an unparseable week as undated rather than crashing', () => {
    const grouped = groupAssignmentsByWeek([make('a', 'agenda', 'garbage')], '2026-09-16')
    expect(grouped.undated).toHaveLength(1)
    expect(grouped.upcoming).toHaveLength(0)
  })

  it('handles an empty list', () => {
    expect(groupAssignmentsByWeek([], '2026-09-16')).toEqual({ upcoming: [], past: [], undated: [] })
  })
})

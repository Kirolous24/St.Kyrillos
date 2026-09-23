import { describe, it, expect } from 'vitest'
import { groupReadingsByService, READING_SERVICES } from '@/lib/portal/readings'

// Every display label lib/coptic-api.ts can produce. Kept as a literal list on
// purpose: if someone adds a label there and not here, the "covers every label"
// test below is the thing that should be updated, deliberately, rather than a
// reading quietly vanishing from the page.
const ALL_LABELS = [
  'Prophecies',
  'Vespers Psalm',
  'Vespers Gospel',
  'Matins Psalm',
  'Matins Gospel',
  'Pauline Epistle',
  'Catholic Epistle',
  'Acts',
  'Liturgy Psalm',
  'Liturgy Gospel',
  'Evening Psalm',
  'Evening Gospel',
]

const rows = (labels: string[]) => labels.map((section) => ({ section }))

describe('groupReadingsByService', () => {
  it('loses nothing: every reading comes out in exactly one group', () => {
    const grouped = groupReadingsByService(rows(ALL_LABELS))
    const out = grouped.flatMap((g) => g.sections.map((s) => s.section))
    expect(out.slice().sort()).toEqual(ALL_LABELS.slice().sort())
    expect(out.length).toBe(new Set(out).size)
  })

  it('files each reading under the service it is actually read at', () => {
    const grouped = groupReadingsByService(rows(ALL_LABELS))
    const byLabel = new Map(grouped.map((g) => [g.service.label, g.sections.map((s) => s.section)]))
    expect(byLabel.get('Vespers')).toEqual(['Vespers Psalm', 'Vespers Gospel'])
    expect(byLabel.get('Matins')).toEqual(['Matins Psalm', 'Matins Gospel'])
    // The Pauline, the Catholic and Acts are read in the Liturgy.
    expect(byLabel.get('Liturgy')).toEqual([
      'Pauline Epistle',
      'Catholic Epistle',
      'Acts',
      'Liturgy Psalm',
      'Liturgy Gospel',
    ])
    expect(byLabel.get('Evening Prayer')).toEqual(['Evening Psalm', 'Evening Gospel'])
    expect(byLabel.get('Other readings')).toEqual(['Prophecies'])
  })

  it('keeps the services in the order the church prays them', () => {
    const grouped = groupReadingsByService(rows(ALL_LABELS))
    expect(grouped.map((g) => g.service.label)).toEqual([
      'Vespers',
      'Matins',
      'Liturgy',
      'Evening Prayer',
      'Other readings',
    ])
  })

  it('draws no heading for a service with no readings today', () => {
    const grouped = groupReadingsByService(rows(['Liturgy Gospel']))
    expect(grouped.map((g) => g.service.label)).toEqual(['Liturgy'])
  })

  it('gives a label nobody anticipated a home rather than dropping it', () => {
    const grouped = groupReadingsByService(rows(['Something The Feed Invented']))
    expect(grouped).toHaveLength(1)
    expect(grouped[0]!.service.label).toBe('Other readings')
    expect(grouped[0]!.sections[0]!.section).toBe('Something The Feed Invented')
  })

  it('matches case-insensitively, since these labels render uppercase', () => {
    const grouped = groupReadingsByService(rows(['VESPERS GOSPEL', 'matins psalm']))
    expect(grouped.map((g) => g.service.label)).toEqual(['Vespers', 'Matins'])
  })

  it('every service carries a glyph and a colour for its heading', () => {
    for (const s of READING_SERVICES) {
      expect(s.glyph.length).toBeGreaterThan(0)
      expect(s.colour).toMatch(/^#[0-9A-Fa-f]{6}$/)
    }
  })
})

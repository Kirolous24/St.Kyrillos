import { describe, it, expect } from 'vitest'
import { buildReportCard, POINT_SOURCE_LABEL, RANK_MEDAL } from '@/lib/portal/reports'

// F0185 — the card said "184 points" and stopped, which cannot answer the
// question a parent asks at the door: is that because he turns up, or because he
// works? The breakdown is printed on a sheet that goes home, so the labels are
// the family's words and not the database's.
const base = {
  studentId: 's1',
  name: 'Mina Adel',
  className: 'Grade 3',
  attendance: { occasions: 10, students: 1, held: 10, attended: 8, excused: 0, absent: 2, rate: 80 },
  quizPercentages: [90, 80],
  pointsTotal: 184,
  badges: [],
}

describe('report card points breakdown', () => {
  it('orders the sources largest first, so the biggest reason reads first', () => {
    const card = buildReportCard({
      ...base,
      pointsBySource: [
        { source: 'MANUAL', points: 40 },
        { source: 'ATTENDANCE', points: 120 },
        { source: 'QUIZ', points: 24 },
      ],
    })
    expect(card.pointsBySource.map((r) => r.source)).toEqual(['ATTENDANCE', 'MANUAL', 'QUIZ'])
  })

  it('labels each source in the words a family reads, not the enum', () => {
    const card = buildReportCard({ ...base, pointsBySource: [{ source: 'ATTENDANCE', points: 120 }] })
    expect(card.pointsBySource[0]!.label).toBe('Attending')
    expect(POINT_SOURCE_LABEL.MANUAL).toBe('Given by a servant')
    // Every enum value the schema can produce has a label; an unlabelled one
    // would print "QR" on a sheet going home.
    for (const s of ['ATTENDANCE', 'MANUAL', 'QUIZ', 'UNDO', 'QR']) {
      expect(POINT_SOURCE_LABEL[s]).toBeTruthy()
    }
  })

  it('drops a source that nets to zero rather than printing "0"', () => {
    const card = buildReportCard({
      ...base,
      pointsBySource: [
        { source: 'ATTENDANCE', points: 120 },
        { source: 'UNDO', points: 0 },
      ],
    })
    expect(card.pointsBySource.map((r) => r.source)).toEqual(['ATTENDANCE'])
  })

  it('keeps a negative correction, because that is the row that needs explaining', () => {
    const card = buildReportCard({
      ...base,
      pointsBySource: [
        { source: 'ATTENDANCE', points: 120 },
        { source: 'UNDO', points: -10 },
      ],
    })
    expect(card.pointsBySource.map((r) => [r.source, r.points])).toEqual([
      ['ATTENDANCE', 120],
      ['UNDO', -10],
    ])
  })

  it('falls back to the raw source name rather than printing nothing', () => {
    const card = buildReportCard({ ...base, pointsBySource: [{ source: 'FUTURE_KIND', points: 5 }] })
    expect(card.pointsBySource[0]!.label).toBe('FUTURE_KIND')
  })

  it('is empty when no breakdown was loaded, so the block simply does not render', () => {
    expect(buildReportCard(base).pointsBySource).toEqual([])
  })

  it('gives the top three a medal and nobody else', () => {
    expect(RANK_MEDAL[1]).toBe('\u{1F947}')
    expect(RANK_MEDAL[2]).toBe('\u{1F948}')
    expect(RANK_MEDAL[3]).toBe('\u{1F949}')
    expect(RANK_MEDAL[4]).toBeUndefined()
  })
})

import { describe, it, expect } from 'vitest'
import { dashboardExams, EXAM_FRESH_HOURS } from '@/lib/portal/exams'

// F0094 — the dashboard filtered on `dueDate >= today`, which excluded the
// commonest case there is: a servant types up last Sunday's quiz on the Tuesday
// after and dates it to the Sunday. That exam is born past due and never
// appeared on the one surface meant to say "this exists now".
const NOW = new Date('2026-09-23T15:00:00Z')
const TODAY = '2026-09-23'
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 60 * 60 * 1000)

const exam = (over: Partial<{ id: string; status: string; dueDate: string | null; createdAt: Date }>) => ({
  id: 'x',
  status: 'PUBLISHED',
  dueDate: null as string | null,
  createdAt: hoursAgo(1),
  ...over,
})

describe('dashboardExams', () => {
  it('shows a just-written exam even though it was born past due', () => {
    const written = exam({ id: 'sunday-quiz', dueDate: '2026-09-20', createdAt: hoursAgo(2) })
    const { shown } = dashboardExams([written], TODAY, NOW)
    expect(shown.map((r) => r.id)).toEqual(['sunday-quiz'])
  })

  it('but keeps it out of the still-open count, which drives the headline number', () => {
    const written = exam({ id: 'sunday-quiz', dueDate: '2026-09-20', createdAt: hoursAgo(2) })
    const live = exam({ id: 'live', dueDate: '2026-09-27' })
    const { stillOpen, shown } = dashboardExams([written, live], TODAY, NOW)
    expect(stillOpen.map((r) => r.id)).toEqual(['live'])
    expect(shown.map((r) => r.id)).toEqual(['live', 'sunday-quiz'])
  })

  it('drops a past-due exam once it is no longer new', () => {
    const stale = exam({ id: 'stale', dueDate: '2026-09-01', createdAt: hoursAgo(EXAM_FRESH_HOURS + 1) })
    expect(dashboardExams([stale], TODAY, NOW).shown).toEqual([])
  })

  it('keeps one written exactly on the threshold', () => {
    const edge = exam({ id: 'edge', dueDate: '2026-09-01', createdAt: hoursAgo(EXAM_FRESH_HOURS) })
    expect(dashboardExams([edge], TODAY, NOW).shown.map((r) => r.id)).toEqual(['edge'])
  })

  it('orders open exams by due date, soonest first, with undated ones last', () => {
    const rows = [
      exam({ id: 'later', dueDate: '2026-10-05' }),
      exam({ id: 'undated', dueDate: null }),
      exam({ id: 'soon', dueDate: '2026-09-24' }),
    ]
    expect(dashboardExams(rows, TODAY, NOW).stillOpen.map((r) => r.id)).toEqual(['soon', 'later', 'undated'])
  })

  it('puts the newest just-added exam first among the past-due ones', () => {
    const rows = [
      exam({ id: 'older', dueDate: '2026-09-10', createdAt: hoursAgo(20) }),
      exam({ id: 'newer', dueDate: '2026-09-11', createdAt: hoursAgo(3) }),
    ]
    expect(dashboardExams(rows, TODAY, NOW).shown.map((r) => r.id)).toEqual(['newer', 'older'])
  })

  it('ignores drafts and closed exams however new they are', () => {
    const rows = [
      exam({ id: 'draft', status: 'DRAFT', dueDate: '2026-09-30' }),
      exam({ id: 'closed', status: 'CLOSED', createdAt: hoursAgo(1) }),
    ]
    const { shown, stillOpen } = dashboardExams(rows, TODAY, NOW)
    expect(shown).toEqual([])
    expect(stillOpen).toEqual([])
  })

  it('treats an exam due today as still open, not as past due', () => {
    const rows = [exam({ id: 'today', dueDate: TODAY })]
    expect(dashboardExams(rows, TODAY, NOW).stillOpen.map((r) => r.id)).toEqual(['today'])
  })
})

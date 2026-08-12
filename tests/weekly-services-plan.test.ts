import { describe, it, expect } from 'vitest'
import {
  to12h,
  eventKey,
  planWeeklyMaterialization,
  type WeeklyServiceInput,
  type ExistingEventInput,
} from '@/lib/weekly-services-plan'

const NOW = new Date('2026-01-04T09:00:00.000Z') // Sunday anchor

function svc(partial: Partial<WeeklyServiceInput> & { dayOfWeek: number; title: string; time: string; sortOrder: number }): WeeklyServiceInput {
  return {
    id: partial.id ?? `${partial.title}-${partial.dayOfWeek}`,
    durationMinutes: partial.durationMinutes ?? 60,
    location: partial.location ?? 'Main Church',
    description: partial.description ?? null,
    enabled: partial.enabled ?? true,
    ...partial,
  }
}

describe('to12h', () => {
  it('formats 24-hr times to the app display format', () => {
    expect(to12h('08:00')).toBe('8:00 AM')
    expect(to12h('00:00')).toBe('12:00 AM')
    expect(to12h('12:00')).toBe('12:00 PM')
    expect(to12h('13:30')).toBe('1:30 PM')
    expect(to12h('23:45')).toBe('11:45 PM')
  })
})

describe('eventKey', () => {
  it('is stable across ISO vs date-only and title casing/whitespace', () => {
    expect(eventKey('2026-01-09T12:00:00.000Z', 480, 'Divine Liturgy')).toBe(
      eventKey('2026-01-09', 480, '  divine liturgy '),
    )
  })
})

describe('planWeeklyMaterialization — auto-populate (reported bug #1)', () => {
  it('emits every enabled service for ALL 4 weeks without manual week selection', () => {
    const services = [
      svc({ dayOfWeek: 5, title: 'Bible Study', time: '18:00', sortOrder: 18 * 60 }), // Fri
      svc({ dayOfWeek: 0, title: 'Divine Liturgy', time: '08:00', sortOrder: 8 * 60 }), // Sun
    ]
    const plan = planWeeklyMaterialization(services, [], NOW)
    expect(plan).toHaveLength(8) // 2 services × 4 weeks

    const fridays = plan.filter((p) => p.title === 'Bible Study').map((p) => p.date).sort()
    expect(fridays).toEqual(['2026-01-09', '2026-01-16', '2026-01-23', '2026-01-30'])

    const sundays = plan.filter((p) => p.title === 'Divine Liturgy').map((p) => p.date).sort()
    expect(sundays).toEqual(['2026-01-04', '2026-01-11', '2026-01-18', '2026-01-25'])

    // Display fields are materialized correctly.
    const fri = plan.find((p) => p.title === 'Bible Study')!
    expect(fri.time).toBe('6:00 PM')
    expect(fri.sortOrder).toBe(1080)
    expect(fri.location).toBe('Main Church')
  })

  it('excludes disabled services', () => {
    const services = [
      svc({ dayOfWeek: 5, title: 'Bible Study', time: '18:00', sortOrder: 1080, enabled: false }),
      svc({ dayOfWeek: 0, title: 'Liturgy', time: '08:00', sortOrder: 480, enabled: true }),
    ]
    const plan = planWeeklyMaterialization(services, [], NOW)
    expect(plan.every((p) => p.title === 'Liturgy')).toBe(true)
    expect(plan).toHaveLength(4)
  })
})

describe('planWeeklyMaterialization — idempotency (reported bug #2: duplicates)', () => {
  const services = [
    svc({ dayOfWeek: 5, title: 'Bible Study', time: '18:00', sortOrder: 1080 }),
    svc({ dayOfWeek: 0, title: 'Divine Liturgy', time: '08:00', sortOrder: 480 }),
  ]

  it('a second run after applying the first produces ZERO new events', () => {
    const first = planWeeklyMaterialization(services, [], NOW)
    // Simulate the first plan having been written to the DB.
    const existing: ExistingEventInput[] = first.map((p) => ({
      date: p.date,
      sortOrder: p.sortOrder,
      title: p.title,
    }))
    const second = planWeeklyMaterialization(services, existing, NOW)
    expect(second).toHaveLength(0)
  })

  it('skips instances that already exist from ANY path (manual/fill/template)', () => {
    // Admin already added the week-0 Sunday liturgy by hand.
    const existing: ExistingEventInput[] = [
      { date: '2026-01-04', sortOrder: 480, title: 'Divine Liturgy' },
    ]
    const plan = planWeeklyMaterialization(services, existing, NOW)
    expect(plan.find((p) => p.date === '2026-01-04' && p.title === 'Divine Liturgy')).toBeUndefined()
    // …but the other 3 Sundays + all 4 Fridays are still planned.
    expect(plan).toHaveLength(7)
  })

  it('never emits two of the same instance within a single run', () => {
    // Two service rows that resolve to the same day+time+title (a data glitch).
    const dupes = [
      svc({ id: 'a', dayOfWeek: 0, title: 'Liturgy', time: '08:00', sortOrder: 480 }),
      svc({ id: 'b', dayOfWeek: 0, title: 'Liturgy', time: '08:00', sortOrder: 480 }),
    ]
    const plan = planWeeklyMaterialization(dupes, [], NOW)
    expect(plan).toHaveLength(4) // 4 weeks, not 8
  })
})

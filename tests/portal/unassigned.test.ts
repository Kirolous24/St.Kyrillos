import { describe, it, expect } from 'vitest'
import type { PortalUser } from '@/lib/portal/permissions'
import {
  CLEAR_UNASSIGNED,
  UNASSIGN_REASON_MAX,
  cleanUnassignReason,
  manageableFromClassIds,
  mayHandleUnassigned,
} from '@/lib/portal/unassigned'
import { withUnassignedFlag } from '@/lib/portal/nav'

const classes = [
  { id: 'kg', stage: 'ELEMENTARY' as const },
  { id: '1st', stage: 'ELEMENTARY' as const },
  { id: '7th-8th-boys', stage: 'MIDDLE_SCHOOL' as const },
]
const base = { displayName: 'X', classIds: [] as string[], coordinatorOf: [] as string[], stageOversight: null }
const admin: PortalUser = { ...base, accountId: 'a', role: 'ADMIN' }
const pastor: PortalUser = { ...base, accountId: 'p', role: 'PASTOR' }
const servant: PortalUser = { ...base, accountId: 's', role: 'SERVANT', servantId: 'sv', classIds: ['kg'] }
const coordinator: PortalUser = { ...servant, accountId: 'c', coordinatorOf: ['kg'] }
const overseer: PortalUser = { ...servant, accountId: 'o', classIds: ['7th-8th-boys'], stageOversight: 'MIDDLE_SCHOOL' }

describe('the reason for unassigning a child', () => {
  it('is required', () => {
    expect(cleanUnassignReason('')).toEqual({ ok: false, error: expect.stringMatching(/reason/i) })
    expect(cleanUnassignReason('   ')).toMatchObject({ ok: false })
    expect(cleanUnassignReason(undefined)).toMatchObject({ ok: false })
    expect(cleanUnassignReason('ok')).toMatchObject({ ok: false })
  })
  it('is trimmed and kept as written', () => {
    expect(cleanUnassignReason('  Moved to Texas  ')).toEqual({ ok: true, reason: 'Moved to Texas' })
  })
  it('has an upper bound', () => {
    expect(cleanUnassignReason('x'.repeat(UNASSIGN_REASON_MAX))).toMatchObject({ ok: true })
    expect(cleanUnassignReason('x'.repeat(UNASSIGN_REASON_MAX + 1))).toMatchObject({ ok: false })
  })
})

describe('whose unassigned children a user handles', () => {
  it('the admin handles every class', () => {
    expect(manageableFromClassIds(admin, classes)).toEqual(['kg', '1st', '7th-8th-boys'])
  })
  it('a Coordinator handles their class, an overseer their stage', () => {
    expect(manageableFromClassIds(coordinator, classes)).toEqual(['kg'])
    expect(manageableFromClassIds(overseer, classes)).toEqual(['7th-8th-boys'])
  })
  it('a plain servant and the pastor handle none', () => {
    expect(manageableFromClassIds(servant, classes)).toEqual([])
    expect(manageableFromClassIds(pastor, classes)).toEqual([])
  })
  it('can tell without a query who never handles the list', () => {
    expect(mayHandleUnassigned(admin)).toBe(true)
    expect(mayHandleUnassigned(coordinator)).toBe(true)
    expect(mayHandleUnassigned(overseer)).toBe(true)
    expect(mayHandleUnassigned(servant)).toBe(false)
    expect(mayHandleUnassigned(pastor)).toBe(false)
  })
  it('placing a child clears every unassigned field', () => {
    expect(CLEAR_UNASSIGNED).toEqual({ unassignedAt: null, unassignedById: null, unassignedReason: null, unassignedFromClassId: null })
  })
})

describe('the UNASSIGNED flag on the sidebar', () => {
  const servantNav = [
    { href: '/portal', label: 'Dashboard', section: 'Overview' },
    { href: '/portal/classes', label: 'My Classes', section: 'Overview' },
  ]
  const adminNav = [
    { href: '/portal', label: 'Dashboard' },
    { href: '/portal/classes', label: 'Classes', section: 'People' },
  ]
  it('is absent while nobody is waiting', () => {
    expect(withUnassignedFlag(servantNav, 0)).toEqual(servantNav)
  })
  it('sits right under Dashboard, in red capitals, with the count', () => {
    const nav = withUnassignedFlag(servantNav, 3)
    expect(nav[1]).toEqual({ href: '/portal/unassigned', label: 'UNASSIGNED', icon: 'unassigned', section: 'Overview', badge: 3, tone: 'alert' })
    expect(nav).toHaveLength(3)
  })
  it("joins the group that follows Dashboard when Dashboard has none, so the admin's People group stays whole", () => {
    expect(withUnassignedFlag(adminNav, 1)[1]!.section).toBe('People')
  })
})

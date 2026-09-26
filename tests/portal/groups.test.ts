import { describe, it, expect } from 'vitest'
import {
  effectiveServant, families, planSplit, groupHealth, followUpScope, UNEVEN_GAP,
  type GroupKid, type GroupServant,
} from '@/lib/portal/groups'

const kid = (id: string, over: Partial<GroupKid> = {}): GroupKid => ({
  id, name: id, groupServantId: null, groupAssignedAt: null, phones: [], ...over,
})
const servants: GroupServant[] = [
  { id: 'A', name: 'Abanoub' }, { id: 'B', name: 'Bishoy' }, { id: 'C', name: 'Christina' }, { id: 'D', name: 'Demiana' },
]
const apply = (kids: GroupKid[], moves: ReturnType<typeof planSplit>) => {
  const to = new Map(moves.map((m) => [m.kidId, m.to]))
  return kids.map((k) => (to.has(k.id) ? { ...k, groupServantId: to.get(k.id)!, groupAssignedAt: '2026-10-01T00:00:00.000Z' } : k))
}
const sizes = (kids: GroupKid[], ss: GroupServant[]) =>
  ss.map((s) => kids.filter((k) => k.groupServantId === s.id).length)

describe('effectiveServant', () => {
  it('keeps a servant who still serves the class, and forgets one who left', () => {
    expect(effectiveServant('A', new Set(['A', 'B']))).toBe('A')
    expect(effectiveServant('Z', new Set(['A', 'B']))).toBeNull()
    expect(effectiveServant(null, new Set(['A']))).toBeNull()
  })
})

describe('families', () => {
  it('joins kids who share a parent phone, and ignores a number on too many kids', () => {
    const kids = [
      kid('k1', { phones: ['6155550101'] }), kid('k2', { phones: ['6155550101', '6155550199'] }),
      kid('k3', { phones: ['6155550199'] }), kid('k4'),
      ...['p1', 'p2', 'p3', 'p4', 'p5'].map((id) => kid(id, { phones: ['6150000000'] })),
    ]
    const f = families(kids).map((x) => x.sort().join(',')).sort()
    expect(f).toContain('k1,k2,k3')
    expect(f).toContain('k4')
    expect(f).toContain('p1')
    expect(f).not.toContain('p1,p2,p3,p4,p5')
  })
})

describe('the first split', () => {
  const sixteen = Array.from({ length: 16 }, (_, i) => kid(`k${String(i).padStart(2, '0')}`))

  it('splits evenly: 16 kids, 4 servants, 4 each', () => {
    expect(sizes(apply(sixteen, planSplit(sixteen, servants)), servants)).toEqual([4, 4, 4, 4])
  })

  it('gives the remainder one each: 18 kids across 4 servants', () => {
    const s = sizes(apply(sixteen.concat([kid('k16'), kid('k17')]), planSplit(sixteen.concat([kid('k16'), kid('k17')]), servants)), servants)
    expect(Math.max(...s) - Math.min(...s)).toBe(1)
    expect(s.reduce((a, b) => a + b, 0)).toBe(18)
  })

  it('keeps siblings together', () => {
    const kids = [kid('s1', { phones: ['6155550111'] }), kid('s2', { phones: ['6155550111'] }), ...sixteen.slice(0, 6)]
    const after = apply(kids, planSplit(kids, servants))
    expect(after.find((k) => k.id === 's1')!.groupServantId).toBe(after.find((k) => k.id === 's2')!.groupServantId)
  })

  it('is the same every time', () => {
    expect(planSplit(sixteen, servants)).toEqual(planSplit(sixteen, servants))
  })

  it('never leaves a flag behind, even with three siblings in a small class', () => {
    const kids = [kid('t1', { phones: ['6155550222'] }), kid('t2', { phones: ['6155550222'] }), kid('t3', { phones: ['6155550222'] }), kid('x1')]
    const two = servants.slice(0, 2)
    expect(groupHealth(apply(kids, planSplit(kids, two)), two).flagged).toBe(false)
  })
})

describe('after the split', () => {
  const settled = (): GroupKid[] =>
    Array.from({ length: 16 }, (_, i) => kid(`k${String(i).padStart(2, '0')}`, {
      groupServantId: servants[i % 4]!.id, groupAssignedAt: `2026-09-${String(10 + (i % 9)).padStart(2, '0')}T00:00:00.000Z`,
    }))

  it('moves nobody when the groups are already even', () => {
    expect(planSplit(settled(), servants)).toEqual([])
  })

  it('places a new kid in the smallest group and moves nobody else', () => {
    const kids = settled().filter((k) => k.id !== 'k00').concat([kid('new')])
    const moves = planSplit(kids, servants, { only: ['new'], balance: false })
    expect(moves).toEqual([{ kidId: 'new', from: null, to: 'A' }])
  })

  it("places a new kid with a sibling's servant", () => {
    const kids = settled().map((k) => (k.id === 'k05' ? { ...k, phones: ['6155550333'] } : k)).concat([kid('sib', { phones: ['6155550333'] })])
    expect(planSplit(kids, servants, { only: ['sib'], balance: false })).toEqual([{ kidId: 'sib', from: null, to: 'B' }])
  })

  it('a new servant gets kids from Split evenly with the fewest moves, newest first', () => {
    const five = [...servants, { id: 'E', name: 'Ehab' }]
    const moves = planSplit(settled(), five)
    expect(moves.every((m) => m.to === 'E')).toBe(true)
    expect(moves).toHaveLength(3)
    expect(sizes(apply(settled(), moves), five).sort()).toEqual([3, 3, 3, 3, 4])
  })

  it("places the kids of a servant who left, and moves nobody else's", () => {
    const three = servants.slice(0, 3)
    const moves = planSplit(settled(), three)
    expect(moves.every((m) => m.from === null)).toBe(true)
    expect(moves).toHaveLength(4)
  })
})

describe('groupHealth', () => {
  const even = () => Array.from({ length: 16 }, (_, i) => kid(`k${i}`, { groupServantId: servants[i % 4]!.id }))

  it('is quiet for an even class', () => {
    expect(groupHealth(even(), servants).flagged).toBe(false)
  })

  it('never calls the class uneven because one kid left', () => {
    expect(groupHealth(even().slice(1), servants).uneven).toBe(false)
  })

  it(`calls it uneven at a gap of ${UNEVEN_GAP}`, () => {
    const kids = even().filter((k) => !['k0', 'k4', 'k8'].includes(k.id))
    expect(groupHealth(kids, servants).uneven).toBe(true)
  })

  it('names a servant with no kids, and counts kids with no servant', () => {
    const h = groupHealth(even(), [...servants, { id: 'E', name: 'Ehab' }])
    expect(h.emptyServants).toEqual(['Ehab'])
    const h2 = groupHealth(even(), servants.slice(0, 3))
    expect(h2.unassigned).toBe(4)
  })

  it('does not flag a class with more servants than kids', () => {
    const kids = [kid('a', { groupServantId: 'A' }), kid('b', { groupServantId: 'B' })]
    expect(groupHealth(kids, servants).flagged).toBe(false)
  })
})

describe('followUpScope', () => {
  const classes = [
    { id: 'kg', stage: 'ELEMENTARY' as const }, { id: '1st', stage: 'ELEMENTARY' as const }, { id: '7th', stage: 'MIDDLE_SCHOOL' as const },
  ]
  const base = { role: 'SERVANT' as const, classIds: ['kg'], coordinatorOf: [] as string[], stageOversight: null }

  it('a plain servant gets their own class by group', () => {
    expect(followUpScope(base, classes)).toEqual({ whole: [], group: ['kg'] })
  })
  it('a class coordinator sees their class whole', () => {
    expect(followUpScope({ ...base, coordinatorOf: ['kg'] }, classes)).toEqual({ whole: ['kg'], group: [] })
  })
  it('a stage overseer sees their stage whole, and still has their own group elsewhere', () => {
    expect(followUpScope({ ...base, classIds: ['7th'], stageOversight: 'ELEMENTARY' }, classes)).toEqual({ whole: ['kg', '1st'], group: ['7th'] })
  })
  it('admin and pastor see everything whole', () => {
    expect(followUpScope({ ...base, role: 'ADMIN' }, classes).whole).toEqual(['kg', '1st', '7th'])
    expect(followUpScope({ ...base, role: 'PASTOR' }, classes).whole).toEqual(['kg', '1st', '7th'])
  })
})

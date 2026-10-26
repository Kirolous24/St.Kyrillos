import { describe, it, expect } from 'vitest'
import {
  effectiveServant, families, planSplit, planShuffle, nextShuffleOn, shuffleNotice, groupHealth, followUpScope, UNEVEN_GAP,
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
  const base = { role: 'SERVANT' as const, classIds: ['kg'], coordinatorOf: [] as string[], assistantOf: [] as string[], stageOversight: null }

  it('a plain servant gets their own class by group', () => {
    expect(followUpScope(base, classes)).toEqual({ whole: [], group: ['kg'] })
  })
  it('a class coordinator sees their class whole', () => {
    expect(followUpScope({ ...base, coordinatorOf: ['kg'] }, classes)).toEqual({ whole: ['kg'], group: [] })
  })
  it('an assistant coordinator sees their class whole too', () => {
    expect(followUpScope({ ...base, assistantOf: ['kg'] }, classes)).toEqual({ whole: ['kg'], group: [] })
  })
  it('a title widens only the class it is held in', () => {
    expect(followUpScope({ ...base, classIds: ['kg', '1st'], assistantOf: ['kg'] }, classes)).toEqual({ whole: ['kg'], group: ['1st'] })
    expect(followUpScope({ ...base, classIds: ['kg', '1st'], coordinatorOf: ['1st'] }, classes)).toEqual({ whole: ['1st'], group: ['kg'] })
  })
  it('a stage overseer sees their stage whole, and still has their own group elsewhere', () => {
    expect(followUpScope({ ...base, classIds: ['7th'], stageOversight: 'ELEMENTARY' }, classes)).toEqual({ whole: ['kg', '1st'], group: ['7th'] })
  })
  it('admin and pastor see everything whole', () => {
    expect(followUpScope({ ...base, role: 'ADMIN' }, classes).whole).toEqual(['kg', '1st', '7th'])
    expect(followUpScope({ ...base, role: 'PASTOR' }, classes).whole).toEqual(['kg', '1st', '7th'])
  })
})

/** A small seeded generator (mulberry32), so a shuffle in a test is the same every run. */
function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Shuffled every two months (2026-10-25): each child gets a new servant to
// follow them up, the groups stay even and brothers and sisters stay together.
describe('planShuffle', () => {
  const placed = (n: number, ss: GroupServant[] = servants) =>
    Array.from({ length: n }, (_, i) => kid(`k${String(i).padStart(2, '0')}`, { groupServantId: ss[i % ss.length]!.id }))

  it('gives every child a new servant when the numbers allow, and keeps the groups even', () => {
    for (const seed of [1, 2, 3, 42, 99, 2026]) {
      const kids = placed(16)
      const moves = planShuffle(kids, servants, seeded(seed))
      expect(moves).toHaveLength(16)
      for (const m of moves) expect(m.to).not.toBe(m.from)
      const s = sizes(apply(kids, moves), servants)
      expect(Math.max(...s) - Math.min(...s)).toBeLessThanOrEqual(1)
    }
  })

  it('an uneven class still comes out within one: 18 children across 4 servants', () => {
    for (const seed of [4, 5, 6]) {
      const kids = placed(18)
      const s = sizes(apply(kids, planShuffle(kids, servants, seeded(seed))), servants)
      expect(Math.max(...s) - Math.min(...s)).toBeLessThanOrEqual(1)
      expect(s.reduce((a, b) => a + b, 0)).toBe(18)
    }
  })

  it('keeps brothers and sisters together, and raises no flag', () => {
    const kids = [
      kid('s1', { phones: ['6155550111'], groupServantId: 'A' }),
      kid('s2', { phones: ['6155550111'], groupServantId: 'A' }),
      kid('t1', { phones: ['6155550122'], groupServantId: 'B' }),
      kid('t2', { phones: ['6155550122'], groupServantId: 'B' }),
      kid('t3', { phones: ['6155550122'], groupServantId: 'B' }),
      ...placed(11),
    ]
    for (const seed of [1, 2, 3, 4, 5]) {
      const after = apply(kids, planShuffle(kids, servants, seeded(seed)))
      const servantOf = (id: string) => after.find((k) => k.id === id)!.groupServantId
      expect(servantOf('s1')).toBe(servantOf('s2'))
      expect(new Set([servantOf('t1'), servantOf('t2'), servantOf('t3')]).size).toBe(1)
      expect(groupHealth(after, servants).flagged).toBe(false)
    }
  })

  it('is the same shuffle for the same seed, and another for another seed', () => {
    const kids = placed(16)
    expect(planShuffle(kids, servants, seeded(7))).toEqual(planShuffle(kids, servants, seeded(7)))
    expect(planShuffle(kids, servants, seeded(7))).not.toEqual(planShuffle(kids, servants, seeded(8)))
  })

  it('with one servant nobody moves', () => {
    const one = [servants[0]!]
    expect(planShuffle(placed(5, one), one, seeded(1))).toEqual([])
  })

  it('a servant new to the class is given children; only those who must stay with their old servant', () => {
    const two = servants.slice(0, 2)
    const kids = Array.from({ length: 6 }, (_, i) => kid(`k${i}`, { groupServantId: 'A' }))
    const moves = planShuffle(kids, two, seeded(5))
    expect(sizes(apply(kids, moves), two)).toEqual([3, 3])
    expect(moves).toHaveLength(3)
  })

  it('a child with no servant yet is placed too', () => {
    const kids = [...placed(8), kid('new')]
    const after = apply(kids, planShuffle(kids, servants, seeded(3)))
    expect(after.find((k) => k.id === 'new')!.groupServantId).not.toBeNull()
  })
})

describe('nextShuffleOn', () => {
  it('is two months on', () => {
    expect(nextShuffleOn('2026-10-25')).toBe('2026-12-25')
  })

  it('keeps to the end of a shorter month', () => {
    expect(nextShuffleOn('2026-12-31')).toBe('2027-02-28')
    expect(nextShuffleOn('2027-12-31')).toBe('2028-02-29')
  })

  it('takes another number of months', () => {
    expect(nextShuffleOn('2026-10-25', 1)).toBe('2026-11-25')
  })
})

describe('shuffleNotice', () => {
  it("tells a servant their new group, by the children's names", () => {
    expect(shuffleNotice('5th & 6th Boys', ['Mina Saad', 'Mark Adly'])).toEqual({
      title: 'Your follow-up group changed',
      body: '5th & 6th Boys: you now follow up with 2 children: Mina Saad and Mark Adly.',
      href: '/portal/my-group',
    })
  })

  it('names the first six and counts the rest', () => {
    const names = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8']
    expect(shuffleNotice('KG', names).body).toBe('KG: you now follow up with 8 children: A1, A2, A3, A4, A5, A6 and 2 more.')
  })

  it('one child is "a child"', () => {
    expect(shuffleNotice('KG', ['Mina Saad']).body).toBe('KG: you now follow up with 1 child: Mina Saad.')
  })
})

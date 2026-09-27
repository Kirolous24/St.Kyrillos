import { describe, it, expect } from 'vitest'
import { linkedWith, linkedReadable } from '@/lib/portal/lesson-links'

// girls follows boys; kg follows pre-k; 3rd follows nothing.
const rows = [
  { id: 'boys', curriculumLinkedToId: null },
  { id: 'girls', curriculumLinkedToId: 'boys' },
  { id: 'pre-k', curriculumLinkedToId: null },
  { id: 'kg', curriculumLinkedToId: 'pre-k' },
  { id: '1st', curriculumLinkedToId: 'pre-k' },
  { id: '3rd', curriculumLinkedToId: null },
]

describe('which classes a link joins', () => {
  it('joins a follower to the class it follows', () => {
    expect(linkedWith('girls', rows)).toEqual(['boys'])
  })

  it('joins the followed class back to every follower: "give access to each other"', () => {
    expect(linkedWith('boys', rows)).toEqual(['girls'])
    expect(linkedWith('pre-k', rows).sort()).toEqual(['1st', 'kg'])
  })

  it('is one hop: two followers of the same class are not linked to each other', () => {
    expect(linkedWith('kg', rows)).toEqual(['pre-k'])
  })

  it('an unlinked class has no links, and a self-link counts for nothing', () => {
    expect(linkedWith('3rd', rows)).toEqual([])
    expect(linkedWith('x', [{ id: 'x', curriculumLinkedToId: 'x' }])).toEqual([])
  })
})

describe('the lesson prep a servant may read through a link', () => {
  it("a servant of the girls' class may read the boys' plan, and only that", () => {
    expect(linkedReadable(['girls'], rows)).toEqual(['boys'])
  })

  it('never lists a class the servant already has', () => {
    expect(linkedReadable(['girls', 'boys'], rows)).toEqual([])
  })

  it('collects links across all of a servant’s classes, once each', () => {
    expect(linkedReadable(['kg', '1st'], rows)).toEqual(['pre-k'])
    expect(linkedReadable(['girls', 'kg'], rows).sort()).toEqual(['boys', 'pre-k'])
  })
})

// The old app stored a shared curriculum as a pair pointing at each other.
describe('a pair linked both ways', () => {
  const pair = [
    { id: 'boys', curriculumLinkedToId: 'girls' },
    { id: 'girls', curriculumLinkedToId: 'boys' },
  ]
  it('is one link, listed once from either side', () => {
    expect(linkedWith('boys', pair)).toEqual(['girls'])
    expect(linkedWith('girls', pair)).toEqual(['boys'])
    expect(linkedReadable(['girls'], pair)).toEqual(['boys'])
  })
})

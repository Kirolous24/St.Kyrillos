import { describe, it, expect } from 'vitest'
import { splitName, formatFullName } from '@/lib/portal/names'

describe('splitName', () => {
  it('splits "First Last"', () => {
    expect(splitName('Merolla Mina')).toEqual({ firstName: 'Merolla', lastName: 'Mina' })
  })
  it('splits "Last, First" into first and last', () => {
    expect(splitName('Tawadrous, Maronia')).toEqual({ firstName: 'Maronia', lastName: 'Tawadrous' })
  })
  it('keeps middle names with the last name', () => {
    expect(splitName('Kirollos Sargyous Fahmy')).toEqual({ firstName: 'Kirollos', lastName: 'Sargyous Fahmy' })
  })
  it('handles a single token', () => {
    expect(splitName('Admin')).toEqual({ firstName: 'Admin', lastName: '' })
  })
  it('trims and collapses whitespace and strips stray punctuation', () => {
    expect(splitName('  John   Beblawy. ')).toEqual({ firstName: 'John', lastName: 'Beblawy' })
  })
  it('returns empty parts for empty input', () => {
    expect(splitName('')).toEqual({ firstName: '', lastName: '' })
    expect(splitName(undefined)).toEqual({ firstName: '', lastName: '' })
  })
})

describe('formatFullName', () => {
  it('joins non-empty parts', () => {
    expect(formatFullName({ firstName: 'Mia', lastName: 'Ebrahim' })).toBe('Mia Ebrahim')
    expect(formatFullName({ firstName: 'Admin', lastName: '' })).toBe('Admin')
  })
})

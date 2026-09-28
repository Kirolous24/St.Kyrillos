import { describe, it, expect } from 'vitest'
import { RESOLVE_REASONS, resolveReasonLabel, contactMethodLabel } from '@/lib/portal/followups'

describe('resolveReasonLabel', () => {
  it('uses the church’s wording, not the database value', () => {
    expect(resolveReasonLabel('attending_again')).toBe('Attending again')
    expect(resolveReasonLabel('lost_interest')).toBe('Lost interest')
    expect(resolveReasonLabel('moved')).toBe('Moved away')
  })

  it('never shows an underscore to a reader', () => {
    for (const r of RESOLVE_REASONS) {
      expect(resolveReasonLabel(r.key)).not.toContain('_')
    }
  })

  it('is null for no reason at all, so callers can omit the line', () => {
    expect(resolveReasonLabel(null)).toBeNull()
    expect(resolveReasonLabel(undefined)).toBeNull()
    expect(resolveReasonLabel('')).toBeNull()
  })

  it('title-cases an unknown value rather than hiding that the case was resolved', () => {
    // A case closed before this list existed still has to read as something.
    expect(resolveReasonLabel('went_to_college')).toBe('Went to college')
  })
})

describe('contactMethodLabel', () => {
  it('names the methods the church uses', () => {
    expect(contactMethodLabel('whatsapp')).toBe('WhatsApp')
    expect(contactMethodLabel('visit')).toBe('Visit')
  })

  it('names the closing entry resolveCase writes', () => {
    expect(contactMethodLabel('resolved')).toBe('Case resolved')
  })

  it('falls back rather than rendering nothing', () => {
    expect(contactMethodLabel(null)).toBe('Contact')
    expect(contactMethodLabel('carrier_pigeon')).toBe('Carrier_pigeon')
  })
})

describe('"Prayed at another church" (2026-09-28)', () => {
  it('is a reason a case can close with', () => {
    expect(resolveReasonLabel('other_church')).toBe('Prayed at another church')
  })

  it('every form and check reads the one list, so a new reason is never refused', async () => {
    const { readFileSync } = await import('node:fs')
    const path = await import('node:path')
    const read = (p: string) => readFileSync(path.resolve(__dirname, '../..', p), 'utf8')
    const actions = read('lib/portal/actions/followups.ts')
    expect(actions).not.toMatch(/z\.enum\(\['attending_again'/)
    expect(actions.match(/z\.enum\(RESOLVE_REASON_KEYS\)/g)).toHaveLength(2)
    expect(read('app/portal/(app)/follow-ups/NewCaseForm.tsx')).toMatch(/import \{ RESOLVE_REASONS \} from '@\/lib\/portal\/followups'/)
  })
})

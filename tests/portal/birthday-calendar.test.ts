import { describe, it, expect } from 'vitest'
import { birthdayCalendarIcs, isCalendarToken, newCalendarToken } from '@/lib/portal/birthday-calendar'

/**
 * The children's birthdays as a calendar a servant subscribes to (2026-10-19,
 * asked by a servant: "automatically put the kids bdays on my Apple calendar
 * with notifications"). Each birthday is an all-day event with a reminder at
 * 9 AM on the day, for this year and next.
 */
const NOW = new Date('2026-10-19T15:00:00Z')

function events(ics: string) {
  return ics.split('BEGIN:VEVENT').slice(1).map((e) => e.split('END:VEVENT')[0])
}
/** One property of the event itself; the reminder inside it has its own DESCRIPTION. */
const field = (event: string, name: string) =>
  event.replace(/BEGIN:VALARM[\s\S]*END:VALARM/, '').match(new RegExp(`\\r\\n${name}[:;]([^\\r]*)`))?.[1]

const mina = { id: 'st-mina', firstName: 'Mina', lastName: 'Test', dob: '2017-03-05', className: '3rd Grade' }

describe('birthdayCalendarIcs', () => {
  it('gives each child an all-day event on their birthday this year and next, saying how old they turn', () => {
    const ics = birthdayCalendarIcs({ kids: [mina], today: '2026-10-19', now: NOW })
    const got = events(ics).map((e) => [field(e, 'DTSTART'), field(e, 'DTEND'), field(e, 'SUMMARY')])
    expect(got).toEqual([
      ['VALUE=DATE:20260305', 'VALUE=DATE:20260306', '🎂 Mina T. turns 9'],
      ['VALUE=DATE:20270305', 'VALUE=DATE:20270306', '🎂 Mina T. turns 10'],
    ])
  })

  it('reminds at 9 AM on the day itself', () => {
    const [event] = events(birthdayCalendarIcs({ kids: [mina], today: '2026-10-19', now: NOW }))
    expect(event).toContain('\r\nBEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:🎂 Mina T. turns 9\r\nTRIGGER:PT9H\r\nEND:VALARM')
  })

  it('names the class in the event, and keeps birthdays from showing the servant as busy', () => {
    const [event] = events(birthdayCalendarIcs({ kids: [mina], today: '2026-10-19', now: NOW }))
    expect(field(event, 'DESCRIPTION')).toBe('3rd Grade')
    expect(field(event, 'TRANSP')).toBe('TRANSPARENT')
  })

  it('keeps the same event id for a child and year, so a refresh updates rather than duplicates', () => {
    const a = events(birthdayCalendarIcs({ kids: [mina], today: '2026-10-19', now: NOW }))
    const b = events(birthdayCalendarIcs({ kids: [mina], today: '2026-12-01', now: new Date('2026-12-01T00:00:00Z') }))
    expect(a.map((e) => field(e, 'UID'))).toEqual(['st-mina-2026@birthdays.stkyrillostn.org', 'st-mina-2027@birthdays.stkyrillostn.org'])
    expect(b.map((e) => field(e, 'UID'))).toEqual(a.map((e) => field(e, 'UID')))
  })

  it('leaves out children with no birthday on file, and years before a child was born', () => {
    const baby = { id: 'st-baby', firstName: 'Baby', lastName: 'Sample', dob: '2026-05-01', className: 'Nursery' }
    const none = { id: 'st-none', firstName: 'No', lastName: 'Date', dob: null, className: 'KG' }
    const titles = events(birthdayCalendarIcs({ kids: [baby, none], today: '2026-10-19', now: NOW })).map((e) => field(e, 'SUMMARY'))
    expect(titles).toEqual(['🎂 Baby S. turns 1'])
  })

  it('puts a 29 February birthday on 28 February in other years', () => {
    const leap = { id: 'st-leap', firstName: 'Leap', lastName: 'Day', dob: '2016-02-29', className: '4th Grade' }
    const starts = events(birthdayCalendarIcs({ kids: [leap], today: '2027-01-10', now: NOW })).map((e) => field(e, 'DTSTART'))
    expect(starts).toEqual(['VALUE=DATE:20270228', 'VALUE=DATE:20280229'])
  })

  it('lists events by date, then name', () => {
    const kids = [
      { id: 'b', firstName: 'Bishoy', lastName: 'A', dob: '2015-06-01', className: '' },
      { id: 'a', firstName: 'Abanoub', lastName: 'B', dob: '2014-06-01', className: '' },
      { id: 'c', firstName: 'Carol', lastName: 'C', dob: '2015-01-02', className: '' },
    ]
    const ids = events(birthdayCalendarIcs({ kids, today: '2026-10-19', now: NOW })).map((e) => field(e, 'UID')?.split('@')[0])
    expect(ids).toEqual(['c-2026', 'a-2026', 'b-2026', 'c-2027', 'a-2027', 'b-2027'])
  })

  it('writes just the first name when there is no last name, and no class line when there is no class', () => {
    const [event] = events(birthdayCalendarIcs({ kids: [{ id: 'x', firstName: 'Marina', lastName: '', dob: '2018-01-01', className: '' }], today: '2026-10-19', now: NOW }))
    expect(field(event, 'SUMMARY')).toBe('🎂 Marina turns 8')
    expect(field(event, 'DESCRIPTION')).toBeUndefined()
  })

  it('escapes commas, semicolons and backslashes in names', () => {
    const odd = { id: 'odd', firstName: 'Anna, Maria;', lastName: '\\Smith', dob: '2016-04-04', className: 'A, B' }
    const [event] = events(birthdayCalendarIcs({ kids: [odd], today: '2026-10-19', now: NOW }))
    expect(field(event, 'SUMMARY')).toBe('🎂 Anna\\, Maria\\; \\\\. turns 10')
    expect(field(event, 'DESCRIPTION')).toBe('A\\, B')
  })

  it('ends every line with CRLF and folds long lines at 75 bytes without splitting a character', () => {
    const long = { id: 'long', firstName: 'Ü'.repeat(60), lastName: 'Z', dob: '2016-04-04', className: 'Ü'.repeat(50) }
    const ics = birthdayCalendarIcs({ kids: [long], today: '2026-10-19', now: NOW })
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/)
    for (const line of ics.split('\r\n')) expect(Buffer.byteLength(line, 'utf8')).toBeLessThanOrEqual(75)
    // Unfolding gives back the whole title.
    const unfolded = ics.replace(/\r\n /g, '')
    expect(unfolded).toContain(`SUMMARY:🎂 ${'Ü'.repeat(60)} Z. turns 10\r\n`)
  })

  it('names the calendar and asks apps to check back twice a day', () => {
    const ics = birthdayCalendarIcs({ kids: [], today: '2026-10-19', now: NOW })
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true)
    expect(ics).toContain('\r\nX-WR-CALNAME:Sunday School birthdays\r\n')
    expect(ics).toContain('\r\nREFRESH-INTERVAL;VALUE=DURATION:PT12H\r\n')
    expect(ics).toContain('\r\nX-PUBLISHED-TTL:PT12H\r\n')
    expect(events(ics)).toEqual([])
  })

  it('stamps every event with when the calendar was made', () => {
    const [event] = events(birthdayCalendarIcs({ kids: [mina], today: '2026-10-19', now: NOW }))
    expect(field(event, 'DTSTAMP')).toBe('20261019T150000Z')
  })
})

describe('calendar link tokens', () => {
  it('are long, random and URL-safe', () => {
    const a = newCalendarToken()
    const b = newCalendarToken()
    expect(a).toMatch(/^[A-Za-z0-9_-]{32}$/)
    expect(a).not.toBe(b)
    expect(isCalendarToken(a)).toBe(true)
  })

  it('turn away anything that is not one, before the database is asked', () => {
    expect(isCalendarToken('')).toBe(false)
    expect(isCalendarToken('short')).toBe(false)
    expect(isCalendarToken('a'.repeat(31))).toBe(false)
    expect(isCalendarToken('a'.repeat(33))).toBe(false)
    expect(isCalendarToken(`${'a'.repeat(31)}/`)).toBe(false)
  })
})

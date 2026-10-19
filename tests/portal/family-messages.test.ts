import { describe, it, expect } from 'vitest'
import {
  MESSAGE_MAX,
  STANDARD_MESSAGE,
  excuseForMeeting,
  fillMessage,
  messageProblem,
  messagingOrder,
  missedRegister,
  sentTo,
  smsHref,
  whatsAppHref,
} from '@/lib/portal/family-messages'
import { kidPhoneList } from '@/lib/portal/phones'

/**
 * Family messages (2026-10-19): a servant writes one message for the children
 * who missed a meeting, and each family's button opens WhatsApp or Messages
 * with that child's own copy already written: "Friday's isn't Sunday's", and
 * nobody copy-pastes it once per child.
 */

describe('fillMessage', () => {
  const fill = { name: 'Mina', meeting: 'Bible Study', date: '2026-10-16' }

  it('puts the child, the meeting, the weekday and the date in', () => {
    expect(fillMessage('We missed {name} at {meeting} on {day}, {date}.', fill)).toBe(
      'We missed Mina at Bible Study on Friday, October 16.',
    )
  })

  it('fills every copy of a placeholder, whatever its case or spacing', () => {
    expect(fillMessage('{name}! { NAME } and {Name}', fill)).toBe('Mina! Mina and Mina')
  })

  it('leaves anything else in braces alone', () => {
    expect(fillMessage('Read {John 3} with {name}', fill)).toBe('Read {John 3} with Mina')
  })

  it('makes the standard message read as a whole sentence for the family', () => {
    const text = fillMessage(STANDARD_MESSAGE, { name: 'Mina', meeting: 'Sunday School', date: '2026-10-18' })
    expect(text).toContain('We really missed Mina at Sunday School on Sunday.')
    expect(text).not.toMatch(/[{}]/)
  })
})

describe('messageProblem', () => {
  it('accepts a message', () => {
    expect(messageProblem('We missed {name}.')).toBeNull()
  })

  it('refuses an empty one', () => {
    expect(messageProblem('   \n ')).toMatch(/Write the message/)
  })

  it('refuses one longer than a text can sensibly carry', () => {
    expect(messageProblem('a'.repeat(MESSAGE_MAX))).toBeNull()
    expect(messageProblem('a'.repeat(MESSAGE_MAX + 1))).toMatch(/under 1,000 characters/)
  })
})

describe('links that open the message already written', () => {
  it('WhatsApp gets the US 1 and the text', () => {
    expect(whatsAppHref('6155550101', 'Hi & bye')).toBe('https://wa.me/16155550101?text=Hi%20%26%20bye')
  })

  it('a text message carries the body in the form iPhone and Android both read', () => {
    expect(smsHref('6155550101', 'We missed you\nGod bless')).toBe('sms:+16155550101?&body=We%20missed%20you%0AGod%20bless')
  })

  it('a number already written with its country code is left as it is', () => {
    expect(smsHref('201001234567', 'Hi')).toBe('sms:+201001234567?&body=Hi')
    expect(whatsAppHref('201001234567', 'Hi')).toBe('https://wa.me/201001234567?text=Hi')
  })
})

describe('messagingOrder', () => {
  it('puts the mother first, as servants text the moms', () => {
    const phones = kidPhoneList({ fatherPhone: '6155550101', motherPhone: '6155550102', ownPhone: '6155550103' })
    expect(messagingOrder(phones).map((p) => p.label)).toEqual(['Mother', 'Father', 'Student'])
  })

  it('then a number the parents share, then the father, then the child', () => {
    expect(messagingOrder(kidPhoneList({ fatherPhone: '6155550101', motherPhone: '6155550101' })).map((p) => p.label)).toEqual(['Parents'])
    expect(messagingOrder(kidPhoneList({ fatherPhone: '6155550101', ownPhone: '6155550103' })).map((p) => p.label)).toEqual(['Father', 'Student'])
  })
})

describe('missedRegister', () => {
  const roster = [
    { id: 'present', joinedOn: '2026-09-01' },
    { id: 'absent', joinedOn: '2026-09-01' },
    { id: 'excused', joinedOn: '2026-09-01' },
    { id: 'unmarked', joinedOn: '2026-09-01' },
    { id: 'joined-later', joinedOn: '2026-10-17' },
  ]
  const marks = [
    { studentId: 'present', status: 'PRESENT' as const },
    { studentId: 'absent', status: 'ABSENT' as const },
    { studentId: 'excused', status: 'EXCUSED' as const },
  ]

  it('names the children marked absent and the ones nobody marked', () => {
    expect(missedRegister({ roster, marks, date: '2026-10-16' })).toEqual([
      { studentId: 'absent', marked: true },
      { studentId: 'unmarked', marked: false },
    ])
  })

  it('leaves out a child who joined after that day, unless the register marked them', () => {
    expect(missedRegister({ roster, marks, date: '2026-10-16' }).map((m) => m.studentId)).not.toContain('joined-later')
    const marked = [...marks, { studentId: 'joined-later', status: 'ABSENT' as const }]
    expect(missedRegister({ roster, marks: marked, date: '2026-10-16' }).map((m) => m.studentId)).toContain('joined-later')
  })

  it('counts a child who joined that very day', () => {
    expect(missedRegister({ roster, marks, date: '2026-10-17' }).map((m) => m.studentId)).toContain('joined-later')
  })

  it('says nobody missed a meeting that was never taken', () => {
    expect(missedRegister({ roster, marks: [], date: '2026-10-16' })).toEqual([])
  })
})

describe('sentTo', () => {
  it('reads who in the family a recorded message went to', () => {
    expect(sentTo('To Mother: We missed Mina at Bible Study.')).toBe('Mother')
    expect(sentTo('To Parent email 2: Checking in')).toBe('Parent email 2')
  })

  it('says nothing for a note written any other way', () => {
    expect(sentTo('Called, no answer')).toBeNull()
    expect(sentTo(null)).toBeNull()
  })
})

describe('excuseForMeeting', () => {
  const ex = (startsOn: string, endsOn: string) => ({ startsOn, endsOn, reason: 'Away' })

  it('takes the excuse that covered the meeting, even one over by now', () => {
    expect(excuseForMeeting([ex('2026-10-10', '2026-10-17')], '2026-10-16', '2026-10-19')).toEqual({
      excuse: ex('2026-10-10', '2026-10-17'),
      excused: true,
    })
  })

  it('takes one that is on now, though it began after the meeting', () => {
    expect(excuseForMeeting([ex('2026-10-18', '2026-11-01')], '2026-10-16', '2026-10-19')).toMatchObject({ excused: true })
  })

  it('shows one still to come without counting the child as excused', () => {
    expect(excuseForMeeting([ex('2026-10-25', '2026-11-01')], '2026-10-16', '2026-10-19')).toEqual({
      excuse: ex('2026-10-25', '2026-11-01'),
      excused: false,
    })
  })

  it('has nothing to say without one', () => {
    expect(excuseForMeeting([], '2026-10-16', '2026-10-19')).toEqual({ excuse: null, excused: false })
  })
})

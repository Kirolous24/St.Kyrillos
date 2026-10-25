import { describe, it, expect, vi } from 'vitest'

// 2026-10-24 — a Fellowship member who does not serve has an account only so
// their attendance and follow-ups have somewhere to live. It must never sign
// in, whatever its ID looks like and whatever PIN is typed.
const world = vi.hoisted(() => ({ account: null as unknown }))

vi.mock('@/lib/prisma', () => ({ prisma: { account: { findUnique: async () => world.account } } }))

import { attemptLogin, type LoginAccount, type LoginRepo } from '@/lib/portal/login'
import { loadPortalUser } from '@/lib/portal/portal-user'

const verify = async (pin: string, hash: string) => hash === `hash:${pin}`

function repoWith(account: LoginAccount): LoginRepo {
  return {
    async findByLoginId(loginId) {
      return account.loginId === loginId ? account : null
    },
    async bumpFailure() {
      return 1
    },
    async lockAccount() {},
    async recordSuccess() {},
  }
}

describe('a member account', () => {
  it('is refused at sign-in even with a four-digit ID and the right PIN', async () => {
    const member: LoginAccount = {
      id: 'acc-m', loginId: '4321', pinHash: 'hash:1111', role: 'MEMBER', displayName: 'Mina Testwell',
      isActive: true, failedAttempts: 0, lockedUntil: null, lastLoginAt: null,
    }
    const result = await attemptLogin(repoWith(member), { loginId: '4321', pin: '1111' }, { verify })
    expect(result).toEqual({ ok: false, reason: 'invalid' })
  })

  it('never becomes a signed-in portal user', async () => {
    world.account = {
      id: 'acc-m', role: 'MEMBER', displayName: 'Mina Testwell', photo: null, isActive: true,
      student: { id: 'st-m', classId: 'mens-meeting' }, servant: null,
    }
    expect(await loadPortalUser({ id: 'acc-m' })).toBeNull()
  })

  it('a servant who is also a member still signs in as a servant, with their meetings known', async () => {
    world.account = {
      id: 'acc-s', role: 'SERVANT', displayName: 'Paul Exampleson', photo: null, isActive: true,
      student: { id: 'st-s', classId: 'mens-meeting' },
      servant: {
        id: 'sv-s',
        stageOversight: null,
        classes: [
          { classId: '5th-6th-boys', title: 'COORDINATOR', class: { stage: 'ELEMENTARY' } },
          { classId: 'youth-meeting', title: null, class: { stage: 'FELLOWSHIP' } },
        ],
      },
    }
    const user = await loadPortalUser({ id: 'acc-s' })
    expect(user?.role).toBe('SERVANT')
    // Being a member is not being a child: no student pages for them.
    expect(user?.studentId).toBeUndefined()
    expect(user?.classIds).toEqual(['5th-6th-boys', 'youth-meeting'])
    expect(user?.fellowshipClassIds).toEqual(['youth-meeting'])
  })
})

describe("a member account's PIN", () => {
  it('is something no PIN can ever match', async () => {
    const bcrypt = (await import('bcryptjs')).default
    const { MEMBER_NO_LOGIN_HASH } = await import('@/lib/portal/fellowship')
    for (const pin of ['0000', '1234', '9999', '12345678', '']) expect(await bcrypt.compare(pin, MEMBER_NO_LOGIN_HASH)).toBe(false)
  })
})

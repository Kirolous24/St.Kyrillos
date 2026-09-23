import { describe, it, expect } from 'vitest'
import { attemptLogin, LOCKOUT, type LoginAccount, type LoginRepo, safeNextPath } from '@/lib/portal/login'

function makeRepo(accounts: LoginAccount[]): LoginRepo & { accounts: LoginAccount[] } {
  return {
    accounts,
    async findByLoginId(loginId) {
      return accounts.find((a) => a.loginId === loginId) ?? null
    },
    async bumpFailure(id) {
      const a = accounts.find((x) => x.id === id)!
      a.failedAttempts += 1
      return a.failedAttempts
    },
    async lockAccount(id, until) {
      const a = accounts.find((x) => x.id === id)!
      a.lockedUntil = until
    },
    async recordSuccess(id, at) {
      const a = accounts.find((x) => x.id === id)!
      a.failedAttempts = 0
      a.lockedUntil = null
      a.lastLoginAt = at
    },
  }
}

const verify = async (pin: string, hash: string) => hash === `hash:${pin}`

function account(over: Partial<LoginAccount> = {}): LoginAccount {
  return {
    id: 'a1',
    loginId: '1234',
    pinHash: 'hash:5678',
    role: 'STUDENT',
    displayName: 'Test Student',
    isActive: true,
    failedAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
    ...over,
  }
}

describe('attemptLogin', () => {
  const now = new Date('2026-09-20T13:00:00Z')

  it('succeeds with the right PIN and records the login', async () => {
    const repo = makeRepo([account()])
    const result = await attemptLogin(repo, { loginId: '1234', pin: '5678' }, { now, verify })
    expect(result).toEqual({ ok: true, account: expect.objectContaining({ id: 'a1', role: 'STUDENT' }) })
    expect(repo.accounts[0].lastLoginAt).toEqual(now)
  })

  it('fails with a wrong PIN and increments the counter', async () => {
    const repo = makeRepo([account()])
    const result = await attemptLogin(repo, { loginId: '1234', pin: '0000' }, { now, verify })
    expect(result).toEqual({ ok: false, reason: 'invalid' })
    expect(repo.accounts[0].failedAttempts).toBe(1)
    expect(repo.accounts[0].lockedUntil).toBeNull()
  })

  it('locks the account after the maximum failed attempts', async () => {
    const repo = makeRepo([account({ failedAttempts: LOCKOUT.maxAttempts - 1 })])
    const result = await attemptLogin(repo, { loginId: '1234', pin: '0000' }, { now, verify })
    expect(result).toEqual({ ok: false, reason: 'invalid' })
    expect(repo.accounts[0].lockedUntil).toEqual(new Date(now.getTime() + LOCKOUT.lockMs))
  })

  it('rejects a locked account even with the right PIN, without touching the hash', async () => {
    let verifyCalls = 0
    const countingVerify = async (p: string, h: string) => { verifyCalls++; return verify(p, h) }
    const lockedUntil = new Date(now.getTime() + 60_000)
    const repo = makeRepo([account({ lockedUntil, failedAttempts: 5 })])
    const result = await attemptLogin(repo, { loginId: '1234', pin: '5678' }, { now, verify: countingVerify })
    expect(result).toEqual({ ok: false, reason: 'locked', until: lockedUntil })
    expect(verifyCalls).toBe(0)
  })

  it('lets an expired lock through and resets on success', async () => {
    const repo = makeRepo([account({ lockedUntil: new Date(now.getTime() - 1), failedAttempts: 5 })])
    const result = await attemptLogin(repo, { loginId: '1234', pin: '5678' }, { now, verify })
    expect(result.ok).toBe(true)
    expect(repo.accounts[0].failedAttempts).toBe(0)
  })

  it('rejects unknown IDs and inactive accounts with the same generic reason', async () => {
    const repo = makeRepo([account({ isActive: false })])
    expect(await attemptLogin(repo, { loginId: '9999', pin: '5678' }, { now, verify })).toEqual({ ok: false, reason: 'invalid' })
    expect(await attemptLogin(repo, { loginId: '1234', pin: '5678' }, { now, verify })).toEqual({ ok: false, reason: 'invalid' })
  })

  it('rejects malformed input before hitting the repo', async () => {
    const repo = makeRepo([account()])
    expect(await attemptLogin(repo, { loginId: '12', pin: '5678' }, { now, verify })).toEqual({ ok: false, reason: 'invalid' })
    expect(await attemptLogin(repo, { loginId: '1234', pin: 'abcd' }, { now, verify })).toEqual({ ok: false, reason: 'invalid' })
    expect(await attemptLogin(repo, { loginId: ' 1234 ', pin: '5678' }, { now, verify })).toMatchObject({ ok: true })
  })
})

describe('attemptLogin lockout under concurrency', () => {
  const now = new Date('2026-09-20T13:00:00Z')
  // Every concurrent attempt reads the same account row, then awaits the hash
  // comparison. The counter has to come from the store, not from that snapshot.
  const slowVerify = async (pin: string, hash: string) => {
    await new Promise((r) => setTimeout(r, 0))
    return hash === `hash:${pin}`
  }

  it('counts every simultaneous wrong PIN and locks once the limit is reached', async () => {
    const repo = makeRepo([account()])
    await Promise.all(
      Array.from({ length: LOCKOUT.maxAttempts }, () =>
        attemptLogin(repo, { loginId: '1234', pin: '0000' }, { now, verify: slowVerify }),
      ),
    )
    expect(repo.accounts[0].failedAttempts).toBe(LOCKOUT.maxAttempts)
    expect(repo.accounts[0].lockedUntil).toEqual(new Date(now.getTime() + LOCKOUT.lockMs))
  })

  it('does not lock while the burst stays under the limit', async () => {
    const repo = makeRepo([account()])
    await Promise.all(
      Array.from({ length: LOCKOUT.maxAttempts - 1 }, () =>
        attemptLogin(repo, { loginId: '1234', pin: '0000' }, { now, verify: slowVerify }),
      ),
    )
    expect(repo.accounts[0].failedAttempts).toBe(LOCKOUT.maxAttempts - 1)
    expect(repo.accounts[0].lockedUntil).toBeNull()
  })

  it('never resets the counter on a failure (the bump is additive, not a write-back)', async () => {
    const repo = makeRepo([account({ failedAttempts: 3 })])
    await attemptLogin(repo, { loginId: '1234', pin: '0000' }, { now, verify })
    expect(repo.accounts[0].failedAttempts).toBe(4)
  })
})

// A child scans the projected group code while signed out. The middleware used
// to bounce them to /portal/login and throw the path away, so after signing in
// they landed on the dashboard and the code — which expires in five minutes —
// was gone. Preserving the destination means accepting it from the URL, so it
// has to be validated: an unchecked `next` is an open redirect.
describe('safeNextPath', () => {
  it('keeps an internal portal path', () => {
    expect(safeNextPath('/portal/scan/abc123')).toBe('/portal/scan/abc123')
    expect(safeNextPath('/portal/my-attendance')).toBe('/portal/my-attendance')
  })

  it('keeps a query string', () => {
    expect(safeNextPath('/portal/grades?student=abc')).toBe('/portal/grades?student=abc')
  })

  it('refuses to send anyone off-site', () => {
    expect(safeNextPath('https://evil.example.com/steal')).toBeNull()
    expect(safeNextPath('http://evil.example.com')).toBeNull()
    expect(safeNextPath('//evil.example.com')).toBeNull()
    expect(safeNextPath('/\\evil.example.com')).toBeNull()
  })

  it('refuses paths outside the portal', () => {
    expect(safeNextPath('/admin/dashboard')).toBeNull()
    expect(safeNextPath('/')).toBeNull()
    expect(safeNextPath('/portalish')).toBeNull()
  })

  it('refuses the login page itself, so it cannot loop', () => {
    expect(safeNextPath('/portal/login')).toBeNull()
    expect(safeNextPath('/portal/login?next=/portal')).toBeNull()
  })

  it('is null for nothing usable', () => {
    expect(safeNextPath(null)).toBeNull()
    expect(safeNextPath(undefined)).toBeNull()
    expect(safeNextPath('')).toBeNull()
  })
})


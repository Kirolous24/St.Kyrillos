import { prisma } from '@/lib/prisma'
import type { LoginRepo } from './login'

export const prismaLoginRepo: LoginRepo = {
  async findByLoginId(loginId) {
    return prisma.account.findUnique({
      where: { loginId },
      select: {
        id: true,
        loginId: true,
        pinHash: true,
        role: true,
        displayName: true,
        isActive: true,
        failedAttempts: true,
        lockedUntil: true,
        lastLoginAt: true,
      },
    })
  },
  async bumpFailure(id) {
    // `increment` is applied by Postgres, so simultaneous attempts each add
    // one instead of all writing the same stale count back.
    const row = await prisma.account.update({
      where: { id },
      data: { failedAttempts: { increment: 1 } },
      select: { failedAttempts: true },
    })
    return row.failedAttempts
  },
  async lockAccount(id, until) {
    await prisma.account.update({ where: { id }, data: { lockedUntil: until } })
  },
  async recordSuccess(id, at) {
    await prisma.account.update({
      where: { id },
      data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: at },
    })
  },
}

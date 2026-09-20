import { randomInt } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { PortalError } from './action-result'

/** A fresh random 4-digit PIN, e.g. "0042". */
export function randomPin(): string {
  return String(randomInt(0, 10000)).padStart(4, '0')
}

/** A 4-digit login ID not already taken by any account. */
export async function freeLoginId(): Promise<string> {
  for (let i = 0; i < 50; i++) {
    const candidate = String(randomInt(1000, 10000))
    const taken = await prisma.account.findUnique({ where: { loginId: candidate }, select: { id: true } })
    if (!taken) return candidate
  }
  throw new PortalError('Could not find a free ID. Try again.')
}

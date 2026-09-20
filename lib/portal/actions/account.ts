'use server'

import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '../session'
import { runAction, PortalError, type ActionResult } from '../action-result'
import { audit } from '../audit'
import { PIN_RE } from '../login'

const Schema = z.object({ currentPin: z.string(), newPin: z.string(), confirmPin: z.string() })

export async function changeOwnPin(raw: z.infer<typeof Schema>): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const input = Schema.parse(raw)
    if (!PIN_RE.test(input.newPin)) throw new PortalError('The new PIN must be 4 to 8 digits.')
    if (input.newPin !== input.confirmPin) throw new PortalError('The two PINs do not match.')
    if (input.newPin === input.currentPin) throw new PortalError('Choose a different PIN.')
    const account = await prisma.account.findUnique({ where: { id: user.accountId }, select: { pinHash: true } })
    if (!account || !(await bcrypt.compare(input.currentPin, account.pinHash))) throw new PortalError('Your current PIN is not correct.')
    await prisma.account.update({ where: { id: user.accountId }, data: { pinHash: await bcrypt.hash(input.newPin, 10) } })
    await audit(user, 'account.changePin', 'account', user.accountId, 'Changed own PIN')
    return undefined
  })
}

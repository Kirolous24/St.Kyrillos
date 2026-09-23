'use server'

import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '../session'
import { runAction, PortalError, type ActionResult } from '../action-result'
import { audit } from '../audit'
import { PIN_RE } from '../login'
import { parseDateOnly, toUTCDate } from '../dates'
import { revalidatePath } from 'next/cache'

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

/**
 * Self-service profile edit, restored from the prototype's "My Profile" page
 * (svLoad('myprofile') / stLoad('profile')), which the port dropped entirely —
 * a servant had no way to correct their own email, phone, address or birthday.
 *
 * Students stay read-only, exactly as in the prototype: their record is kept
 * by their servant, and parent contact details are not theirs to change.
 */
const ProfileSchema = z.object({
  email: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(40).optional(),
  address: z.string().trim().max(300).optional(),
  birthday: z.string().trim().optional(),
})

export async function updateOwnProfile(raw: z.infer<typeof ProfileSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePortalUser()
    if (user.role === 'STUDENT') throw new PortalError('Ask your servant to update your details.')
    const input = ProfileSchema.parse(raw)

    const email = input.email || null
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new PortalError('That email address does not look right.')

    let birthday: Date | null = null
    if (input.birthday) {
      const parsed = parseDateOnly(input.birthday)
      if (!parsed) throw new PortalError('That birthday is not a valid date.')
      birthday = toUTCDate(parsed)
    }

    await prisma.account.update({
      where: { id: user.accountId },
      data: { email, phone: input.phone || null },
    })
    // Only a servant record carries an address and birthday; a pure ADMIN
    // account has no Servant row, so there is nothing to write there.
    if (user.servantId) {
      await prisma.servant.update({
        where: { id: user.servantId },
        data: { address: input.address || null, birthday },
      })
    }

    await audit(user, 'account.updateProfile', 'account', user.accountId, 'Updated own profile')
    revalidatePath('/portal/profile')
    return undefined
  })
}

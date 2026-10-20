'use server'

import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '../session'
import { runAction, PortalError, type ActionResult } from '../action-result'
import { audit } from '../audit'
import { newCalendarToken } from '../birthday-calendar'

/**
 * The signed-in servant's birthday calendar link (2026-10-19). Made the first
 * time they ask, so nobody who never subscribes holds one, and the same every
 * time after, so a phone and a Mac can share it. Only an empty slot is
 * filled: two taps at once still end with one link.
 */
export async function getBirthdayCalendarLink(): Promise<ActionResult<{ token: string }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    if (user.role === 'STUDENT') throw new PortalError('Only servants have a birthday calendar.')
    const current = await prisma.account.findUnique({ where: { id: user.accountId }, select: { calendarToken: true } })
    if (current?.calendarToken) return { token: current.calendarToken }
    await prisma.account.updateMany({
      where: { id: user.accountId, calendarToken: null },
      data: { calendarToken: newCalendarToken() },
    })
    const made = await prisma.account.findUnique({ where: { id: user.accountId }, select: { calendarToken: true } })
    if (!made?.calendarToken) throw new Error('Calendar link was not saved')
    return { token: made.calendarToken }
  })
}

/** A new link for the signed-in servant; the old one stops working. */
export async function resetBirthdayCalendarLink(): Promise<ActionResult<{ token: string }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    if (user.role === 'STUDENT') throw new PortalError('Only servants have a birthday calendar.')
    const token = newCalendarToken()
    await prisma.account.update({ where: { id: user.accountId }, data: { calendarToken: token } })
    await audit(user, 'account.resetCalendarLink', 'account', user.accountId, 'Replaced own birthday calendar link')
    return { token }
  })
}

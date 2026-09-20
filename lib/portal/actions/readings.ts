'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '../session'
import { runAction, PortalError, type ActionResult } from '../action-result'
import { formatDateOnly, todayInNewYork, toUTCDate } from '../dates'
import { readingStreak } from '../achievements'
import { audit } from '../audit'

/**
 * "I read today." The day is the server's day in the church's timezone and the
 * student is the session's student — neither is taken from the client, so the
 * check-in cannot be back-dated or filed against someone else. The unique
 * (studentId, date) index makes a double tap a no-op.
 */
export async function checkInReading(): Promise<ActionResult<{ streak: number; alreadyIn: boolean }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    if (!user.studentId) throw new PortalError('Only students can check in a reading.')

    const today = todayInNewYork()
    const day = toUTCDate(today)

    const existing = await prisma.bibleReadingLog.findUnique({
      where: { studentId_date: { studentId: user.studentId, date: day } },
      select: { id: true },
    })
    if (!existing) {
      await prisma.bibleReadingLog.create({ data: { studentId: user.studentId, date: day } })
    }

    const logs = await prisma.bibleReadingLog.findMany({
      where: { studentId: user.studentId },
      orderBy: { date: 'desc' },
      take: 400,
      select: { date: true },
    })
    const streak = readingStreak(logs.map((l) => formatDateOnly(l.date)), today)

    if (!existing) {
      await audit(user, 'reading.checkin', 'student', user.studentId, `read the Bible on ${today} (${streak}-day streak)`)
    }

    revalidatePath('/portal/readings')
    revalidatePath('/portal/achievements')
    revalidatePath('/portal')
    return { streak, alreadyIn: !!existing }
  })
}

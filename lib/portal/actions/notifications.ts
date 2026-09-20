'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '../session'
import { runAction, type ActionResult } from '../action-result'

// Notifications themselves are never stored — only the fact that this person
// has dismissed one (NotificationRead, unique per account + key).

const KeySchema = z.string().trim().min(1).max(200)
const KeysSchema = z.array(KeySchema).max(100)

export async function dismissNotification(rawKey: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const key = KeySchema.parse(rawKey)
    await prisma.notificationRead.upsert({
      where: { accountId_key: { accountId: user.accountId, key } },
      create: { accountId: user.accountId, key },
      update: {},
    })
    revalidatePath('/portal')
    return undefined
  })
}

export async function markAllNotificationsRead(rawKeys: string[]): Promise<ActionResult<{ count: number }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const keys = Array.from(new Set(KeysSchema.parse(rawKeys)))
    if (keys.length === 0) return { count: 0 }
    // createMany + skipDuplicates keeps this one round trip and idempotent.
    const created = await prisma.notificationRead.createMany({
      data: keys.map((key) => ({ accountId: user.accountId, key })),
      skipDuplicates: true,
    })
    revalidatePath('/portal')
    return { count: created.count }
  })
}

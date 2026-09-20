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

/*
 * Form-shaped wrappers for <form action={...}>.
 *
 * The bell used to inline these as closures with 'use server' inside the JSX.
 * That captures the surrounding scope, and because NotificationBell is handed
 * to the client Shell as a prop, React has to serialise the captured values —
 * which fails with "Functions cannot be passed directly to Client Components".
 * The bell renders these forms only when there is at least one notification,
 * so the breakage only appeared for accounts that actually had any.
 *
 * Taking the key through FormData keeps the action a plain module-level export
 * with nothing captured.
 */

export async function dismissNotificationForm(formData: FormData): Promise<void> {
  const key = formData.get('key')
  if (typeof key === 'string' && key) await dismissNotification(key)
}

export async function markAllNotificationsReadForm(): Promise<void> {
  const user = await requirePortalUser()
  const { loadNotifications } = await import('../data/reports')
  const items = await loadNotifications(user)
  if (items.length) await markAllNotificationsRead(items.map((n) => n.key))
}

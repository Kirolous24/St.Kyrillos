'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '../session'
import { runAction, PortalError, type ActionResult } from '../action-result'
import { isLiveSite } from '../login-email'
import { deliverNotices } from '../notice-delivery'
import { isPushServiceUrl } from '../push-client'

/**
 * A servant's notification settings (2026-10-19): the phones and computers that
 * asked for notifications, whether to be emailed when none has, and a test.
 * Notifications are for staff; a child's account cannot register a phone.
 */

const SubscriptionSchema = z.object({
  endpoint: z
    .string()
    .trim()
    .max(1000)
    .refine((u) => /^https:\/\/[^\s]+$/.test(u), 'That notification address is not a secure one.')
    .refine((u) => isPushServiceUrl(u), 'That is not a notification service this portal knows.'),
  keys: z.object({ p256dh: z.string().trim().min(1).max(200), auth: z.string().trim().min(1).max(200) }),
  userAgent: z.string().trim().max(300).optional(),
})

/** Validation messages are the servant's to read, not "Something went wrong". */
function parse<T>(schema: z.ZodType<T>, raw: unknown): T {
  const r = schema.safeParse(raw)
  if (!r.success) throw new PortalError(r.error.issues[0]?.message ?? 'Check the details and try again.')
  return r.data
}

async function staff() {
  const user = await requirePortalUser()
  if (user.role === 'STUDENT') throw new PortalError('Notifications are for servants.')
  return user
}

function revalidateSettings(): void {
  revalidatePath('/portal/settings')
  revalidatePath('/portal/assignments')
}

/**
 * Keep this browser's subscription for whoever is signed in. A browser that
 * signs in as somebody else moves to them, so one phone never notifies two
 * people. `live` records which kind of site saved it.
 */
export async function savePushSubscription(raw: z.infer<typeof SubscriptionSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const user = await staff()
    const input = parse(SubscriptionSchema, raw)
    const fields = {
      accountId: user.accountId,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      live: isLiveSite(process.env),
      userAgent: input.userAgent || null,
    }
    await prisma.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      create: { ...fields, endpoint: input.endpoint },
      update: fields,
    })
    revalidateSettings()
    return undefined
  })
}

export async function removePushSubscription(endpoint: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await staff()
    const value = z.string().trim().min(1).max(1000).parse(endpoint)
    await prisma.pushSubscription.deleteMany({ where: { endpoint: value, accountId: user.accountId } })
    revalidateSettings()
    return undefined
  })
}

export async function setNoticeEmails(on: boolean): Promise<ActionResult> {
  return runAction(async () => {
    const user = await staff()
    await prisma.account.update({ where: { id: user.accountId }, data: { noticeEmails: z.boolean().parse(on) } })
    revalidateSettings()
    return undefined
  })
}

/** One test notice, delivered like any other: to the phones that are on, or by email. */
export async function sendTestNotice(): Promise<ActionResult<{ pushed: number; emailed: number }>> {
  return runAction(async () => {
    const user = await staff()
    if (!user.servantId) throw new PortalError('Test notifications are for servants.')
    const report = await deliverNotices([
      {
        servantId: user.servantId,
        kind: 'test',
        title: 'Test notification',
        body: 'Notifications are working.',
        href: '/portal/settings',
        dedupeKey: `test:${user.servantId}:${randomUUID()}`,
      },
    ])
    revalidatePath('/portal', 'layout')
    return { pushed: report.pushed, emailed: report.emailed }
  })
}

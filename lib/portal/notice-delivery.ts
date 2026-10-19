import { Resend } from 'resend'
import { prisma } from '@/lib/prisma'
import { isUniqueViolation } from '@/lib/prisma-errors'
import { shouldEmail, type NoticeText } from './assignment-notices'
import { LOGIN_EMAIL_FROM, emailRouting, isLiveSite, resendApiKey } from './login-email'
import { pushConfigured, sendPush } from './web-push'

/**
 * Delivering servant notices (2026-10-19). Each notice is stored, which puts
 * it in the bell, then pushed to every phone the servant turned notifications
 * on. When none is on it is emailed instead, so nobody gets both on one phone.
 *
 * Two lines keep a test run away from real servants. Email goes through
 * `emailRouting`: real addresses only from the live site. Phones are notified
 * only by the kind of site that registered them, since a dev copy of the
 * database also holds the live site's phones.
 *
 * Nothing here may undo the save that caused it, so it never rejects.
 */

export type NoticeKind = 'assigned' | 'unassigned' | 'reminder' | 'test'

export interface OutgoingNotice extends NoticeText {
  servantId: string
  kind: NoticeKind
  /** Unique: a second notice with the same key is neither stored nor sent. */
  dedupeKey: string
}

export interface DeliveryReport {
  stored: number
  /** Notices that reached at least one phone. */
  pushed: number
  emailed: number
  skipped: number
}

/** Where every link in an email points: the live site, whichever site sent it. */
export const SITE_ORIGIN = 'https://stkyrillostn.org'

type Env = Record<string, string | undefined>

/**
 * How many servants are reached at once. One at a time, a term imported for a
 * whole class or a busy Saturday's reminders could outlast the server's time
 * limit; all at once would queue on the database connections.
 */
const AT_ONCE = 8

async function inGroups<T>(items: readonly T[], size: number, fn: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += size) await Promise.allSettled(items.slice(i, i + size).map(fn))
}

export function noticeEmailText(n: NoticeText): string {
  return [
    n.body,
    '',
    `Open it: ${SITE_ORIGIN}${n.href}`,
    '',
    'You get these because you serve at St. Kyrillos Sunday School.',
    `To stop these emails, turn them off in Settings: ${SITE_ORIGIN}/portal/settings`,
    '',
    'St. Kyrillos Sunday School',
  ].join('\n')
}

export async function deliverNotices(notices: readonly OutgoingNotice[], env: Env = process.env): Promise<DeliveryReport> {
  const report: DeliveryReport = { stored: 0, pushed: 0, emailed: 0, skipped: 0 }
  if (notices.length === 0) return report
  try {
    const live = isLiveSite(env)
    const pushOn = pushConfigured(env)
    const servants = await prisma.servant.findMany({
      where: { id: { in: Array.from(new Set(notices.map((n) => n.servantId))) } },
      select: {
        id: true,
        account: {
          select: {
            id: true,
            isActive: true,
            email: true,
            noticeEmails: true,
            pushSubscriptions: { where: { live }, select: { id: true, endpoint: true, p256dh: true, auth: true } },
          },
        },
      },
    })
    const byId = new Map(servants.map((s) => [s.id, s.account]))
    const routing = emailRouting(env)
    const apiKey = resendApiKey(env)
    // Sent together at the end: the email service takes two calls a second.
    const emails: Array<{ from: string; to: string; subject: string; text: string }> = []

    await inGroups(notices, AT_ONCE, async (n) => {
      try {
        const account = byId.get(n.servantId)
        if (!account || !account.isActive) {
          report.skipped++
          return
        }
        try {
          await prisma.notice.create({
            data: { accountId: account.id, kind: n.kind, title: n.title, body: n.body, href: n.href, dedupeKey: n.dedupeKey },
          })
        } catch (err) {
          if (isUniqueViolation(err)) {
            report.skipped++
            return
          }
          throw err
        }
        report.stored++

        let reached = false
        if (pushOn && account.pushSubscriptions.length > 0) {
          const subs = [...account.pushSubscriptions]
          const results = await Promise.allSettled(subs.map((sub) => sendPush(sub, { title: n.title, body: n.body, href: n.href, tag: n.dedupeKey }, env)))
          for (let i = 0; i < subs.length; i++) {
            const r = results[i]!
            const sub = subs[i]!
            if (r.status !== 'fulfilled') continue
            if (r.value === 'sent') {
              reached = true
              await prisma.pushSubscription.update({ where: { id: sub.id }, data: { lastSentAt: new Date() } }).catch(() => {})
            } else if (r.value === 'gone') {
              await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {})
              account.pushSubscriptions = account.pushSubscriptions.filter((s) => s.id !== sub.id)
            }
          }
        }
        if (reached) report.pushed++

        const phones = pushOn ? account.pushSubscriptions.length : 0
        if (routing.mode !== 'off' && apiKey && shouldEmail({ email: account.email, noticeEmails: account.noticeEmails, pushDevices: phones })) {
          emails.push({
            from: LOGIN_EMAIL_FROM,
            to: routing.mode === 'live' ? account.email!.trim() : routing.to,
            subject: routing.mode === 'live' ? n.title : `[TEST for ${account.email!.trim()}] ${n.title}`,
            text: noticeEmailText(n),
          })
        }
      } catch (err) {
        console.error('Notice delivery failed:', err)
      }
    })

    if (emails.length > 0 && apiKey) {
      const resend = new Resend(apiKey)
      for (let i = 0; i < emails.length; i += 100) {
        const chunk = emails.slice(i, i + 100)
        try {
          const { error } = await resend.batch.send(chunk)
          if (error) console.error('Notice emails failed:', error.message)
          else report.emailed += chunk.length
        } catch (err) {
          console.error('Notice emails failed:', err)
        }
      }
    }
  } catch (err) {
    console.error('Notice delivery failed:', err)
  }
  return report
}

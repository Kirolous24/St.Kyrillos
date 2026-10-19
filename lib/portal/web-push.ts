import webpush from 'web-push'

/**
 * Phone notifications (Web Push, 2026-10-19). The keys are VAPID keys, made
 * once with `npx web-push generate-vapid-keys` and kept in the environment
 * only: the repository is public. Without them phones are simply not offered
 * notifications, and the bell and email carry on.
 */

type Env = Record<string, string | undefined>

const SUBJECT = 'mailto:noreply@stkyrillostn.org'

/** The key a browser subscribes with, or null when phone notifications are not set up. */
export function webPushPublicKey(env: Env = process.env): string | null {
  return env.WEB_PUSH_PUBLIC_KEY?.trim() || null
}

export function pushConfigured(env: Env = process.env): boolean {
  return !!webPushPublicKey(env) && !!env.WEB_PUSH_PRIVATE_KEY?.trim()
}

export type PushResult = 'sent' | 'gone' | 'failed' | 'off'

/**
 * One notification to one device. "gone" means the push service no longer
 * knows it (the phone turned notifications off or the app was removed), so the
 * caller forgets it; anything else that goes wrong is "failed" and the device
 * is kept.
 */
export async function sendPush(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: { title: string; body: string; href: string; tag: string },
  env: Env = process.env,
): Promise<PushResult> {
  const publicKey = webPushPublicKey(env)
  const privateKey = env.WEB_PUSH_PRIVATE_KEY?.trim()
  if (!publicKey || !privateKey) return 'off'
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      // High urgency: a notice is meant to be seen now, and "normal" lets a
      // phone saving battery hold it back.
      { TTL: 86_400, timeout: 10_000, urgency: 'high', vapidDetails: { subject: SUBJECT, publicKey, privateKey } },
    )
    return 'sent'
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode
    if (status === 404 || status === 410) {
      console.warn(`Push device gone (${status}); forgetting it:`, String((err as { body?: unknown }).body ?? '').slice(0, 200))
      return 'gone'
    }
    console.error('Push notification failed:', status ?? (err as Error).message)
    return 'failed'
  }
}

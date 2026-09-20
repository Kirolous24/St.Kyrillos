import { prisma } from './prisma'

// Records the outcome of the most recent PubSubHubbub subscribe attempt so the
// status endpoint can show *why* a lease lapsed (e.g. Google's hub returning
// 503 "Transient error" for days, as it did in Sept 2026) without anyone
// having to dig through Vercel logs. Stored in AppSetting to avoid a schema
// change; the hub call itself lives in the route handlers.

export const HUB_LAST_ATTEMPT_KEY = 'youtubeHubLastAttemptAt'
export const HUB_LAST_RESULT_KEY = 'youtubeHubLastResult'

export interface HubAttempt {
  lastAttemptAt: string | null
  lastResult: string | null // "ok" or "HTTP 503: Transient error; please try again later"
}

export async function recordHubAttempt(result: string): Promise<void> {
  const now = new Date().toISOString()
  const value = result.slice(0, 500)
  try {
    await prisma.$transaction([
      prisma.appSetting.upsert({
        where: { key: HUB_LAST_ATTEMPT_KEY },
        update: { value: now },
        create: { key: HUB_LAST_ATTEMPT_KEY, value: now },
      }),
      prisma.appSetting.upsert({
        where: { key: HUB_LAST_RESULT_KEY },
        update: { value },
        create: { key: HUB_LAST_RESULT_KEY, value },
      }),
    ])
  } catch {
    // Diagnostics only — never let this fail the subscribe call.
  }
}

export async function readHubAttempt(): Promise<HubAttempt> {
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: [HUB_LAST_ATTEMPT_KEY, HUB_LAST_RESULT_KEY] } },
  })
  const map = new Map(rows.map((r) => [r.key, r.value]))
  return {
    lastAttemptAt: map.get(HUB_LAST_ATTEMPT_KEY) ?? null,
    lastResult: map.get(HUB_LAST_RESULT_KEY) ?? null,
  }
}

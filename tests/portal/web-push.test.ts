import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * One phone notification to one device (2026-10-19). Sent as urgent, since a
 * notice is meant to be seen now and "normal" lets a phone saving battery hold
 * it back; a device the push service no longer knows is reported gone so it can
 * be forgotten. Stand-in: the web-push library.
 */
const world = vi.hoisted(() => ({
  calls: [] as Array<{ sub: unknown; payload: string; options: Record<string, unknown> }>,
  error: null as null | { statusCode?: number; body?: string },
}))
vi.mock('web-push', () => ({
  default: {
    sendNotification: async (sub: unknown, payload: string, options: Record<string, unknown>) => {
      world.calls.push({ sub, payload, options })
      if (world.error) throw Object.assign(new Error('push failed'), world.error)
      return { statusCode: 201 }
    },
  },
}))

import { pushConfigured, sendPush, webPushPublicKey } from '@/lib/portal/web-push'

const ENV = { WEB_PUSH_PUBLIC_KEY: 'pub', WEB_PUSH_PRIVATE_KEY: 'priv' }
const SUB = { endpoint: 'https://fcm.googleapis.com/fcm/send/x', p256dh: 'p', auth: 'a' }
const PAYLOAD = { title: 'New assignment', body: 'You’re on Coptic', href: '/portal/assignments', tag: 'assigned:sv:1' }

beforeEach(() => {
  world.calls = []
  world.error = null
})

describe('sendPush', () => {
  it('sends the notice as urgent, for a day, signed for the church', async () => {
    expect(await sendPush(SUB, PAYLOAD, ENV)).toBe('sent')
    expect(world.calls).toHaveLength(1)
    expect(JSON.parse(world.calls[0]!.payload)).toEqual(PAYLOAD)
    expect(world.calls[0]!.options).toMatchObject({
      urgency: 'high',
      TTL: 86_400,
      vapidDetails: { subject: 'mailto:noreply@stkyrillostn.org', publicKey: 'pub', privateKey: 'priv' },
    })
  })

  it('reports a device the push service no longer knows as gone', async () => {
    world.error = { statusCode: 410, body: 'expired' }
    expect(await sendPush(SUB, PAYLOAD, ENV)).toBe('gone')
    world.error = { statusCode: 404 }
    expect(await sendPush(SUB, PAYLOAD, ENV)).toBe('gone')
  })

  it('keeps a device after any other failure', async () => {
    world.error = { statusCode: 500 }
    expect(await sendPush(SUB, PAYLOAD, ENV)).toBe('failed')
  })

  it('does nothing without both keys', async () => {
    expect(await sendPush(SUB, PAYLOAD, { WEB_PUSH_PUBLIC_KEY: 'pub' })).toBe('off')
    expect(world.calls).toEqual([])
    expect(pushConfigured({ WEB_PUSH_PUBLIC_KEY: 'pub' })).toBe(false)
    expect(webPushPublicKey({})).toBeNull()
  })
})

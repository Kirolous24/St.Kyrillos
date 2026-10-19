import { describe, it, expect } from 'vitest'
import { isIosDevice, phoneSupport, urlBase64ToUint8Array } from '@/lib/portal/push-client'

/**
 * Turning on phone notifications (2026-10-19). An iPhone only offers them to
 * the Home Screen app, so the Settings card has to know when to show the
 * install steps instead of a button.
 */

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const IPAD_DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36'

describe('isIosDevice', () => {
  it('knows an iPhone, and an iPad that calls itself a Mac', () => {
    expect(isIosDevice(IPHONE, 5)).toBe(true)
    expect(isIosDevice(IPAD_DESKTOP_UA, 5)).toBe(true)
  })

  it('not a real Mac, nor Android', () => {
    expect(isIosDevice(IPAD_DESKTOP_UA, 0)).toBe(false)
    expect(isIosDevice(ANDROID, 5)).toBe(false)
  })
})

describe('phoneSupport', () => {
  const all = { hasServiceWorker: true, hasPushManager: true, hasNotification: true }

  it('an iPhone in Safari is shown how to add the portal to the Home Screen', () => {
    expect(phoneSupport({ hasServiceWorker: true, hasPushManager: false, hasNotification: false, ios: true, standalone: false })).toBe('ios-install')
  })

  it('the Home Screen app on a current iPhone can turn them on', () => {
    expect(phoneSupport({ ...all, ios: true, standalone: true })).toBe('ok')
  })

  it('an old iPhone, even from the Home Screen, cannot', () => {
    expect(phoneSupport({ hasServiceWorker: true, hasPushManager: false, hasNotification: false, ios: true, standalone: true })).toBe('unsupported')
  })

  it('Android and computers can, straight from the browser', () => {
    expect(phoneSupport({ ...all, ios: false, standalone: false })).toBe('ok')
  })
})

describe('urlBase64ToUint8Array', () => {
  it('turns a VAPID public key into its 65 bytes', () => {
    const key = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U'
    const bytes = urlBase64ToUint8Array(key)
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(bytes.length).toBe(65)
    expect(bytes[0]).toBe(4)
  })
})

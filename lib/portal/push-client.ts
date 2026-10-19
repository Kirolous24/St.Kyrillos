// Turning on phone notifications (2026-10-19): what this browser can do. Pure
// and browser-safe; tested in tests/portal/push-client.test.ts.
//
// Android and computers take notifications straight from the browser. An
// iPhone or iPad offers them only to the portal added to the Home Screen
// (iOS 16.4 and later), so Safari is shown how to add it instead.

/** An iPhone, iPod or iPad; an iPad's Safari calls itself a Mac with a touch screen. */
export function isIosDevice(ua: string, maxTouchPoints: number): boolean {
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1)
}

export type PhoneSupport = 'ok' | 'ios-install' | 'unsupported'

export function phoneSupport(p: {
  hasServiceWorker: boolean
  hasPushManager: boolean
  hasNotification: boolean
  ios: boolean
  /** Running as the Home Screen app. */
  standalone: boolean
}): PhoneSupport {
  if (p.ios && !p.standalone) return 'ios-install'
  if (!p.hasServiceWorker || !p.hasPushManager || !p.hasNotification) return 'unsupported'
  return 'ok'
}

/** The public key as the browser's subscribe call wants it. */
export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = `${base64}${'='.repeat((4 - (base64.length % 4)) % 4)}`.replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

/**
 * The push services browsers deliver through: Google's (Chrome, Edge on
 * Android, Samsung, Brave), Apple's, Mozilla's and Microsoft's. The server only
 * ever posts to one of these, never to an address a login typed in.
 */
const PUSH_SERVICE_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^android\.googleapis\.com$/,
  /(^|\.)push\.apple\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /\.notify\.windows\.com$/,
]

export function isPushServiceUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && PUSH_SERVICE_HOSTS.some((re) => re.test(u.hostname))
  } catch {
    return false
  }
}

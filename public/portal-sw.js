/*
 * St. Kyrillos Sunday School portal: phone notifications (2026-10-19).
 *
 * Registered with scope /portal by the Settings page. It does one job: show a
 * notification the server pushed, and open the page it points at when tapped.
 * It caches nothing, so the portal behaves exactly as it did without it.
 */

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (_) {
    data = { body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'St. Kyrillos Sunday School'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/portal-icon-192.png',
      badge: '/portal-icon-192.png',
      tag: data.tag || undefined,
      data: { href: data.href || '/portal' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL((event.notification.data && event.notification.data.href) || '/portal', self.location.origin).href
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of windows) {
        if (new URL(client.url).pathname.startsWith('/portal') && 'focus' in client) {
          await client.focus()
          try {
            await client.navigate(target)
            return
          } catch (_) {
            break
          }
        }
      }
      await self.clients.openWindow(target)
    })(),
  )
})

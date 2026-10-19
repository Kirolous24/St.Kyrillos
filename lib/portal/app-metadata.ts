import type { Metadata } from 'next'

/**
 * The portal as a Home Screen app (2026-10-19). An iPhone offers notifications
 * to a web app only once it is on the Home Screen, so every portal page names
 * the manifest and the Home Screen icon. The public website keeps its own.
 */
export const PORTAL_APP_METADATA: Pick<Metadata, 'manifest' | 'appleWebApp' | 'icons'> = {
  manifest: '/portal.webmanifest',
  appleWebApp: { capable: true, title: 'Sunday School', statusBarStyle: 'default' },
  icons: {
    icon: [{ url: '/images/Logo.png', type: 'image/png' }],
    apple: [{ url: '/portal-apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    shortcut: [{ url: '/images/Logo.png', type: 'image/png' }],
  },
}

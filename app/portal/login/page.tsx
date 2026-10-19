import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { PortalLoginForm } from './PortalLoginForm'
import { PORTAL_APP_METADATA } from '@/lib/portal/app-metadata'

export const metadata: Metadata = {
  title: 'Sunday School Sign In',
  robots: { index: false, follow: false },
  // Added to the Home Screen from here, it opens as the portal app (2026-10-19).
  ...PORTAL_APP_METADATA,
}

export default async function PortalLoginPage() {
  const session = await auth()
  if (session?.user?.kind === 'portal') redirect('/portal')
  return <PortalLoginForm />
}

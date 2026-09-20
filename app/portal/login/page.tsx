import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { PortalLoginForm } from './PortalLoginForm'

export const metadata: Metadata = {
  title: 'Sunday School Sign In',
  robots: { index: false, follow: false },
}

export default async function PortalLoginPage() {
  const session = await auth()
  if (session?.user?.kind === 'portal') redirect('/portal')
  return <PortalLoginForm />
}

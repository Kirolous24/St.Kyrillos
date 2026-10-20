import { cache } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { portalSessionExpired } from '@/lib/auth.config'
import type { PortalUser } from './permissions'
import { loadPortalUser } from './portal-user'

/**
 * The signed-in portal user with their class scope, loaded once per request.
 * Returns null when there is no portal session (website-admin sessions don't
 * count) or the account has been deactivated since the token was issued.
 */
export const getPortalUser = cache(async (): Promise<PortalUser | null> => {
  const session = await auth()
  const accountId = session?.user?.kind === 'portal' ? session.user.accountId : undefined
  if (!accountId) return null
  // F0047 — a child's session is capped from sign-in. Checked here as well as
  // in the middleware because server actions are not routed through it.
  if (portalSessionExpired(session?.user?.role, session?.user?.signedInAt)) return null

  return loadPortalUser({ id: accountId })
})

/** Use at the top of every portal page: redirects to sign-in when absent. */
export async function requirePortalUser(): Promise<PortalUser> {
  const user = await getPortalUser()
  if (!user) redirect('/portal/login')
  return user
}

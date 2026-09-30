import { auth } from '@/lib/auth'

/**
 * The signed-in website admin's session, or null for anyone else.
 *
 * Portal logins (servants and children) come from the same NextAuth as the
 * three website admins, and middleware.ts guards the /admin and /portal pages
 * but never /api. So a website-admin API route that only checks for *a*
 * session lets any portal account in, and until 2026-09-30 they all did. Every
 * such route calls this instead of auth(); ESLint enforces it in app/api, and
 * tests/site-admin-routes.test.ts tries each route with a child's login.
 */
export async function siteAdminSession() {
  const session = await auth()
  return session?.user?.kind === 'site' ? session : null
}

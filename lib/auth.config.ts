import type { NextAuthConfig } from 'next-auth'
import { PORTAL_LOGIN_PATH, safeNextPath } from './portal/login'

// Portal areas a student may never open. Prefixes are matched on a path
// boundary, so /portal/qr does not also block /portal/my-qr.
const STAFF_ONLY = [
  '/portal/classes',
  '/portal/exams',
  '/portal/lessons',
  '/portal/agenda',
  '/portal/assignments',
  '/portal/qr',
  '/portal/reports',
  '/portal/servant-attendance',
  '/portal/follow-ups',
  // F0279 — /portal/announcements is deliberately NOT here. A child is told
  // things in announcements, and both the sidebar row and the announcement
  // notification send them to this page; bouncing them off it made the
  // notification a dead end. The page is safe to open: listAnnouncements gives
  // a non-seesEverything viewer only church-wide notices, their own class and
  // their stage, and a student can never reach the composer (canCreate is
  // false for them). tests/portal/nav-reachability.test.ts holds this open.
  '/portal/curriculum',
  '/portal/my-stage',
  '/portal/help',
]

/** The activity log is the one /portal/admin area the pastor may browse freely. */
const PASTOR_READABLE_ADMIN = '/portal/admin/audit'

/**
 * Single /portal/admin pages the pastor may read, matched exactly — their
 * sub-pages stay admin-only.
 *
 * The prototype's pastor overview carried the full church-wide servant roster
 * (OG L15411-15426); the port has no servant list anywhere else, and this
 * middleware bounced PASTOR before the page's own check ever ran, so the
 * roster was unreachable for the one role whose job is oversight. The list
 * itself is read-only for them; /portal/admin/servants/<id> is an edit screen
 * and is deliberately NOT included, so the roster does not link into a 404.
 */
const PASTOR_READABLE_PAGES = ['/portal/admin/servants']

function startsWithPath(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

/**
 * F0047 — how long a sign-in lasts.
 *
 * The portal ran on a flat 24 hours, which fell on the one morning that
 * matters: a servant who signed in on Saturday evening to prepare met a login
 * screen on Sunday halfway through taking the register, and the ticks already
 * made were gone. The risk that bought back is a mislaid phone, and a mislaid
 * phone is behind a four-digit PIN either way.
 *
 * Children are the exception, and the reason is the device rather than the
 * person: a child signs in on a tablet the whole family uses, so their session
 * is capped from the moment they signed in and is not rolled forward.
 */
export const STAFF_SESSION_SECONDS = 30 * 24 * 60 * 60
export const STUDENT_SESSION_SECONDS = 12 * 60 * 60

/**
 * True when this is a child's session and the cap has passed. `signedInAt` is
 * absent on tokens issued before this shipped; those are treated as current
 * rather than thrown out, so nobody is signed out by the deploy itself.
 */
export function portalSessionExpired(
  role: string | undefined,
  signedInAt: number | undefined,
): boolean {
  if (role !== 'STUDENT' || typeof signedInAt !== 'number') return false
  return Date.now() - signedInAt > STUDENT_SESSION_SECONDS * 1000
}

// Edge-safe part of the auth setup: no Prisma, no bcrypt. The middleware
// imports this; the full config in lib/auth.ts adds the providers.
export const authConfig = {
  trustHost: true,
  providers: [],
  pages: {
    signIn: '/admin/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: STAFF_SESSION_SECONDS,
    // Rolling: anyone who opens the portal at least once a day is never asked
    // to sign in again. The cookie is re-issued at most daily so the common
    // case costs nothing.
    updateAge: 24 * 60 * 60,
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.kind = user.kind ?? 'site'
        token.role = user.role
        token.accountId = user.accountId
        // F0047 — when this sign-in happened, so a child's session can be
        // capped from the moment they signed in rather than rolled forward
        // with everyone else's. Stamped only on sign-in: a refresh of the
        // cookie must not extend a child's day.
        token.signedInAt = Date.now()
      }
      return token
    },
    session({ session, token }) {
      session.user.kind = token.kind ?? 'site'
      session.user.role = token.role
      session.user.accountId = token.accountId
      session.user.signedInAt = token.signedInAt
      return session
    },
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl
      const kind = auth?.user?.kind

      if (pathname.startsWith('/admin')) {
        if (pathname === '/admin/login') return true
        return kind === 'site'
      }

      if (pathname.startsWith('/portal')) {
        if (pathname === '/portal/login') return true
        // F0047 — a child past their cap is treated as signed out here, before
        // the page loads, so they meet the login screen rather than a page that
        // half-works.
        if (kind === 'portal' && portalSessionExpired(auth?.user?.role, auth?.user?.signedInAt)) {
          const next = safeNextPath(`${pathname}${request.nextUrl.search}`)
          const target = next ? `${PORTAL_LOGIN_PATH}?next=${encodeURIComponent(next)}` : PORTAL_LOGIN_PATH
          return Response.redirect(new URL(target, request.nextUrl))
        }
        if (kind !== 'portal') {
          // Carry the destination through sign-in. A child scanning the
          // projected group code while signed out was bounced here and the
          // path thrown away, so after signing in they landed on the dashboard
          // and the code — five-minute expiry — was already gone.
          const url = new URL(PORTAL_LOGIN_PATH, request.nextUrl)
          const next = safeNextPath(`${pathname}${request.nextUrl.search}`)
          if (next) url.searchParams.set('next', next)
          return Response.redirect(url)
        }

        // Staff-only areas are turned away at the edge. The pages guard
        // themselves too, but those guards run inside the streaming Suspense
        // boundary that loading.tsx opens, which forces a 200 and leaks the
        // page title into the tab. Deciding here keeps the status honest.
        const role = auth?.user?.role
        const bounce = () => Response.redirect(new URL('/portal', request.nextUrl))

        if (startsWithPath(pathname, '/portal/admin')) {
          if (role === 'ADMIN') return true
          if (role === 'PASTOR' && startsWithPath(pathname, PASTOR_READABLE_ADMIN)) return true
          if (role === 'PASTOR' && PASTOR_READABLE_PAGES.includes(pathname)) return true
          return bounce()
        }
        if (role === 'STUDENT' && STAFF_ONLY.some((p) => startsWithPath(pathname, p))) return bounce()
        return true
      }

      return true
    },
  },
} satisfies NextAuthConfig

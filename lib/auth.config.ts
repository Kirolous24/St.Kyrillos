import type { NextAuthConfig } from 'next-auth'

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
  '/portal/announcements',
  '/portal/curriculum',
  '/portal/my-stage',
  '/portal/help',
]

/** The activity log is the one /portal/admin page the pastor may also read. */
const PASTOR_READABLE_ADMIN = '/portal/admin/audit'

function startsWithPath(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
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
    maxAge: 24 * 60 * 60, // 24 hours
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.kind = user.kind ?? 'site'
        token.role = user.role
        token.accountId = user.accountId
      }
      return token
    },
    session({ session, token }) {
      session.user.kind = token.kind ?? 'site'
      session.user.role = token.role
      session.user.accountId = token.accountId
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
        if (kind !== 'portal') return Response.redirect(new URL('/portal/login', request.nextUrl))

        // Staff-only areas are turned away at the edge. The pages guard
        // themselves too, but those guards run inside the streaming Suspense
        // boundary that loading.tsx opens, which forces a 200 and leaks the
        // page title into the tab. Deciding here keeps the status honest.
        const role = auth?.user?.role
        const bounce = () => Response.redirect(new URL('/portal', request.nextUrl))

        if (startsWithPath(pathname, '/portal/admin')) {
          if (role === 'ADMIN') return true
          if (role === 'PASTOR' && startsWithPath(pathname, PASTOR_READABLE_ADMIN)) return true
          return bounce()
        }
        if (role === 'STUDENT' && STAFF_ONLY.some((p) => startsWithPath(pathname, p))) return bounce()
        return true
      }

      return true
    },
  },
} satisfies NextAuthConfig

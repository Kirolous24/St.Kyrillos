import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { authConfig } from './auth.config'
import { checkRateLimit } from './rate-limit'
import { prisma } from './prisma'
import { attemptLogin, LOGIN_ID_RE, PIN_RE } from './portal/login'
import { prismaLoginRepo } from './portal/login-repo'

const adminUsers = [
  {
    id: '1',
    username: process.env.ADMIN_USER_1_USERNAME,
    passwordHash: process.env.ADMIN_USER_1_PASSWORD_HASH,
    name: 'Kirolous',
  },
  {
    id: '2',
    username: process.env.ADMIN_USER_2_USERNAME,
    passwordHash: process.env.ADMIN_USER_2_PASSWORD_HASH,
    name: 'Fr. Pachom',
  },
  {
    id: '3',
    username: process.env.ADMIN_USER_3_USERNAME,
    passwordHash: process.env.ADMIN_USER_3_PASSWORD_HASH,
    name: 'T. Marcelle',
  },
]

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    // Website admin (schedule, templates). Users live in env vars.
    Credentials({
      id: 'credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const username = credentials?.username as string | undefined
        const password = credentials?.password as string | undefined

        if (!username || !password) return null

        // Rate limit by username to prevent brute force
        const rateCheck = checkRateLimit(username)
        if (!rateCheck.allowed) return null

        const user = adminUsers.find((u) => u.username === username)
        if (!user || !user.passwordHash) return null

        const isValid = await bcrypt.compare(password, user.passwordHash)
        if (!isValid) return null

        // Record last seen — fire and forget, don't block sign-in
        prisma.userLastSeen
          .upsert({
            where: { userName: user.name },
            update: { lastSeenAt: new Date() },
            create: { userName: user.name, lastSeenAt: new Date() },
          })
          .catch(() => {})

        return { id: `site:${user.id}`, name: user.name, kind: 'site' }
      },
    }),

    // Sunday School portal: 4-digit ID + PIN, accounts in Postgres,
    // hashed PINs and a server-side lockout (see lib/portal/login.ts).
    Credentials({
      id: 'portal',
      credentials: {
        loginId: { label: 'ID', type: 'text' },
        pin: { label: 'PIN', type: 'password' },
      },
      async authorize(credentials) {
        // Normalise once, here: attemptLogin trims too, so a limiter keyed on
        // the raw value would hand every whitespace padding its own bucket.
        const loginId = String(credentials?.loginId ?? '').trim()
        const pin = String(credentials?.pin ?? '').trim()
        if (!LOGIN_ID_RE.test(loginId) || !PIN_RE.test(pin)) return null

        const rateCheck = checkRateLimit(`portal:${loginId}`)
        if (!rateCheck.allowed) return null

        const result = await attemptLogin(
          prismaLoginRepo,
          { loginId, pin },
          { verify: (p, hash) => bcrypt.compare(p, hash) },
        )
        if (!result.ok) return null

        return {
          id: result.account.id,
          name: result.account.displayName,
          kind: 'portal',
          role: result.account.role,
          accountId: result.account.id,
        }
      },
    }),
  ],
})

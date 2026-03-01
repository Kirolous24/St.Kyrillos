import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { checkRateLimit } from './rate-limit'

const adminUsers = [
  {
    id: '1',
    username: process.env.ADMIN_USER_1_USERNAME,
    passwordHash: process.env.ADMIN_USER_1_PASSWORD_HASH,
    name: 'Admin 1',
  },
  {
    id: '2',
    username: process.env.ADMIN_USER_2_USERNAME,
    passwordHash: process.env.ADMIN_USER_2_PASSWORD_HASH,
    name: 'Admin 2',
  },
]

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
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

        return { id: user.id, name: user.name }
      },
    }),
  ],
  pages: {
    signIn: '/admin/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  callbacks: {
    authorized({ auth, request }) {
      const isAdminRoute = request.nextUrl.pathname.startsWith('/admin')
      const isLoginPage = request.nextUrl.pathname === '/admin/login'

      if (isAdminRoute && !isLoginPage && !auth) return false
      return true
    },
  },
})

import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth.config'

// Runs on the Edge: only the DB-free config is loaded here.
export const { auth: middleware } = NextAuth(authConfig)

export const config = {
  matcher: ['/admin/:path*', '/portal/:path*'],
}

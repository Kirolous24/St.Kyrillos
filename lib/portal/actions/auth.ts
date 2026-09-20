'use server'

import { signOut } from '@/lib/auth'

export async function signOutPortal() {
  await signOut({ redirectTo: '/portal/login' })
}

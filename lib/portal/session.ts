import { cache } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { PortalUser } from './permissions'

/**
 * The signed-in portal user with their class scope, loaded once per request.
 * Returns null when there is no portal session (website-admin sessions don't
 * count) or the account has been deactivated since the token was issued.
 */
export const getPortalUser = cache(async (): Promise<PortalUser | null> => {
  const session = await auth()
  const accountId = session?.user?.kind === 'portal' ? session.user.accountId : undefined
  if (!accountId) return null

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: {
      id: true,
      role: true,
      displayName: true,
      isActive: true,
      student: { select: { id: true, classId: true } },
      servant: {
        select: {
          id: true,
          stageOversight: true,
          classes: { select: { classId: true, title: true } },
        },
      },
    },
  })
  if (!account || !account.isActive) return null

  const classIds = account.servant
    ? account.servant.classes.map((c) => c.classId)
    : account.student?.classId
      ? [account.student.classId]
      : []

  return {
    accountId: account.id,
    role: account.role,
    displayName: account.displayName,
    servantId: account.servant?.id,
    studentId: account.student?.id,
    classIds,
    coordinatorOf: account.servant
      ? account.servant.classes.filter((c) => c.title === 'COORDINATOR').map((c) => c.classId)
      : [],
    stageOversight: account.servant?.stageOversight ?? null,
  }
})

/** Use at the top of every portal page: redirects to sign-in when absent. */
export async function requirePortalUser(): Promise<PortalUser> {
  const user = await getPortalUser()
  if (!user) redirect('/portal/login')
  return user
}

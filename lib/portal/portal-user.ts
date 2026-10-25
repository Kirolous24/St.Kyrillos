import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { PortalUser } from './permissions'

/**
 * An account with its class scope, or null when it is missing or deactivated.
 * The signed-in user is built here (lib/portal/session.ts), and so is the owner
 * of a birthday calendar link, which a calendar app opens without signing in:
 * both must see exactly the same classes.
 */
export async function loadPortalUser(where: Prisma.AccountWhereUniqueInput): Promise<PortalUser | null> {
  const account = await prisma.account.findUnique({
    where,
    select: {
      id: true,
      role: true,
      displayName: true,
      photo: true,
      isActive: true,
      student: { select: { id: true, classId: true } },
      servant: {
        select: {
          id: true,
          stageOversight: true,
          classes: { select: { classId: true, title: true, class: { select: { stage: true } } } },
        },
      },
    },
  })
  if (!account || !account.isActive) return null
  // A Fellowship member who does not serve (2026-10-24) has an account only so
  // their attendance has somewhere to live. It is never a portal user.
  if (account.role === 'MEMBER') return null

  const classIds = account.servant
    ? account.servant.classes.map((c) => c.classId)
    : account.student?.classId
      ? [account.student.classId]
      : []

  return {
    accountId: account.id,
    role: account.role,
    displayName: account.displayName,
    photo: account.photo,
    servantId: account.servant?.id,
    // F0850 — a servant who grew up here keeps their Student row so their years
    // as a child stay readable, but they are not a child any more: the
    // child-only pages (their own badges, their own QR card) key off this, and
    // a servant holding a student QR could scan themselves points.
    studentId: account.role === 'STUDENT' ? account.student?.id : undefined,
    classIds,
    coordinatorOf: account.servant
      ? account.servant.classes.filter((c) => c.title === 'COORDINATOR').map((c) => c.classId)
      : [],
    assistantOf: account.servant
      ? account.servant.classes.filter((c) => c.title === 'ASSISTANT_COORDINATOR').map((c) => c.classId)
      : [],
    stageOversight: account.servant?.stageOversight ?? null,
    // The meetings they serve (2026-10-24); the menu and the dashboard read it.
    fellowshipClassIds: account.servant
      ? account.servant.classes.filter((c) => c.class?.stage === 'FELLOWSHIP').map((c) => c.classId)
      : [],
  }
}

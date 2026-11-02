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
          classes: {
            select: {
              classId: true,
              title: true,
              // Its attendance partner, stored either way (2026-10-25).
              class: { select: { stage: true, attendancePartnerId: true, attendancePartnerOf: { select: { id: true } } } },
            },
          },
        },
      },
    },
  })
  if (!account || !account.isActive) return null
  // A Fellowship member who does not serve (2026-10-24) has an account only so
  // their attendance has somewhere to live. It is never a portal user.
  if (account.role === 'MEMBER') return null

  const own = account.servant
    ? account.servant.classes.map((c) => c.classId)
    : account.student?.classId
      ? [account.student.classId]
      : []
  // "Coords and asst coords have FULL accessibility" to the other class of
  // their 5th & 6th or 7th & 8th pair (2026-11-01): it counts as one of their
  // classes, with the title they hold in theirs. Where they already serve it,
  // their title there stands. Plain servants get its register only (below).
  const titled = (title: 'COORDINATOR' | 'ASSISTANT_COORDINATOR') => {
    const held = account.servant ? account.servant.classes.filter((c) => c.title === title) : []
    return { held: held.map((c) => c.classId), partners: attendancePartners(held, own) }
  }
  const coordinator = titled('COORDINATOR')
  const assistant = titled('ASSISTANT_COORDINATOR')
  const classIds = Array.from(new Set([...own, ...coordinator.partners, ...assistant.partners]))

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
    coordinatorOf: [...coordinator.held, ...coordinator.partners],
    assistantOf: [...assistant.held, ...assistant.partners],
    stageOversight: account.servant?.stageOversight ?? null,
    // The meetings they serve (2026-10-24); the menu and the dashboard read it.
    fellowshipClassIds: account.servant
      ? account.servant.classes.filter((c) => c.class?.stage === 'FELLOWSHIP').map((c) => c.classId)
      : [],
    // The registers they may also take: their classes' partners that are not
    // already theirs (2026-10-25).
    attendanceOnly: account.servant ? attendancePartners(account.servant.classes, classIds) : [],
  }
}

function attendancePartners(
  classes: ReadonlyArray<{ class?: { attendancePartnerId: string | null; attendancePartnerOf: Array<{ id: string }> } | null }>,
  own: readonly string[],
): string[] {
  const out: string[] = []
  for (const c of classes) {
    for (const id of [c.class?.attendancePartnerId, ...(c.class?.attendancePartnerOf ?? []).map((p) => p.id)]) {
      if (id && !own.includes(id) && !out.includes(id)) out.push(id)
    }
  }
  return out
}

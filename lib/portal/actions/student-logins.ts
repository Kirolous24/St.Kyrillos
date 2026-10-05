'use server'

import { prisma } from '@/lib/prisma'
import { clearRateLimit } from '@/lib/rate-limit'
import { requirePortalUser } from '../session'
import { runAction, PortalError, type ActionResult } from '../action-result'
import { audit } from '../audit'
import { can, type PortalUser } from '../permissions'
import { pinVaultEnabled } from '../pin-vault'
import { issuedPinFields } from '../pin-issue'
import { randomPin } from '../credentials'
import { CONFIRM_PHRASE } from '../reports'
import { pinsOnFile } from '../data/logins'
import { studentName } from '../data/students'

/**
 * A child's ID and PIN for the people who look after them (2026-10-04): the
 * servants of the child's class, the stage overseer over it, and the admin.
 * They are exactly the people who could already reset that PIN
 * (student.write), so seeing it gives nobody a new power over the child's
 * account; it only spares a family a new PIN. A PIN a child chose themselves is
 * never on file (pin-issue.ts), and every view is written to the activity log.
 *
 * The admin's own login tools, which also reach servants' PINs, stay in
 * ./logins.ts and stay admin-only.
 */

/**
 * Every requested child, once each of them is in this person's reach; one that
 * is not refuses the whole request before any PIN is opened. A grown-up who
 * serves now keeps their Student row (F0850), and their PIN is a servant's, so
 * only children's accounts qualify.
 */
async function childrenInReach(user: PortalUser, studentIds: unknown) {
  if (user.role !== 'SERVANT' && user.role !== 'ADMIN') throw new PortalError('Only servants and the admin can see children’s logins.')
  const list = Array.isArray(studentIds) ? studentIds.filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length < 64) : []
  const ids = Array.from(new Set(list))
  if (ids.length === 0) throw new PortalError('Nobody was selected.')
  if (ids.length > 200) throw new PortalError('At most 200 at a time.')
  const kids = await prisma.student.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      classId: true,
      class: { select: { name: true, stage: true } },
      account: { select: { id: true, loginId: true, role: true } },
    },
  })
  if (kids.length !== ids.length) throw new PortalError('Student not found.')
  for (const k of kids) {
    const ctx = { classId: k.classId ?? undefined, classStage: k.class?.stage, studentId: k.id }
    if (k.account.role !== 'STUDENT' || !can(user, 'student.write', ctx)) {
      throw new PortalError('You can only see the logins of children in your classes.')
    }
  }
  return kids
}

/** Where a view or a reissue happened, for the activity log. */
function scopeOf(kids: Awaited<ReturnType<typeof childrenInReach>>) {
  const classes = Array.from(new Set(kids.map((k) => k.class?.name ?? 'No class')))
  const classIds = Array.from(new Set(kids.map((k) => k.classId)))
  return { label: classes.join(', '), classId: classIds.length === 1 ? classIds[0] ?? null : null }
}

/** The PINs on file for these children. A PIN not on file comes back null. */
export async function revealStudentLogins(
  studentIds: string[],
): Promise<ActionResult<{ enabled: boolean; rows: Array<{ studentId: string; accountId: string; loginId: string; pin: string | null }> }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const kids = await childrenInReach(user, studentIds)
    const pins = await pinsOnFile(kids.map((k) => k.account.id))
    const rows = kids.map((k) => ({ studentId: k.id, accountId: k.account.id, loginId: k.account.loginId, pin: pins.get(k.account.id) ?? null }))
    const shown = rows.filter((r) => r.pin).length
    if (kids.length === 1) {
      await audit(user, 'login.reveal', 'student', kids[0]!.id, `Viewed the PIN for ${studentName(kids[0]!)}`)
    } else {
      const where = scopeOf(kids)
      await audit(user, 'login.reveal', 'class', where.classId, `Viewed ${shown} PIN${shown === 1 ? '' : 's'} in ${where.label} (${kids.length} requested)`)
    }
    return { enabled: pinVaultEnabled(), rows }
  })
}

/**
 * New PINs for these children, kept on file, for the ones with none on file
 * (a PIN they chose themselves, or one from before the vault). It stops the
 * PIN they use now, so it takes the typed phrase, and it clears lockouts like
 * every reset.
 */
export async function reissueStudentPins(
  studentIds: string[],
  confirm: string,
): Promise<ActionResult<{ rows: Array<{ studentId: string; accountId: string; loginId: string; pin: string }> }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    if ((confirm ?? '').trim() !== CONFIRM_PHRASE.reissuePins) throw new PortalError(`Type ${CONFIRM_PHRASE.reissuePins} to confirm.`)
    const kids = await childrenInReach(user, studentIds)
    const pins = kids.map(() => randomPin())
    const fields = await Promise.all(kids.map((k, i) => issuedPinFields(pins[i]!, k.account.loginId)))
    await prisma.$transaction(
      kids.map((k, i) => prisma.account.update({ where: { id: k.account.id }, data: { ...fields[i]!, failedAttempts: 0, lockedUntil: null } })),
    )
    // Same reason as resetStudentPin: the in-process limiter is read before the PIN.
    for (const k of kids) clearRateLimit(`portal:${k.account.loginId}`)
    const where = scopeOf(kids)
    const named = kids.slice(0, 20).map(studentName).join(', ')
    await audit(
      user,
      'login.reissue',
      kids.length === 1 ? 'student' : 'class',
      kids.length === 1 ? kids[0]!.id : where.classId,
      `Issued new PINs in ${where.label} to ${kids.length}: ${named}${kids.length > 20 ? `, and ${kids.length - 20} more` : ''}`,
    )
    return { rows: kids.map((k, i) => ({ studentId: k.id, accountId: k.account.id, loginId: k.account.loginId, pin: pins[i]! })) }
  })
}

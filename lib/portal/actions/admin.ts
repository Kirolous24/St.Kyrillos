'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '../session'
import { runAction, PortalError, type ActionResult } from '../action-result'
import { parseDateOnly, toUTCDate } from '../dates'
import { normalizePhone } from '../phones'
import { audit } from '../audit'
import { CONFIRM_PHRASE } from '../reports'
import { DAY_NAMES } from '../dates'
import { STANDARD_GRADES, pickNewGradeClasses, gradeSlug } from '../standard-grades'
import { freeLoginId, randomPin } from '../credentials'
import type { PortalUser } from '../permissions'
import { clearRateLimit } from '@/lib/rate-limit'
import { isStandardSession, standardSessionLabel } from '../sessions'

async function requireAdmin(): Promise<PortalUser> {
  const user = await requirePortalUser()
  if (user.role !== 'ADMIN') throw new PortalError('Only the Sunday School admin can do that.')
  return user
}

// ── Servants / staff ──────────────────────────────────────────────────────

// Not exported: Next.js requires every export of a "use server" module to be an
// async function, and a Zod object throws at action-invocation time. The
// inferred type below is erased at compile time, so exporting it is fine.
const ServantFormSchema = z.object({
  displayName: z.string().trim().min(1, 'Name is required').max(80),
  role: z.enum(['SERVANT', 'ADMIN', 'PASTOR']),
  email: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(30).optional(),
  birthday: z.string().trim().optional(),
  address: z.string().trim().max(200).optional(),
  stageOversight: z.enum(['', 'ELEMENTARY', 'MIDDLE_SCHOOL', 'HIGH_SCHOOL']).optional(),
  classes: z.array(z.object({ classId: z.string().min(1), title: z.enum(['', 'COORDINATOR', 'ASSISTANT_COORDINATOR']) })).max(20),
  isActive: z.boolean().optional(),
})

export type ServantFormInput = z.infer<typeof ServantFormSchema>

function servantData(input: ServantFormInput) {
  const birthday = input.birthday ? parseDateOnly(input.birthday) : null
  if (input.birthday && !birthday) throw new PortalError('Birthday is not a valid date.')
  const email = input.email?.toLowerCase() || null
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new PortalError('Email address is not valid.')
  return {
    account: { displayName: input.displayName, email, phone: normalizePhone(input.phone), isActive: input.isActive ?? true },
    servant: { birthday: birthday ? toUTCDate(birthday) : null, address: input.address || null, stageOversight: input.stageOversight || null },
  }
}

export async function createServant(raw: ServantFormInput): Promise<ActionResult<{ accountId: string; loginId: string; pin: string }>> {
  return runAction(async () => {
    const user = await requireAdmin()
    const input = ServantFormSchema.parse(raw)
    const data = servantData(input)
    const loginId = await freeLoginId()
    const pin = randomPin()
    const account = await prisma.account.create({
      data: {
        loginId,
        pinHash: await bcrypt.hash(pin, 10),
        role: input.role,
        ...data.account,
        servant: input.role === 'SERVANT' || input.role === 'PASTOR' || input.role === 'ADMIN'
          ? { create: { ...data.servant, classes: { create: input.classes.map((c, i) => ({ classId: c.classId, title: c.title || null, sortOrder: i })) } } }
          : undefined,
      },
      select: { id: true },
    })
    await audit(user, 'servant.create', 'account', account.id, `Added ${input.role.toLowerCase()} ${input.displayName} (ID ${loginId})`)
    revalidatePath('/portal/admin/servants')
    revalidatePath('/portal/classes')
    return { accountId: account.id, loginId, pin }
  })
}

export async function updateServant(accountId: string, raw: ServantFormInput): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireAdmin()
    const input = ServantFormSchema.parse(raw)
    const data = servantData(input)
    const existing = await prisma.account.findUnique({ where: { id: accountId }, select: { id: true, role: true, servant: { select: { id: true } } } })
    if (!existing || existing.role === 'STUDENT') throw new PortalError('Account not found.')
    if (existing.id === user.accountId && (input.role !== 'ADMIN' || input.isActive === false)) {
      throw new PortalError('You cannot remove your own admin access.')
    }
    await prisma.$transaction(async (tx) => {
      await tx.account.update({ where: { id: accountId }, data: { role: input.role, ...data.account } })
      const servant = existing.servant
        ? await tx.servant.update({ where: { id: existing.servant.id }, data: data.servant, select: { id: true } })
        : await tx.servant.create({ data: { accountId, ...data.servant }, select: { id: true } })
      await tx.classServant.deleteMany({ where: { servantId: servant.id } })
      if (input.classes.length) {
        await tx.classServant.createMany({ data: input.classes.map((c, i) => ({ servantId: servant.id, classId: c.classId, title: c.title || null, sortOrder: i })) })
      }
    })
    await audit(user, 'servant.update', 'account', accountId, `Updated ${input.displayName}`)
    revalidatePath('/portal/admin/servants')
    revalidatePath(`/portal/admin/servants/${accountId}`)
    revalidatePath('/portal/classes')
    return undefined
  })
}

export async function resetServantPin(accountId: string): Promise<ActionResult<{ loginId: string; pin: string }>> {
  return runAction(async () => {
    const user = await requireAdmin()
    const acc = await prisma.account.findUnique({ where: { id: accountId }, select: { role: true, displayName: true } })
    if (!acc || acc.role === 'STUDENT') throw new PortalError('Account not found.')
    const pin = randomPin()
    const updated = await prisma.account.update({ where: { id: accountId }, data: { pinHash: await bcrypt.hash(pin, 10), failedAttempts: 0, lockedUntil: null }, select: { loginId: true } })
    // Clearing the DB lockout is not enough: the in-process limiter is consulted
    // before the PIN is ever checked, so a locked-out servant could not reach the
    // success path that releases it. Without this, a reset cannot get them back
    // in for a further 15 minutes.
    clearRateLimit(`portal:${updated.loginId}`)
    await audit(user, 'servant.resetPin', 'account', accountId, `Reset PIN for ${acc.displayName}`)
    return { loginId: updated.loginId, pin }
  })
}

export async function deleteServant(accountId: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireAdmin()
    if (accountId === user.accountId) throw new PortalError('You cannot delete your own account.')
    const acc = await prisma.account.findUnique({ where: { id: accountId }, select: { role: true, displayName: true } })
    if (!acc || acc.role === 'STUDENT') throw new PortalError('Account not found.')
    await prisma.account.delete({ where: { id: accountId } })
    await audit(user, 'servant.delete', 'account', accountId, `Deleted ${acc.displayName}`)
    revalidatePath('/portal/admin/servants')
    revalidatePath('/portal/classes')
    return undefined
  })
}

// ── Classes ───────────────────────────────────────────────────────────────

const ClassSchema = z.object({
  name: z.string().trim().min(1).max(60),
  stage: z.enum(['ELEMENTARY', 'MIDDLE_SCHOOL', 'HIGH_SCHOOL']),
  visitationThreshold: z.number().int().min(1).max(10),
  description: z.string().trim().max(300).optional(),
})

export type ClassInput = z.infer<typeof ClassSchema>

export async function createClass(raw: ClassInput): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireAdmin()
    const input = ClassSchema.parse(raw)
    const base = input.name.toLowerCase().replace(/&/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'class'
    let id = base
    for (let i = 2; await prisma.schoolClass.findUnique({ where: { id }, select: { id: true } }); i++) id = `${base}-${i}`
    const max = await prisma.schoolClass.aggregate({ _max: { sortOrder: true } })
    await prisma.schoolClass.create({ data: { id, name: input.name, stage: input.stage, visitationThreshold: input.visitationThreshold, description: input.description || null, sortOrder: (max._max.sortOrder ?? 0) + 1 } })
    await audit(user, 'class.create', 'class', id, input.name)
    revalidatePath('/portal/admin/classes')
    revalidatePath('/portal/classes')
    return { id }
  })
}

/**
 * Create the fourteen standard grade classes in one go (OG L3516-3541), adding
 * only the ones that are missing so a second press does nothing.
 *
 * Deduping is on name *or* slug: ids are bare slug primary keys and names are
 * editable, so a class renamed after import still holds its old slug. Matching
 * on name alone would pass the check and then violate the primary key, and one
 * collision inside the transaction would roll back all fourteen behind a
 * generic error.
 */
export async function createStandardGradeClasses(): Promise<ActionResult<{ added: number; skipped: number }>> {
  return runAction(async () => {
    const user = await requireAdmin()
    const existing = await prisma.schoolClass.findMany({ select: { id: true, name: true } })
    const missing = pickNewGradeClasses(existing)
    if (missing.length === 0) {
      return { added: 0, skipped: STANDARD_GRADES.length }
    }
    const max = await prisma.schoolClass.aggregate({ _max: { sortOrder: true } })
    const base = max._max.sortOrder ?? 0
    await prisma.schoolClass.createMany({
      data: missing.map((g, i) => ({
        id: gradeSlug(g.name),
        name: g.name,
        stage: g.stage,
        visitationThreshold: 1,
        sortOrder: base + i + 1,
      })),
    })
    await audit(user, 'class.bulkSeed', 'portal', null, `Added ${missing.length} standard grade class${missing.length === 1 ? '' : 'es'}`)
    revalidatePath('/portal/admin/classes')
    revalidatePath('/portal/classes')
    revalidatePath('/portal')
    return { added: missing.length, skipped: STANDARD_GRADES.length - missing.length }
  })
}

export interface ClassCredential {
  studentId: string
  name: string
  loginId: string
  pin: string
}

/**
 * Reset every student's PIN in one class and return the new ones, once.
 *
 * The prototype exported a plaintext PIN column (OG "Export All IDs & PINs"),
 * which is one of the four defects this restoration deliberately does not copy
 * — PINs are bcrypt hashes here, so no export can ever read them back. The
 * church's own answer to "how do we hand a class their logins" is this: mint a
 * fresh PIN for everyone, show it once, print it, and never store it readable.
 *
 * It invalidates the PINs currently in use, so it takes the same typed
 * confirmation the Danger Zone uses, and it is admin-only: one careless press
 * locks a whole class out of their accounts until the sheet is handed round.
 */
export async function resetClassPins(
  classId: string,
  confirm: string,
): Promise<ActionResult<{ className: string; rows: ClassCredential[] }>> {
  return runAction(async () => {
    const user = await requireAdmin()
    if (confirm.trim() !== CONFIRM_PHRASE.resetClassPins) {
      throw new PortalError(`Type ${CONFIRM_PHRASE.resetClassPins} to confirm.`)
    }
    const cls = await prisma.schoolClass.findUnique({ where: { id: classId }, select: { id: true, name: true } })
    if (!cls) throw new PortalError('Class not found.')

    const students = await prisma.student.findMany({
      where: { classId: cls.id },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      select: { id: true, firstName: true, lastName: true, accountId: true, account: { select: { loginId: true } } },
    })
    if (students.length === 0) throw new PortalError(`${cls.name} has no students.`)

    // Hash every PIN first: bcrypt is CPU-bound and gains nothing from being
    // awaited one student at a time, which is what made a big class crawl.
    const pins = students.map(() => randomPin())
    const hashes = await Promise.all(pins.map((pin) => bcrypt.hash(pin, 10)))

    await prisma.$transaction(
      students.map((s, i) =>
        prisma.account.update({
          where: { id: s.accountId },
          data: { pinHash: hashes[i]!, failedAttempts: 0, lockedUntil: null },
        }),
      ),
    )

    // Same reason as resetServantPin: the in-process limiter is read before the
    // PIN is, so without this a child who had locked themselves out cannot use
    // the PIN on the freshly printed sheet until the window has passed.
    for (const s of students) clearRateLimit(`portal:${s.account.loginId}`)

    await audit(user, 'class.resetPins', 'class', cls.id, `${cls.name}: reset ${students.length} student PIN${students.length === 1 ? '' : 's'}`)
    return {
      className: cls.name,
      rows: students.map((s, i) => ({
        studentId: s.id,
        name: `${s.firstName} ${s.lastName}`.trim(),
        loginId: s.account.loginId,
        pin: pins[i]!,
      })),
    }
  })
}

/**
 * Point one class's curriculum at another, or clear the link.
 *
 * `SchoolClass.curriculumLinkedToId` came across in the import and then sat
 * unread by anything — the prototype used it to let a class permanently follow
 * another's plan (two halves of one grade taught the same material, say).
 *
 * Admin-only by the church's decision: linking changes what a whole class is
 * taught, and a servant doing it to a colleague's class would be hard to spot.
 * A direct cycle is refused, because the agenda follows the link one hop and a
 * pair pointing at each other has no source of truth.
 */
export async function setCurriculumLink(classId: string, linkedToId: string | null): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireAdmin()
    const cls = await prisma.schoolClass.findUnique({ where: { id: classId }, select: { id: true, name: true } })
    if (!cls) throw new PortalError('Class not found.')

    const target = (linkedToId ?? '').trim() || null
    if (target === cls.id) throw new PortalError('A class cannot follow its own curriculum.')

    let targetName: string | null = null
    if (target) {
      const other = await prisma.schoolClass.findUnique({
        where: { id: target },
        select: { id: true, name: true, curriculumLinkedToId: true },
      })
      if (!other) throw new PortalError('That class does not exist.')
      if (other.curriculumLinkedToId === cls.id) {
        throw new PortalError(`${other.name} already follows ${cls.name}, so linking them both ways would leave no source.`)
      }
      targetName = other.name
    }

    await prisma.schoolClass.update({ where: { id: cls.id }, data: { curriculumLinkedToId: target } })
    await audit(
      user,
      'class.curriculumLink',
      'class',
      cls.id,
      target ? `${cls.name} now follows ${targetName}` : `${cls.name} no longer follows another class`,
    )
    revalidatePath('/portal/admin/classes')
    revalidatePath('/portal/agenda')
    revalidatePath('/portal/lessons')
    return undefined
  })
}

export async function updateClass(id: string, raw: ClassInput & { isActive?: boolean; sortOrder?: number }): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireAdmin()
    const input = ClassSchema.parse(raw)
    await prisma.schoolClass.update({
      where: { id },
      data: {
        name: input.name, stage: input.stage, visitationThreshold: input.visitationThreshold, description: input.description || null,
        ...(typeof raw.isActive === 'boolean' ? { isActive: raw.isActive } : {}),
        ...(typeof raw.sortOrder === 'number' ? { sortOrder: raw.sortOrder } : {}),
      },
    })
    await audit(user, 'class.update', 'class', id, input.name)
    revalidatePath('/portal/admin/classes')
    revalidatePath('/portal/classes')
    revalidatePath(`/portal/classes/${id}`)
    return undefined
  })
}

export async function deleteClass(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireAdmin()
    const cls = await prisma.schoolClass.findUnique({
      where: { id },
      select: { name: true, _count: { select: { students: true, attendance: true, exams: true, points: true, followUps: true } } },
    })
    if (!cls) throw new PortalError('Class not found.')
    if (cls._count.students > 0) throw new PortalError('Move the students out of this class before deleting it.')
    // Emptying the roster does not empty the history: attendance, exams and
    // their quiz results cascade away with the class, and the points that
    // describe them are left pointing at nothing. Hide the class instead.
    const history = [
      cls._count.attendance > 0 ? `${cls._count.attendance} attendance records` : null,
      cls._count.exams > 0 ? `${cls._count.exams} exams` : null,
      cls._count.points > 0 ? `${cls._count.points} point entries` : null,
      cls._count.followUps > 0 ? `${cls._count.followUps} follow-up cases` : null,
    ].filter(Boolean)
    if (history.length > 0) {
      throw new PortalError(
        `This class still holds ${history.join(', ')} from students who have moved on. Hide it instead of deleting it so their history survives.`,
      )
    }
    await prisma.schoolClass.delete({ where: { id } })
    await audit(user, 'class.delete', 'class', id, cls.name)
    revalidatePath('/portal/admin/classes')
    revalidatePath('/portal/classes')
    return undefined
  })
}

// ── Attendance sessions ───────────────────────────────────────────────────

const SessionSchema = z.object({
  key: z.string().trim().min(1).max(30).regex(/^[a-z0-9-]+$/, 'Key must be lowercase letters, digits or dashes'),
  label: z.string().trim().min(1).max(40),
  points: z.number().int().min(0).max(100),
  isActive: z.boolean(),
  /**
   * F0190 / F0845 — `AttendanceSession.icon` has existed in the schema since the
   * table was added and nothing ever wrote or read it, so every session drew the
   * same generic tile and a servant scanning the list told them apart by reading
   * each label. One glyph, so a long emoji paste cannot break the row.
   *
   * Both of the deferred halves of this are now settled: F0845 locks the six
   * standard sessions against renaming (see lib/portal/sessions.ts), and F0670
   * allows deleting an admin-added session only while nothing has ever been
   * marked against it — see `deleteSession` below.
   */
  icon: z.string().trim().max(4).nullish(),
})

const ServantActivitySchema = z.object({
  key: z.string().trim().min(1).max(64),
  label: z.string().trim().min(1).max(40),
  dayOfWeek: z.number().int().min(0).max(6),
  isActive: z.boolean(),
})

/**
 * Edit a weekly servant activity — its name, the day it falls on, whether it
 * still runs.
 *
 * `ServantActivity.dayOfWeek` has been in the schema and read by the reports
 * since the port, but nothing could change it: if the servants' meeting moved
 * from Friday to Saturday there was no screen for it. The prototype had an
 * "Edit Activity Days" modal.
 *
 * `update`, not `upsert`: a typo in the key should fail loudly rather than mint
 * a phantom activity that then shows up in everyone's grid.
 */
export async function saveServantActivity(raw: z.infer<typeof ServantActivitySchema>): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireAdmin()
    const input = ServantActivitySchema.parse(raw)
    const existing = await prisma.servantActivity.findUnique({ where: { key: input.key }, select: { key: true } })
    if (!existing) throw new PortalError('That servant activity no longer exists.')
    await prisma.servantActivity.update({
      where: { key: input.key },
      data: { label: input.label, dayOfWeek: input.dayOfWeek, isActive: input.isActive },
    })
    await audit(user, 'servantActivity.save', 'servantActivity', input.key, `${input.label} on ${DAY_NAMES[input.dayOfWeek] ?? input.dayOfWeek}${input.isActive ? '' : ' (off)'}`)
    revalidatePath('/portal/admin/sessions')
    revalidatePath('/portal/servant-attendance')
    revalidatePath('/portal/servant-attendance/report')
    revalidatePath('/portal/my-attendance')
    return undefined
  })
}

export async function saveSession(raw: z.infer<typeof SessionSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireAdmin()
    const input = SessionSchema.parse(raw)
    // F0845 — the six standard names are fixed. Points, icon and whether the
    // session still runs stay editable; the label does not, because 'sunday' is
    // read by name in the follow-up rules, the class stat cards and the QR
    // check-in, and a renamed session leaves all three measuring something the
    // label no longer describes.
    const locked = standardSessionLabel(input.key)
    if (locked && input.label !== locked) {
      throw new PortalError(
        `"${locked}" is one of the church's standard sessions and cannot be renamed. You can change its points, its icon, or switch it off.`,
      )
    }
    const count = await prisma.attendanceSession.count()
    await prisma.attendanceSession.upsert({
      where: { key: input.key },
      create: {
        key: input.key,
        label: input.label,
        points: input.points,
        isActive: input.isActive,
        icon: input.icon || null,
        sortOrder: count,
      },
      update: { label: input.label, points: input.points, isActive: input.isActive, icon: input.icon || null },
    })
    await audit(user, 'session.save', 'session', input.key, `${input.label} = ${input.points} pts${input.isActive ? '' : ' (off)'}`)
    revalidatePath('/portal/admin/sessions')
    return undefined
  })
}

/**
 * F0670 — remove a session added by mistake.
 *
 * The complaint was a typo an admin could not take back: switching a session off
 * leaves it on the list forever. What it must never become is a way to delete
 * attendance, so the rule is the same one deleting a class already follows —
 * allowed only while the session is genuinely unused. The moment a single mark
 * exists against it, that session is part of children's history and the answer
 * is to switch it off instead.
 *
 * The six standard sessions are never deletable, whatever their marks say.
 */
export async function deleteSession(key: string): Promise<ActionResult<{ key: string }>> {
  return runAction(async () => {
    const user = await requireAdmin()
    const session = await prisma.attendanceSession.findUnique({
      where: { key },
      select: { key: true, label: true },
    })
    if (!session) throw new PortalError('That session no longer exists.')
    if (isStandardSession(session.key)) {
      throw new PortalError(
        `"${session.label}" is one of the church's standard sessions. Switch it off if it is not running this year.`,
      )
    }

    const marks = await prisma.attendanceRecord.count({ where: { sessionKey: session.key } })
    if (marks > 0) {
      throw new PortalError(
        `"${session.label}" has ${marks} attendance mark${marks === 1 ? '' : 's'} recorded against it, so deleting it would delete children's history. Switch it off instead — it then disappears from the register but the marks already taken are kept.`,
      )
    }

    await prisma.attendanceSession.delete({ where: { key: session.key } })
    await audit(user, 'session.delete', 'session', session.key, `Deleted the unused session "${session.label}"`)
    revalidatePath('/portal/admin/sessions')
    return { key: session.key }
  })
}

'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '../session'
import { assertClassAction } from '../data/classes'
import { assertStudentWrite, studentName } from '../data/students'
import { runAction, PortalError, type ActionResult } from '../action-result'
import { audit } from '../audit'

// Photos are small data-URL thumbnails stored on the row itself (there is no
// object storage). The browser downscales to 256×256 and encodes JPEG before
// posting, but the browser is never trusted: everything below is re-checked
// here, because a hand-rolled request could post any string at all.

const MAX_CHARS = 120_000 // ~88 KB of base64; the client aims for under 60 KB.
const DATA_URL_RE = /^data:image\/(jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/

const PhotoSchema = z
  .string()
  .trim()
  .min(32, 'That image is empty.')
  .max(MAX_CHARS, 'That image is too large. Try a smaller photo.')
  .refine((v) => DATA_URL_RE.test(v), 'Only JPEG or PNG images can be used.')

function validatePhoto(raw: string): string {
  const parsed = PhotoSchema.safeParse(raw)
  if (!parsed.success) {
    throw new PortalError(parsed.error.issues[0]?.message ?? 'That image could not be used.')
  }
  return parsed.data
}

/** The signed-in person's own photo. */
export async function setMyPhoto(dataUrl: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const photo = validatePhoto(dataUrl)
    await prisma.account.update({ where: { id: user.accountId }, data: { photo } })
    await audit(user, 'photo.setOwn', 'account', user.accountId, 'Updated their own photo')
    revalidatePath('/portal/photo')
    revalidatePath('/portal')
    return undefined
  })
}

export async function removeMyPhoto(): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePortalUser()
    await prisma.account.update({ where: { id: user.accountId }, data: { photo: null } })
    await audit(user, 'photo.removeOwn', 'account', user.accountId, 'Removed their own photo')
    revalidatePath('/portal/photo')
    revalidatePath('/portal')
    return undefined
  })
}

/** A servant sets a photo for a student in a class they serve. */
export async function setStudentPhoto(studentId: string, dataUrl: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const student = await assertStudentWrite(user, studentId)
    const photo = validatePhoto(dataUrl)
    const target = await prisma.student.findUnique({ where: { id: studentId }, select: { accountId: true } })
    if (!target) throw new PortalError('Student not found.')
    await prisma.account.update({ where: { id: target.accountId }, data: { photo } })
    await audit(user, 'photo.setStudent', 'student', studentId, `Updated the photo for ${studentName(student)}`)
    revalidatePath(`/portal/students/${studentId}`)
    if (student.classId) revalidatePath(`/portal/classes/${student.classId}`)
    return undefined
  })
}

export async function removeStudentPhoto(studentId: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const student = await assertStudentWrite(user, studentId)
    const target = await prisma.student.findUnique({ where: { id: studentId }, select: { accountId: true } })
    if (!target) throw new PortalError('Student not found.')
    await prisma.account.update({ where: { id: target.accountId }, data: { photo: null } })
    await audit(user, 'photo.removeStudent', 'student', studentId, `Removed the photo for ${studentName(student)}`)
    revalidatePath(`/portal/students/${studentId}`)
    return undefined
  })
}

/** The class's own photo, for a servant assigned to it. */
export async function setClassPhoto(classId: string, dataUrl: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const cls = await assertClassAction(user, classId, 'student.write')
    const photo = validatePhoto(dataUrl)
    await prisma.schoolClass.update({ where: { id: cls.id }, data: { photo } })
    await audit(user, 'photo.setClass', 'class', cls.id, `Updated the photo for ${cls.name}`)
    revalidatePath(`/portal/classes/${cls.id}`)
    revalidatePath('/portal/classes')
    return undefined
  })
}

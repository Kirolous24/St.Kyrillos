'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { randomInt } from 'node:crypto'
import { Prisma, PortalRole, type ClassTitle, type Stage } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '../session'
import { runAction, PortalError, type ActionResult } from '../action-result'
import { parseDateOnly, toUTCDate, formatDateOnly } from '../dates'
import { normalizePhone } from '../phones'
import { splitName, formatFullName } from '../names'
import { objectsToCsv, parseCsvRecords } from '../csv'
import { studentName } from '../data/students'
import { requireClassAccess } from '../data/classes'
import { audit } from '../audit'
import { randomPin } from '../credentials'
import type { PortalUser } from '../permissions'
import {
  studentImportColumns,
} from '../import-columns'
import {
  classifyStudentImportRow,
  classifyServantImportRow,
  type ExistingImportAccount,
} from '../import-classify'
import {
  CONFIRM_PHRASE,
  reportFilename,
  summariseImport,
  type BackupSummary,
  type BackupTableCount,
  type DangerResult,
  type ImportRowResult,
  type ImportSummary,
  type RepairResult,
} from '../reports'

// Admin-only data tools: the full backup, the student/servant CSV round trip,
// the data-repair utilities and the Danger Zone. Everything here is checked
// against the live role — never against what the page rendered.

async function requireAdmin(): Promise<PortalUser> {
  const user = await requirePortalUser()
  if (user.role !== 'ADMIN') throw new PortalError('Only the Sunday School admin can do that.')
  return user
}

const MAX_BACKUP_BYTES = 45_000_000
const MAX_IMPORT_ROWS = 1000

/* ── Full JSON backup ─────────────────────────────────────────────────────── */

/**
 * Every portal table, with a row count per table so an omission is visible.
 * The prototype's export silently skipped seven collections (ANALYSIS §6).
 * PIN hashes are never exported; photos only when asked for, because a few
 * hundred data-URL thumbnails dwarf everything else.
 */
export async function buildBackup(includePhotos = false): Promise<ActionResult<BackupSummary>> {
  return runAction(async () => {
    const user = await requireAdmin()

    const accounts = await prisma.account.findMany({
      orderBy: { loginId: 'asc' },
      select: {
        id: true,
        loginId: true,
        role: true,
        displayName: true,
        email: true,
        phone: true,
        isActive: true,
        lastLoginAt: true,
        legacyUid: true,
        createdAt: true,
        updatedAt: true,
        // pinHash is deliberately absent and must stay absent.
        ...(includePhotos ? { photo: true } : {}),
      },
    })
    const classes = await prisma.schoolClass.findMany({
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        stage: true,
        sortOrder: true,
        description: true,
        visitationThreshold: true,
        curriculumLinkedToId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        ...(includePhotos ? { photo: true } : {}),
      },
    })

    const [
      classServants, students, servants, attendanceSessions, attendanceRecords,
      pointActivities, pointEntries, followUpCases, followUpLogs,
      servantActivities, servantAttendance, auditLog,
      exams, examQuestions, quizResults, quizAnswers,
      lessons, agendaWeeks, agendaItems, hymns,
      feedPosts, feedReactions, announcements, events, eventClasses,
      bibleReadingLogs, achievements, qrTokens, qrRedemptions,
      notificationReads, settings,
    ] = await Promise.all([
      prisma.classServant.findMany(),
      prisma.student.findMany(),
      prisma.servant.findMany(),
      prisma.attendanceSession.findMany(),
      prisma.attendanceRecord.findMany(),
      prisma.pointActivity.findMany(),
      prisma.pointEntry.findMany(),
      prisma.followUpCase.findMany(),
      prisma.followUpLog.findMany(),
      prisma.servantActivity.findMany(),
      prisma.servantAttendance.findMany(),
      prisma.portalAuditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 20_000 }),
      prisma.exam.findMany(),
      prisma.examQuestion.findMany(),
      prisma.quizResult.findMany(),
      prisma.quizAnswer.findMany(),
      prisma.lesson.findMany(),
      prisma.agendaWeek.findMany(),
      prisma.agendaItem.findMany(),
      prisma.hymn.findMany(),
      prisma.feedPost.findMany(),
      prisma.feedReaction.findMany(),
      prisma.announcement.findMany(),
      prisma.portalEvent.findMany(),
      prisma.portalEventClass.findMany(),
      prisma.bibleReadingLog.findMany(),
      prisma.studentAchievement.findMany(),
      prisma.qrToken.findMany(),
      prisma.qrRedemption.findMany(),
      prisma.notificationRead.findMany(),
      prisma.portalSetting.findMany(),
    ])

    const tables: Record<string, unknown[]> = {
      accounts, classes, classServants, students, servants,
      attendanceSessions, attendanceRecords, pointActivities, pointEntries,
      followUpCases, followUpLogs, servantActivities, servantAttendance, auditLog,
      exams, examQuestions, quizResults, quizAnswers,
      lessons, agendaWeeks, agendaItems, hymns,
      feedPosts, feedReactions, announcements, events, eventClasses,
      bibleReadingLogs, achievements, qrTokens, qrRedemptions,
      notificationReads, settings,
    }

    const counts: BackupTableCount[] = Object.entries(tables).map(([table, rows]) => ({
      table,
      rows: rows.length,
    }))
    const totalRows = counts.reduce((n, c) => n + c.rows, 0)

    const json = JSON.stringify(
      {
        portal: 'st-kyrillos-sunday-school',
        version: 1,
        exportedAt: new Date().toISOString(),
        exportedBy: user.displayName,
        photosIncluded: includePhotos,
        note: 'PIN hashes are never exported.',
        counts: Object.fromEntries(counts.map((c) => [c.table, c.rows])),
        tables,
      },
      null,
      2,
    )
    const bytes = Buffer.byteLength(json, 'utf8')
    if (bytes > MAX_BACKUP_BYTES) {
      throw new PortalError(
        'The backup is too large to send in one piece. Try it without photos, or ask for a database dump instead.',
      )
    }

    await audit(user, 'data.backup', 'portal', null, `Exported ${counts.length} tables, ${totalRows} rows${includePhotos ? ' (with photos)' : ''}`)
    return {
      filename: reportFilename(['sunday-school-backup', formatDateOnly(new Date())], 'json'),
      json,
      tables: counts,
      totalRows,
      photosIncluded: includePhotos,
      bytes,
    }
  })
}

/* ── CSV export ───────────────────────────────────────────────────────────── */

const STUDENT_COLUMNS = [
  { key: 'id', label: 'ID' },
  { key: 'firstName', label: 'First name' },
  { key: 'lastName', label: 'Last name' },
  { key: 'classId', label: 'Class' },
  { key: 'className', label: 'Class name' },
  { key: 'grade', label: 'Grade' },
  { key: 'gender', label: 'Gender' },
  { key: 'dob', label: 'Date of birth' },
  { key: 'email', label: 'Student email' },
  { key: 'phone', label: 'Student phone' },
  { key: 'fatherName', label: 'Father name' },
  { key: 'fatherPhone', label: 'Father phone' },
  { key: 'motherName', label: 'Mother name' },
  { key: 'motherPhone', label: 'Mother phone' },
  { key: 'parentEmails', label: 'Parent emails' },
  { key: 'address', label: 'Address' },
  { key: 'notes', label: 'Notes' },
] as const

/**
 * A one-row starter sheet. The Help page has always told admins to "download
 * the template first so the columns line up" — there was no template, so the
 * instruction sent them looking for a control that did not exist. Headers are
 * STUDENT_COLUMNS verbatim, so a template filled in and re-imported round-trips
 * through exportStudentsCsv unchanged.
 *
 * F0057 — any servant may fetch it; only an admin may upload one. The September
 * rush is real, and a servant typing thirty new children in one at a time is the
 * half of the job worth handing over: this sheet holds no church data, so there
 * is nothing to leak and nothing to undo. Importing is the other half, and it
 * stays with the office — it creates accounts, sets PINs, and can move a child
 * out of somebody else's class, which is a church-wide act rather than a
 * class-level one.
 */
export async function studentImportTemplateCsv(): Promise<ActionResult<{ filename: string; csv: string }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    if (user.role === 'STUDENT') throw new PortalError('That is a servant\u2019s tool.')
    const example: Record<string, string> = {
      id: '',
      firstName: 'Mina',
      lastName: 'Gerges',
      classId: '',
      className: 'Grade 3',
      grade: '3rd',
      gender: 'male',
      dob: '2017-04-09',
      email: '',
      phone: '',
      fatherName: 'Gerges Samir',
      fatherPhone: '615-555-0147',
      motherName: 'Mariam Gerges',
      motherPhone: '615-555-0148',
      parentEmails: 'gerges@example.com; mariam@example.com',
      address: '123 Main St, Antioch TN',
      notes: 'Leave the ID blank for a new student — one is assigned on import.',
    }
    return {
      filename: 'students-import-template.csv',
      csv: objectsToCsv(STUDENT_COLUMNS, [example]),
    }
  })
}

/** Students as CSV. Never includes a PIN or a hash. */
export async function exportStudentsCsv(classId: string | null): Promise<ActionResult<{ filename: string; csv: string; rows: number }>> {
  return runAction(async () => {
    // The prototype put Export CSV straight on the servant's own Students page
    // — it was self-service. The port put it behind an admin-only route, so a
    // servant who wanted their own roster as a spreadsheet had no way to get
    // one. A servant may export a class they can read; everything else is still
    // admin-only.
    const user = classId ? await requirePortalUser() : await requireAdmin()
    if (classId && user.role !== 'ADMIN') await requireClassAccess(user, classId, 'student.read')
    const students = await prisma.student.findMany({
      where: classId ? { classId } : {},
      orderBy: [{ class: { sortOrder: 'asc' } }, { firstName: 'asc' }, { lastName: 'asc' }],
      select: {
        firstName: true, lastName: true, classId: true, grade: true, gender: true, dob: true,
        fatherName: true, fatherPhone: true, motherName: true, motherPhone: true,
        parentEmails: true, address: true, notes: true,
        class: { select: { name: true } },
        account: { select: { loginId: true, email: true, phone: true } },
      },
    })
    const rows = students.map((s) => ({
      id: s.account.loginId,
      firstName: s.firstName,
      lastName: s.lastName,
      classId: s.classId ?? '',
      className: s.class?.name ?? '',
      grade: s.grade ?? '',
      gender: s.gender ?? '',
      dob: s.dob ? formatDateOnly(s.dob) : '',
      email: s.account.email ?? '',
      phone: s.account.phone ?? '',
      fatherName: s.fatherName ?? '',
      fatherPhone: s.fatherPhone ?? '',
      motherName: s.motherName ?? '',
      motherPhone: s.motherPhone ?? '',
      parentEmails: s.parentEmails.join('; '),
      address: s.address ?? '',
      notes: s.notes ?? '',
    }))
    await audit(user, 'data.exportStudents', 'portal', classId, `Exported ${rows.length} students`)
    return {
      filename: reportFilename(['students', classId ?? 'all', formatDateOnly(new Date())], 'csv'),
      csv: objectsToCsv(STUDENT_COLUMNS, rows),
      rows: rows.length,
    }
  })
}

const SERVANT_COLUMNS = [
  { key: 'id', label: 'ID' },
  { key: 'name', label: 'Name' },
  { key: 'role', label: 'Role' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'birthday', label: 'Birthday' },
  { key: 'address', label: 'Address' },
  { key: 'stageOversight', label: 'Stage oversight' },
  { key: 'classes', label: 'Classes' },
  { key: 'titles', label: 'Titles' },
  { key: 'isActive', label: 'Active' },
] as const

/**
 * F0546 — the servant CSV template. Students had one; servants did not, so an
 * admin adding the year's servants in bulk had to guess the column names, and
 * the two that matter most are the two nobody guesses: `classes` takes class
 * names or ids separated by semicolons, and `titles` lines up positionally with
 * them. Getting that wrong silently reassigns who serves which class.
 *
 * Headers are SERVANT_COLUMNS verbatim, so a template filled in and re-imported
 * round-trips through exportServantsCsv unchanged — the same contract the
 * student template holds.
 */
export async function servantImportTemplateCsv(): Promise<ActionResult<{ filename: string; csv: string }>> {
  return runAction(async () => {
    await requireAdmin()
    const example: Record<string, string> = {
      id: '',
      name: 'Marina Fahmy',
      role: 'SERVANT',
      email: 'marina@example.com',
      phone: '615-555-0163',
      birthday: '1998-02-14',
      address: '123 Main St, Antioch TN',
      stageOversight: '',
      // Semicolon-separated, and `titles` lines up position by position with
      // `classes`: the first title belongs to the first class named.
      classes: 'Grade 3; Grade 4',
      titles: 'COORDINATOR;',
      isActive: 'yes',
    }
    return {
      filename: 'servants-import-template.csv',
      csv: objectsToCsv(SERVANT_COLUMNS, [example]),
    }
  })
}

export async function exportServantsCsv(): Promise<ActionResult<{ filename: string; csv: string; rows: number }>> {
  return runAction(async () => {
    const user = await requireAdmin()
    const accounts = await prisma.account.findMany({
      where: { role: { in: [PortalRole.SERVANT, PortalRole.ADMIN, PortalRole.PASTOR] } },
      orderBy: { displayName: 'asc' },
      select: {
        loginId: true, displayName: true, role: true, email: true, phone: true, isActive: true,
        servant: {
          select: {
            birthday: true, address: true, stageOversight: true,
            classes: { select: { classId: true, title: true }, orderBy: { sortOrder: 'asc' } },
          },
        },
      },
    })
    const rows = accounts.map((a) => ({
      id: a.loginId,
      name: a.displayName,
      role: a.role,
      email: a.email ?? '',
      phone: a.phone ?? '',
      birthday: a.servant?.birthday ? formatDateOnly(a.servant.birthday) : '',
      address: a.servant?.address ?? '',
      stageOversight: a.servant?.stageOversight ?? '',
      classes: (a.servant?.classes ?? []).map((c) => c.classId).join('; '),
      titles: (a.servant?.classes ?? []).map((c) => c.title ?? '').join('; '),
      isActive: a.isActive ? 'yes' : 'no',
    }))
    await audit(user, 'data.exportServants', 'portal', null, `Exported ${rows.length} servants`)
    return {
      filename: reportFilename(['servants', formatDateOnly(new Date())], 'csv'),
      csv: objectsToCsv(SERVANT_COLUMNS, rows),
      rows: rows.length,
    }
  })
}

/* ── CSV import ───────────────────────────────────────────────────────────── */

function pick(record: Record<string, string>, ...names: string[]): string {
  for (const name of names) {
    const value = record[name]
    if (value !== undefined && value !== '') return value
  }
  return ''
}

async function freeLoginId(taken: Set<string>): Promise<string> {
  for (let i = 0; i < 80; i++) {
    const candidate = String(randomInt(1000, 10000))
    if (taken.has(candidate)) continue
    const exists = await prisma.account.findUnique({ where: { loginId: candidate }, select: { id: true } })
    if (!exists) {
      taken.add(candidate)
      return candidate
    }
  }
  throw new PortalError('Could not find a free 4-digit ID. Try again.')
}

const LoginIdSchema = z.string().trim().regex(/^\d{4}$/, 'ID must be four digits')
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const StudentRowSchema = z.object({
  loginId: z.union([LoginIdSchema, z.literal('')]),
  firstName: z.string().trim().max(60),
  lastName: z.string().trim().max(60),
  classRef: z.string().trim().max(80),
  grade: z.string().trim().max(20),
  gender: z.string().trim().max(10),
  dob: z.string().trim().max(20),
  fatherName: z.string().trim().max(80),
  fatherPhone: z.string().trim().max(30),
  motherName: z.string().trim().max(80),
  motherPhone: z.string().trim().max(30),
  parentEmails: z.string().trim().max(300),
  email: z.string().trim().max(200),
  phone: z.string().trim().max(30),
  address: z.string().trim().max(200),
  notes: z.string().trim().max(1000),
})

/**
 * F0799 — a sheet that carries a name column must actually fill it in; a sheet
 * with no name column at all is a corrections sheet (new phone numbers, a
 * change of address) whose rows are matched on login ID alone, and demanding a
 * first name from it would reject the very file the column check exists to
 * make safe.
 */
const NamedStudentRowSchema = StudentRowSchema.extend({
  firstName: z.string().trim().min(1, 'First name is required').max(60),
})

/**
 * Values in a Class column that mean "take this student out of their class".
 * Anything else blank simply leaves the existing assignment alone — a sheet
 * that only carries phone numbers must never detach a roster.
 */
const CLASS_NONE: ReadonlySet<string> = new Set(['none', 'no class', 'unassigned', 'remove', '-'])

/**
 * Upsert students by 4-digit login ID. A row whose ID is already in use updates
 * that student; a row with a blank or unused ID creates a new account with a
 * fresh PIN. An existing PIN is never touched, by any path.
 */
/**
 * `preview` runs every check and reports exactly what the file would do without
 * writing a row. The Help page has always promised admins a preview "before
 * anything is written"; the port committed on file selection instead, so a
 * mis-mapped column was only discovered after it had overwritten real records.
 */
export async function importStudentsCsv(
  csvText: string,
  defaultClassId: string | null,
  options: { preview?: boolean } = {},
): Promise<ActionResult<ImportSummary>> {
  return runAction(async () => {
    const user = await requireAdmin()
    const preview = options.preview === true
    const records = parseCsvRecords(csvText ?? '')
    if (records.length === 0) throw new PortalError('That file has no data rows.')
    if (records.length > MAX_IMPORT_ROWS) throw new PortalError(`Import at most ${MAX_IMPORT_ROWS} rows at a time.`)

    type PreparedRow = {
      rowNumber: number
      displayName: string
      loginId: string
      classId: string | null
      clearsClass: boolean
      data: {
        firstName: string
        lastName: string
        gender: 'male' | 'female' | null
        dob: Date | null
        grade: string | null
        address: string | null
        fatherName: string | null
        fatherPhone: string | null
        motherName: string | null
        motherPhone: string | null
        parentEmails: string[]
        notes: string | null
      }
      /** Student model has no contact columns; these live on their Account. */
      account: { email: string | null; phone: string | null }
    }

    const classes = await prisma.schoolClass.findMany({ select: { id: true, name: true } })
    const byId = new Map(classes.map((c) => [c.id.toLowerCase(), c.id]))
    const byName = new Map(classes.map((c) => [c.name.trim().toLowerCase(), c.id]))
    const allocated = new Set<string>()
    const results: ImportRowResult[] = []

    // F0799 — which columns this file actually carries. `parseCsvRecords` gives
    // every row a key for every header, blank cells included, so the first
    // row's keys are the header row: a missing key means a missing column, not
    // an empty cell, and the two must never be treated alike on an update.
    const { namesGiven, writableFields, has: hasColumn, changedLabels } = studentImportColumns(
      Object.keys(records[0] ?? {}),
    )
    const RowSchema = namesGiven ? NamedStudentRowSchema : StudentRowSchema

    /**
     * The update payload, cut to the columns the sheet carries. A field this
     * file says nothing about is left off the payload entirely rather than
     * written as null — writing the null is what made a partial sheet silently
     * destructive.
     */
    const updatableData = (data: PreparedRow['data']): Partial<PreparedRow['data']> => {
      const out: Partial<PreparedRow['data']> = {}
      for (const field of writableFields) {
        // Copied field by field rather than through a computed key, so each
        // one keeps its own type instead of widening to the union.
        switch (field) {
          case 'gender': out.gender = data.gender; break
          case 'dob': out.dob = data.dob; break
          case 'grade': out.grade = data.grade; break
          case 'address': out.address = data.address; break
          case 'fatherName': out.fatherName = data.fatherName; break
          case 'fatherPhone': out.fatherPhone = data.fatherPhone; break
          case 'motherName': out.motherName = data.motherName; break
          case 'motherPhone': out.motherPhone = data.motherPhone; break
          case 'parentEmails': out.parentEmails = data.parentEmails; break
          case 'notes': out.notes = data.notes; break
        }
      }
      if (namesGiven) {
        out.firstName = data.firstName
        out.lastName = data.lastName
      }
      return out
    }

    const updatableAccount = (account: PreparedRow['account']) => ({
      ...(hasColumn('email') ? { email: account.email } : {}),
      ...(hasColumn('phone') ? { phone: account.phone } : {}),
    })

    // Pass 1: parse, validate and transform every row in memory — no DB
    // round trips yet, so a bad file fails fast regardless of its size.
    const prepared: PreparedRow[] = []

    for (let i = 0; i < records.length; i++) {
      const rec = records[i]!
      const rowNumber = i + 1
      const rawName = pick(rec, 'name', 'full name', 'student', 'student name')
      const fallback = splitName(rawName)
      const draft = {
        loginId: pick(rec, 'id', 'login id', 'loginid', 'student id'),
        firstName: pick(rec, 'first', 'first name', 'firstname') || fallback.firstName,
        lastName: pick(rec, 'last', 'last name', 'lastname') || fallback.lastName,
        classRef: pick(rec, 'class', 'class id', 'classid', 'class name'),
        grade: pick(rec, 'grade'),
        gender: pick(rec, 'gender', 'sex'),
        dob: pick(rec, 'dob', 'date of birth', 'birthday', 'birth date'),
        fatherName: pick(rec, 'father name', 'father', 'fathername'),
        fatherPhone: pick(rec, 'father phone', 'fatherphone'),
        motherName: pick(rec, 'mother name', 'mother', 'mothername'),
        motherPhone: pick(rec, 'mother phone', 'motherphone'),
        parentEmails: pick(rec, 'parentemails', 'parent emails', 'parent email', 'parentemail', 'emails'),
        email: pick(rec, 'student email', 'studentemail', 'email'),
        phone: pick(rec, 'student phone', 'studentphone', 'phone', 'mobile', 'cell'),
        address: pick(rec, 'address'),
        notes: pick(rec, 'notes', 'note'),
      }
      const displayName = formatFullName({ firstName: draft.firstName, lastName: draft.lastName }) || rawName || `Row ${rowNumber}`

      const parsed = RowSchema.safeParse(draft)
      if (!parsed.success) {
        results.push({ row: rowNumber, name: displayName, loginId: draft.loginId || null, status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid row' })
        continue
      }
      const input = parsed.data

      try {
        const dob = input.dob ? parseDateOnly(input.dob) : null
        if (input.dob && !dob) throw new PortalError(`"${input.dob}" is not a valid date of birth`)

        // Three distinct intents, and only one of them may touch an existing
        // assignment by accident. A named class (or the picked default, for a
        // blank cell) moves the student; an explicit "none" removes them; a
        // blank cell with no default chosen means "this sheet says nothing
        // about classes" and must leave the student where they are.
        const classRef = input.classRef.trim()
        const clearsClass = classRef !== '' && CLASS_NONE.has(classRef.toLowerCase())
        let classId: string | null = null
        if (classRef && !clearsClass) {
          classId = byId.get(classRef.toLowerCase()) ?? byName.get(classRef.toLowerCase()) ?? null
          if (!classId) throw new PortalError(`Unknown class "${classRef}"`)
        } else if (!classRef) {
          classId = defaultClassId
        }

        const emails = Array.from(
          new Set(
            input.parentEmails
              .split(/[;,\s]+/)
              .map((e) => e.trim().toLowerCase())
              .filter((e) => e && EMAIL_RE.test(e)),
          ),
        )
        const email = input.email.trim().toLowerCase()
        if (email && !EMAIL_RE.test(email)) throw new PortalError(`"${input.email}" is not a valid email address`)
        const gender = input.gender.toLowerCase()
        prepared.push({
          rowNumber,
          displayName,
          loginId: input.loginId,
          classId,
          clearsClass,
          data: {
            firstName: input.firstName,
            lastName: input.lastName,
            gender: gender === 'male' || gender === 'female' ? gender : null,
            dob: dob ? toUTCDate(dob) : null,
            grade: input.grade || null,
            address: input.address || null,
            fatherName: input.fatherName || null,
            fatherPhone: normalizePhone(input.fatherPhone),
            motherName: input.motherName || null,
            motherPhone: normalizePhone(input.motherPhone),
            parentEmails: emails,
            notes: input.notes || null,
          },
          account: { email: email || null, phone: normalizePhone(input.phone) },
        })
      } catch (err) {
        const message = err instanceof PortalError ? err.message : 'Could not save this row'
        if (!(err instanceof PortalError)) console.error('Student import row failed:', err)
        results.push({ row: rowNumber, name: displayName, loginId: input.loginId || null, status: 'error', message })
      }
    }

    // Pass 2: one batched lookup for every login ID the file references,
    // instead of a `findUnique` per row.
    const providedIds = Array.from(new Set(prepared.map((p) => p.loginId).filter(Boolean)))
    const existingAccounts = providedIds.length
      ? await prisma.account.findMany({
          where: { loginId: { in: providedIds } },
          select: { id: true, loginId: true, role: true, displayName: true, student: { select: { id: true } } },
        })
      : []
    const existingByLoginId = new Map<string, ExistingImportAccount>(
      existingAccounts.map((a) => [
        a.loginId,
        { id: a.id, role: a.role, linkedId: a.student?.id ?? null, displayName: a.displayName },
      ]),
    )
    /** What to call a row: the sheet's name, or the one already on file. */
    const rowName = (p: PreparedRow) =>
      namesGiven ? p.displayName : existingByLoginId.get(p.loginId)?.displayName || p.displayName

    // Pass 3: hash a fresh PIN for every row that will create an account, all
    // at once — bcrypt's hash cost is CPU-bound and gains nothing from being
    // awaited one row at a time, which is what made a large import crawl.
    const toCreate = preview
      ? []
      : prepared.filter((p) => classifyStudentImportRow(p.loginId, existingByLoginId).kind === 'create')
    const newPins = toCreate.map(() => randomPin())
    const newHashes = await Promise.all(newPins.map((pin) => bcrypt.hash(pin, 10)))
    const newPinByRow = new Map(toCreate.map((p, idx) => [p.rowNumber, { pin: newPins[idx]!, hash: newHashes[idx]! }]))

    // Pass 4: write each row. Still sequential — a blank-ID row's freshly
    // allocated login ID, and two rows in the same file sharing an ID that
    // doesn't exist yet, both depend on what the rows before it just did.
    for (const p of prepared) {
      try {
        const classification = classifyStudentImportRow(p.loginId, existingByLoginId)
        if (classification.kind === 'error') throw new PortalError(classification.message)

        if (preview) {
          const classLabel = p.clearsClass
            ? 'Would be removed from their class'
            : p.classId
              ? `Would be placed in ${classes.find((c) => c.id === p.classId)?.name ?? 'a class'}`
              : 'Class left as it is'
          // F0799 — name the fields, so an admin sees before writing that a
          // column their sheet is missing is a column this import leaves alone.
          const changeLabel =
            classification.kind === 'update'
              ? changedLabels.length
                ? `Would update ${changedLabels.join(', ')}`
                : 'Nothing to update'
              : 'Would be added with a new ID and PIN'
          results.push({
            row: p.rowNumber,
            name: rowName(p),
            loginId: p.loginId || null,
            status: classification.kind === 'update' ? 'updated' : 'created',
            message: `${changeLabel} · ${classLabel}`,
          })
          continue
        }

        if (classification.kind === 'update') {
          await prisma.student.update({
            where: { id: classification.account.linkedId! },
            data: {
              ...updatableData(p.data),
              ...(p.clearsClass
                ? { class: { disconnect: true } }
                : p.classId
                  ? { class: { connect: { id: p.classId } } }
                  : {}),
              account: {
                update: {
                  ...(namesGiven ? { displayName: formatFullName(p.data) } : {}),
                  ...updatableAccount(p.account),
                },
              },
            },
          })
          results.push({
            row: p.rowNumber,
            name: rowName(p),
            loginId: p.loginId,
            status: 'updated',
            ...(p.clearsClass ? { message: 'Removed from class' } : {}),
          })
          continue
        }

        // A sheet with no name column cannot bring a new child into the school:
        // it would create an account with a blank name. Matching rows still
        // update; an unmatched one is an unknown ID and says so.
        if (!namesGiven) {
          throw new PortalError(
            'This file has no name column, so it can only update children that already exist — and no child has this ID.',
          )
        }

        const loginId = p.loginId || (await freeLoginId(allocated))
        const { pin, hash } = newPinByRow.get(p.rowNumber)!
        const created = await prisma.student.create({
          data: {
            ...p.data,
            ...(p.classId ? { class: { connect: { id: p.classId } } } : {}),
            account: {
              create: {
                loginId,
                pinHash: hash,
                role: PortalRole.STUDENT,
                displayName: formatFullName(p.data),
                ...p.account,
              },
            },
          },
          select: { id: true, accountId: true },
        })
        // So a later row in this same file that names the same (previously
        // unused) ID is treated as an update rather than a duplicate-ID error.
        existingByLoginId.set(loginId, { id: created.accountId, role: PortalRole.STUDENT, linkedId: created.id })
        results.push({ row: p.rowNumber, name: p.displayName, loginId, status: 'created', newPin: pin })
      } catch (err) {
        const message = err instanceof PortalError ? err.message : 'Could not save this row'
        if (!(err instanceof PortalError)) console.error('Student import row failed:', err)
        results.push({ row: p.rowNumber, name: p.displayName, loginId: p.loginId || null, status: 'error', message })
      }
    }

    const summary = summariseImport(results)
    // A preview wrote nothing, so it neither logs as an import nor invalidates
    // any cache — the log would otherwise claim rows were created.
    if (preview) return summary
    await audit(user, 'data.importStudents', 'portal', defaultClassId, `${summary.created} created, ${summary.updated} updated, ${summary.errors} failed`)
    revalidatePath('/portal/admin/students')
    revalidatePath('/portal/classes')
    return summary
  })
}

const ServantRowSchema = z.object({
  loginId: z.union([LoginIdSchema, z.literal('')]),
  name: z.string().trim().min(1, 'Name is required').max(80),
  role: z.enum(['SERVANT', 'ADMIN', 'PASTOR']),
  email: z.string().trim().max(120),
  phone: z.string().trim().max(30),
  birthday: z.string().trim().max(20),
  address: z.string().trim().max(200),
  stageOversight: z.enum(['', 'ELEMENTARY', 'MIDDLE_SCHOOL', 'HIGH_SCHOOL']),
  classes: z.string().trim().max(300),
  titles: z.string().trim().max(300),
})

/**
 * F0547 — the servant importer committed the moment it was called, while the
 * student importer had had a preview arm since it was written. Importing the
 * servant roster is the more dangerous of the two: a wrong `role` column makes
 * somebody an ADMIN, and a `classes` column rewrites who serves which class
 * (`classServant.deleteMany` then recreate). An admin had no way to see that
 * before it happened.
 *
 * `preview` runs every check and reports exactly what the file would do without
 * writing a row — the same contract as importStudentsCsv, deliberately, so the
 * one Help page sentence covers both.
 */
export async function importServantsCsv(
  csvText: string,
  options: { preview?: boolean } = {},
): Promise<ActionResult<ImportSummary>> {
  return runAction(async () => {
    const user = await requireAdmin()
    const preview = options.preview === true
    const records = parseCsvRecords(csvText ?? '')
    if (records.length === 0) throw new PortalError('That file has no data rows.')
    if (records.length > MAX_IMPORT_ROWS) throw new PortalError(`Import at most ${MAX_IMPORT_ROWS} rows at a time.`)

    const classes = await prisma.schoolClass.findMany({ select: { id: true, name: true } })
    const byId = new Map(classes.map((c) => [c.id.toLowerCase(), c.id]))
    const byName = new Map(classes.map((c) => [c.name.trim().toLowerCase(), c.id]))
    const allocated = new Set<string>()
    const results: ImportRowResult[] = []

    // Pass 1: parse, validate and transform every row in memory — no DB
    // round trips yet, so a bad file fails fast regardless of its size.
    type PreparedRow = {
      rowNumber: number
      loginId: string
      name: string
      role: 'ADMIN' | 'PASTOR' | 'SERVANT'
      accountData: { role: 'ADMIN' | 'PASTOR' | 'SERVANT'; displayName: string; email: string | null; phone: string | null }
      servantData: { birthday: Date | null; address: string | null; stageOversight: Stage | null }
      memberships: Array<{ classId: string; title: ClassTitle | null; sortOrder: number }>
    }
    const prepared: PreparedRow[] = []

    for (let i = 0; i < records.length; i++) {
      const rec = records[i]!
      const rowNumber = i + 1
      const draft = {
        loginId: pick(rec, 'id', 'login id', 'loginid'),
        name: pick(rec, 'name', 'full name', 'servant', 'servant name'),
        role: (pick(rec, 'role') || 'SERVANT').toUpperCase(),
        email: pick(rec, 'email'),
        phone: pick(rec, 'phone', 'mobile'),
        birthday: pick(rec, 'birthday', 'dob', 'date of birth'),
        address: pick(rec, 'address'),
        stageOversight: (pick(rec, 'stage oversight', 'stageoversight', 'stage') || '').toUpperCase().replace(/\s+/g, '_'),
        classes: pick(rec, 'classes', 'class', 'class ids'),
        titles: pick(rec, 'titles', 'title'),
      }
      const parsed = ServantRowSchema.safeParse(draft)
      if (!parsed.success) {
        results.push({ row: rowNumber, name: draft.name || `Row ${rowNumber}`, loginId: draft.loginId || null, status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid row' })
        continue
      }
      const input = parsed.data

      try {
        const birthday = input.birthday ? parseDateOnly(input.birthday) : null
        if (input.birthday && !birthday) throw new PortalError(`"${input.birthday}" is not a valid birthday`)
        const email = input.email.toLowerCase() || null
        if (email && !EMAIL_RE.test(email)) throw new PortalError(`"${input.email}" is not a valid email`)

        const titles = input.titles.split(';').map((t) => t.trim().toUpperCase().replace(/\s+/g, '_'))
        const refs = input.classes.split(';').map((c) => c.trim()).filter(Boolean)
        const memberships: Array<{ classId: string; title: ClassTitle | null; sortOrder: number }> = refs.map((ref, index) => {
          const classId = byId.get(ref.toLowerCase()) ?? byName.get(ref.toLowerCase())
          if (!classId) throw new PortalError(`Unknown class "${ref}"`)
          const title = titles[index]
          return {
            classId,
            title: title === 'COORDINATOR' || title === 'ASSISTANT_COORDINATOR' ? title : null,
            sortOrder: index,
          }
        })

        prepared.push({
          rowNumber,
          loginId: input.loginId,
          name: input.name,
          role: input.role,
          accountData: {
            role: input.role,
            displayName: input.name,
            email,
            phone: normalizePhone(input.phone),
          },
          servantData: {
            birthday: birthday ? toUTCDate(birthday) : null,
            address: input.address || null,
            stageOversight: input.stageOversight || null,
          },
          memberships,
        })
      } catch (err) {
        const message = err instanceof PortalError ? err.message : 'Could not save this row'
        if (!(err instanceof PortalError)) console.error('Servant import row failed:', err)
        results.push({ row: rowNumber, name: input.name, loginId: input.loginId || null, status: 'error', message })
      }
    }

    // Pass 2: one batched lookup for every login ID the file references,
    // instead of a `findUnique` per row.
    const providedIds = Array.from(new Set(prepared.map((p) => p.loginId).filter(Boolean)))
    const existingAccounts = providedIds.length
      ? await prisma.account.findMany({
          where: { loginId: { in: providedIds } },
          select: { id: true, loginId: true, role: true, servant: { select: { id: true } } },
        })
      : []
    const existingByLoginId = new Map<string, ExistingImportAccount>(
      existingAccounts.map((a) => [a.loginId, { id: a.id, role: a.role, linkedId: a.servant?.id ?? null }]),
    )

    // Pass 3: hash a fresh PIN for every row that will create an account, all
    // at once — bcrypt's hash cost is CPU-bound and gains nothing from being
    // awaited one row at a time, which is what made a large import crawl.
    // No PIN is generated for a preview: it writes nothing, so a hashed PIN
    // would be handed to the admin for an account that does not exist.
    const toCreate = preview
      ? []
      : prepared.filter(
          (p) => classifyServantImportRow(p.loginId, existingByLoginId, user.accountId, p.role).kind === 'create',
        )
    const newPins = toCreate.map(() => randomPin())
    const newHashes = await Promise.all(newPins.map((pin) => bcrypt.hash(pin, 10)))
    const newPinByRow = new Map(toCreate.map((p, idx) => [p.rowNumber, { pin: newPins[idx]!, hash: newHashes[idx]! }]))

    // Pass 4: write each row. Still sequential — a blank-ID row's freshly
    // allocated login ID, and two rows in the same file sharing an ID that
    // doesn't exist yet, both depend on what the rows before it just did.
    for (const p of prepared) {
      try {
        const classification = classifyServantImportRow(p.loginId, existingByLoginId, user.accountId, p.role)
        if (classification.kind === 'error') throw new PortalError(classification.message)

        if (preview) {
          // Names the two things that actually alarm an admin: the role the row
          // would grant, and whether it rewrites the class assignments.
          const classLabel =
            p.memberships.length === 0
              ? 'Classes left as they are'
              : `Would serve ${p.memberships
                  .map((m) => classes.find((c) => c.id === m.classId)?.name ?? m.classId)
                  .join(', ')}`
          results.push({
            row: p.rowNumber,
            name: p.name,
            loginId: p.loginId || null,
            status: classification.kind === 'update' ? 'updated' : 'created',
            message: `${classification.kind === 'update' ? 'Would be updated' : 'Would be created'} as ${p.role} \u00b7 ${classLabel}`,
          })
          continue
        }

        if (classification.kind === 'update') {
          const existing = classification.account
          await prisma.$transaction(async (tx) => {
            await tx.account.update({ where: { id: existing.id }, data: p.accountData })
            const servant = existing.linkedId
              ? await tx.servant.update({ where: { id: existing.linkedId }, data: p.servantData, select: { id: true } })
              : await tx.servant.create({ data: { accountId: existing.id, ...p.servantData }, select: { id: true } })
            if (p.memberships.length > 0) {
              await tx.classServant.deleteMany({ where: { servantId: servant.id } })
              await tx.classServant.createMany({
                data: p.memberships.map((m) => ({ servantId: servant.id, ...m })),
              })
            }
          })
          results.push({ row: p.rowNumber, name: p.name, loginId: p.loginId, status: 'updated' })
          continue
        }

        const loginId = p.loginId || (await freeLoginId(allocated))
        const { pin, hash } = newPinByRow.get(p.rowNumber)!
        const created = await prisma.account.create({
          data: {
            loginId,
            pinHash: hash,
            ...p.accountData,
            servant: {
              create: {
                ...p.servantData,
                classes: { create: p.memberships },
              },
            },
          },
          select: { id: true, servant: { select: { id: true } } },
        })
        // So a later row in this same file that names the same (previously
        // unused) ID is treated as an update rather than a duplicate-ID error.
        existingByLoginId.set(loginId, { id: created.id, role: p.role, linkedId: created.servant?.id ?? null })
        results.push({ row: p.rowNumber, name: p.name, loginId, status: 'created', newPin: pin })
      } catch (err) {
        const message = err instanceof PortalError ? err.message : 'Could not save this row'
        if (!(err instanceof PortalError)) console.error('Servant import row failed:', err)
        results.push({ row: p.rowNumber, name: p.name, loginId: p.loginId || null, status: 'error', message })
      }
    }

    const summary = summariseImport(results)
    // A preview wrote nothing, so it neither logs as an import nor invalidates
    // any cache — the log would otherwise claim rows were created.
    if (preview) return summary
    await audit(user, 'data.importServants', 'portal', null, `${summary.created} created, ${summary.updated} updated, ${summary.errors} failed`)
    revalidatePath('/portal/admin/servants')
    revalidatePath('/portal/classes')
    return summary
  })
}

/* ── Data repair ──────────────────────────────────────────────────────────── */

const RepairSchema = z.object({
  tool: z.enum(['recount-classes', 'close-returned-cases', 'orphan-points', 'normalise-phones', 'clear-import-flags', 'check-attendance-points']),
  dryRun: z.boolean(),
})

/** Each tool counts first. Nothing is written unless `dryRun` is false. */
export async function runRepair(raw: z.infer<typeof RepairSchema>): Promise<ActionResult<RepairResult>> {
  return runAction(async () => {
    const user = await requireAdmin()
    const { tool, dryRun } = RepairSchema.parse(raw)
    let result: RepairResult

    switch (tool) {
      case 'recount-classes': {
        // Student counts are derived live from the students table, so there is
        // nothing denormalised to repair — this verifies and reports instead.
        const [counts, unassigned, classes] = await Promise.all([
          prisma.student.groupBy({ by: ['classId'], _count: { _all: true } }),
          prisma.student.count({ where: { classId: null } }),
          prisma.schoolClass.findMany({ orderBy: { sortOrder: 'asc' }, select: { id: true, name: true, isActive: true } }),
        ])
        const byClass = new Map(counts.filter((c) => c.classId).map((c) => [c.classId!, c._count._all]))
        const detail = classes.map((c) => `${c.name}: ${byClass.get(c.id) ?? 0} students${c.isActive ? '' : ' (archived)'}`)
        if (unassigned > 0) detail.push(`${unassigned} students with no class`)
        result = {
          tool,
          label: 'Verify class rosters',
          dryRun: true,
          found: classes.length,
          changed: 0,
          detail: [...detail, 'Counts are computed from the students table on every read, so nothing needed rewriting.'],
        }
        break
      }

      case 'close-returned-cases': {
        const open = await prisma.followUpCase.findMany({
          where: { status: 'OPEN', origin: 'AUTO' },
          select: { id: true, studentId: true, student: { select: { firstName: true, lastName: true } } },
        })
        if (open.length === 0) {
          result = { tool, label: 'Close cases for students who are back', dryRun, found: 0, changed: 0, detail: ['No open automatic cases.'] }
          break
        }
        // Raw DISTINCT ON: Prisma's `distinct` is applied after the rows come
        // back, so the findMany form downloads every Sunday row these students
        // have ever had just to keep the newest one each.
        const latest = await prisma.$queryRaw<{ studentId: string; date: Date; status: string }[]>`
          SELECT DISTINCT ON ("studentId") "studentId", "date", "status"
          FROM "AttendanceRecord"
          WHERE "sessionKey" = 'sunday' AND "studentId" IN (${Prisma.join(open.map((c) => c.studentId))})
          ORDER BY "studentId", "date" DESC
        `
        const back = new Map(latest.filter((r) => r.status === 'PRESENT').map((r) => [r.studentId, formatDateOnly(r.date)]))
        const closable = open.filter((c) => back.has(c.studentId))
        let changed = 0
        if (!dryRun && closable.length > 0) {
          await prisma.$transaction(
            closable.map((c) =>
              prisma.followUpCase.update({
                where: { id: c.id },
                data: {
                  status: 'DONE',
                  resolvedAt: new Date(),
                  resolvedById: user.accountId,
                  resolveReason: 'attending_again',
                  resolveNote: `Back on ${back.get(c.studentId)}`,
                },
              }),
            ),
          )
          changed = closable.length
        }
        result = {
          tool,
          label: 'Close cases for students who are back',
          dryRun,
          found: closable.length,
          changed,
          detail: closable.slice(0, 20).map((c) => `${studentName(c.student)} — last seen ${back.get(c.studentId)}`),
        }
        break
      }

      /**
       * F0668 — the prototype's "find attendance with missing points" tool, as a
       * check and nothing more.
       *
       * The old version deleted the attendance records it found, which is a
       * loaded gun pointed at children's history — and pointed at a problem that
       * no longer exists here, because a mark and its point are written in one
       * transaction. What the admin actually wanted from it was reassurance, so
       * that is all this gives: it counts, it names the classes, and it never
       * writes. `dryRun` is ignored deliberately; there is no other mode.
       */
      case 'check-attendance-points': {
        const sessions = await prisma.attendanceSession.findMany({
          where: { points: { gt: 0 } },
          select: { key: true, label: true },
        })
        const scoring = sessions.map((x) => x.key)
        const missing = scoring.length
          ? await prisma.attendanceRecord.findMany({
              where: { status: 'PRESENT', sessionKey: { in: scoring }, pointEntry: { is: null } },
              select: { sessionKey: true, date: true, class: { select: { name: true } } },
              orderBy: { date: 'desc' },
              take: 200,
            })
          : []

        const labelOf = new Map(sessions.map((x) => [x.key, x.label]))
        const byClass = new Map<string, number>()
        for (const m of missing) {
          const key = `${m.class.name} · ${labelOf.get(m.sessionKey) ?? m.sessionKey}`
          byClass.set(key, (byClass.get(key) ?? 0) + 1)
        }
        const detail =
          missing.length === 0
            ? ['Every present mark on a scoring session has its point entry.']
            : Array.from(byClass.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([where, n]) => `${where}: ${n} mark${n === 1 ? '' : 's'} with no point entry`)
        if (missing.length >= 200) {
          detail.push('Showing the 200 most recent; there may be more.')
        }
        detail.push('This check never changes anything. Re-saving that day\u2019s register writes the missing points.')

        result = {
          tool,
          label: 'Check attendance points',
          dryRun: true,
          found: missing.length,
          changed: 0,
          detail,
        }
        break
      }

      case 'orphan-points': {
        // An entry loses its class when the class is deleted (SetNull). Re-link
        // it when the student still has a class; delete it when nothing is left
        // to attach it to.
        const orphans = await prisma.pointEntry.findMany({
          where: { classId: null },
          select: { id: true, studentId: true, student: { select: { classId: true } } },
        })
        const relink = orphans.filter((o) => o.student.classId)
        const remove = orphans.filter((o) => !o.student.classId)
        let changed = 0
        if (!dryRun && orphans.length > 0) {
          await prisma.$transaction(async (tx) => {
            const byClass = new Map<string, string[]>()
            for (const o of relink) {
              const classId = o.student.classId!
              byClass.set(classId, [...(byClass.get(classId) ?? []), o.id])
            }
            for (const [classId, ids] of Array.from(byClass.entries())) {
              await tx.pointEntry.updateMany({ where: { id: { in: ids } }, data: { classId } })
            }
            if (remove.length > 0) {
              await tx.pointEntry.deleteMany({ where: { id: { in: remove.map((o) => o.id) } } })
            }
          }, { timeout: 60_000 })
          changed = orphans.length
        }
        result = {
          tool,
          label: 'Repair orphaned point entries',
          dryRun,
          found: orphans.length,
          changed,
          detail: [
            `${relink.length} entries can be re-linked to the student's current class`,
            `${remove.length} entries belong to students with no class and would be deleted`,
          ],
        }
        break
      }

      case 'normalise-phones': {
        const [students, accounts] = await Promise.all([
          prisma.student.findMany({
            where: { OR: [{ fatherPhone: { not: null } }, { motherPhone: { not: null } }] },
            select: { id: true, fatherPhone: true, motherPhone: true },
          }),
          prisma.account.findMany({ where: { phone: { not: null } }, select: { id: true, phone: true } }),
        ])
        const studentFixes = students
          .map((s) => ({
            id: s.id,
            fatherPhone: normalizePhone(s.fatherPhone),
            motherPhone: normalizePhone(s.motherPhone),
            dirty: normalizePhone(s.fatherPhone) !== s.fatherPhone || normalizePhone(s.motherPhone) !== s.motherPhone,
          }))
          .filter((s) => s.dirty)
        const accountFixes = accounts
          .map((a) => ({ id: a.id, phone: normalizePhone(a.phone), original: a.phone }))
          .filter((a) => a.phone !== a.original)
        const found = studentFixes.length + accountFixes.length
        let changed = 0
        if (!dryRun && found > 0) {
          await prisma.$transaction(
            [
              ...studentFixes.map((s) =>
                prisma.student.update({ where: { id: s.id }, data: { fatherPhone: s.fatherPhone, motherPhone: s.motherPhone } }),
              ),
              ...accountFixes.map((a) => prisma.account.update({ where: { id: a.id }, data: { phone: a.phone } })),
            ],
          )
          changed = found
        }
        result = {
          tool,
          label: 'Normalise phone numbers',
          dryRun,
          found,
          changed,
          detail: [`${studentFixes.length} student parent numbers`, `${accountFixes.length} account numbers`],
        }
        break
      }

      case 'clear-import-flags': {
        const found = await prisma.student.count({ where: { importNotes: { not: null } } })
        let changed = 0
        if (!dryRun && found > 0) {
          const updated = await prisma.student.updateMany({ where: { importNotes: { not: null } }, data: { importNotes: null } })
          changed = updated.count
        }
        result = {
          tool,
          label: 'Clear review flags on imported students',
          dryRun,
          found,
          changed,
          detail: [`${found} students are still flagged for review from the migration.`],
        }
        break
      }
    }

    if (!dryRun && result.changed > 0) {
      await audit(user, 'data.repair', 'portal', tool, `${result.label}: changed ${result.changed} of ${result.found}`)
      revalidatePath('/portal/admin/data')
      revalidatePath('/portal/follow-ups')
      revalidatePath('/portal/admin/students')
    }
    return result
  })
}

/* ── Danger Zone ──────────────────────────────────────────────────────────── */

function assertPhrase(typed: string, expected: string): void {
  if ((typed ?? '').trim() !== expected) {
    throw new PortalError(`Type ${expected} exactly to confirm.`)
  }
}

/**
 * End-of-year reset (ANALYSIS §5). Deletes every student account, which
 * cascades to their points, attendance, quiz results and answers, Bible
 * reading logs, achievements and follow-up cases. Classes, servants, exams,
 * feed posts, events, lessons, hymns, agendas, activities and settings stay.
 */
export async function endOfYearReset(confirm: string): Promise<ActionResult<DangerResult>> {
  return runAction(async () => {
    const user = await requireAdmin()
    assertPhrase(confirm, CONFIRM_PHRASE.endOfYear)

    const deleted = await prisma.$transaction(
      async (tx) => {
        const [students, points, attendance, quizResults, quizAnswers, readings, badges, cases, logs] = await Promise.all([
          tx.student.count(),
          tx.pointEntry.count(),
          tx.attendanceRecord.count(),
          tx.quizResult.count(),
          tx.quizAnswer.count(),
          tx.bibleReadingLog.count(),
          tx.studentAchievement.count(),
          tx.followUpCase.count(),
          tx.followUpLog.count(),
        ])
        // F0850 — a servant who grew up here keeps a Student row holding their
        // years as a child. Without the `servant: { is: null }` guard this
        // reset would delete them along with the children every September,
        // which is the loss the conversion exists to prevent.
        await tx.account.deleteMany({
          where: {
            AND: [
              { OR: [{ role: PortalRole.STUDENT }, { student: { isNot: null } }] },
              { servant: { is: null } },
            ],
          },
        })
        return [
          { table: 'students', rows: students },
          { table: 'pointEntries', rows: points },
          { table: 'attendanceRecords', rows: attendance },
          { table: 'quizResults', rows: quizResults },
          { table: 'quizAnswers', rows: quizAnswers },
          { table: 'bibleReadingLogs', rows: readings },
          { table: 'achievements', rows: badges },
          { table: 'followUpCases', rows: cases },
          { table: 'followUpLogs', rows: logs },
        ] satisfies BackupTableCount[]
      },
      { timeout: 120_000, maxWait: 20_000 },
    )

    const detail = deleted.map((d) => `${d.rows} ${d.table}`).join(', ')
    await audit(user, 'data.endOfYearReset', 'portal', null, `End-of-year reset — deleted ${detail}. Classes, servants, exams, lessons, hymns, agendas, feed, events, activities and settings kept.`)
    revalidatePath('/portal', 'layout')
    return {
      action: 'End-of-year reset',
      deleted,
      detail: 'Classes, servants, exams, lessons, hymns, agendas, feed posts, events, activities and settings were kept.',
    }
  })
}

export async function resetClassActivities(classId: string, confirm: string): Promise<ActionResult<DangerResult>> {
  return runAction(async () => {
    const user = await requireAdmin()
    assertPhrase(confirm, CONFIRM_PHRASE.resetActivities)
    const cls = await prisma.schoolClass.findUnique({ where: { id: classId }, select: { id: true, name: true } })
    if (!cls) throw new PortalError('Class not found.')

    const deleted = await prisma.$transaction(async (tx) => {
      const activities = await tx.pointActivity.count({ where: { classId: cls.id } })
      await tx.pointActivity.deleteMany({ where: { classId: cls.id } })
      return [{ table: 'pointActivities', rows: activities }] satisfies BackupTableCount[]
    }, { timeout: 60_000 })

    await audit(user, 'data.resetActivities', 'class', cls.id, `${cls.name}: deleted ${deleted[0]!.rows} point activities`)
    revalidatePath(`/portal/classes/${cls.id}/points`)
    revalidatePath('/portal/admin/data')
    return { action: `Reset point activities for ${cls.name}`, deleted, detail: 'Points already awarded were not touched.' }
  })
}

/**
 * Delete every student in one class, keeping the class and its servants.
 *
 * The prototype's Danger Zone had this as its fourth card; the port had only a
 * church-wide end-of-year reset, so an admin retiring a single class had no
 * tool between "one student at a time" and "wipe everything".
 *
 * Deleting the Account cascades to the Student and everything hanging off them
 * — attendance, points, quiz results, follow-up cases — which is the same path
 * the single-student delete takes.
 */
/**
 * Remove every class's custom point activities in one go.
 *
 * This is the prototype's "Reset Activities to Standard 6" (OG settings), with
 * an honest label. That button's name did not describe what it did: the "six
 * standard activities" are the attendance *sessions*, which are separate rows
 * and separately editable under Sessions & Points — the button simply deleted
 * the custom point activities every class had defined. So this does that, and
 * says so.
 *
 * Points already awarded are untouched: a PointEntry carries its own
 * `activityLabel`, which is why `updateActivity` leaves the key alone.
 */
export async function resetAllClassActivities(confirm: string): Promise<ActionResult<DangerResult>> {
  return runAction(async () => {
    const user = await requireAdmin()
    assertPhrase(confirm, CONFIRM_PHRASE.resetAllActivities)

    const deleted = await prisma.$transaction(async (tx) => {
      // Class-scoped rows only: a church-wide activity (classId null) is shared
      // scaffolding, not something one class defined for itself.
      const rows = await tx.pointActivity.count({ where: { classId: { not: null } } })
      await tx.pointActivity.deleteMany({ where: { classId: { not: null } } })
      return [{ table: 'pointActivities', rows }] satisfies BackupTableCount[]
    }, { timeout: 120_000, maxWait: 20_000 })

    await audit(user, 'data.resetAllActivities', 'portal', null, `Deleted ${deleted[0]!.rows} custom point activities across every class`)
    revalidatePath('/portal/admin/data')
    revalidatePath('/portal/classes')
    return {
      action: 'Reset every class\'s custom point activities',
      deleted,
      detail: 'Points already awarded were not touched, and the shared church-wide activities were kept.',
    }
  })
}

export async function deleteClassStudents(classId: string, confirm: string): Promise<ActionResult<DangerResult>> {
  return runAction(async () => {
    const user = await requireAdmin()
    assertPhrase(confirm, CONFIRM_PHRASE.deleteClassStudents)
    const cls = await prisma.schoolClass.findUnique({ where: { id: classId }, select: { id: true, name: true } })
    if (!cls) throw new PortalError('Class not found.')

    const students = await prisma.student.findMany({ where: { classId: cls.id }, select: { accountId: true } })
    if (students.length === 0) throw new PortalError(`${cls.name} has no students to delete.`)

    const deleted = await prisma.$transaction(async (tx) => {
      const removed = await tx.account.deleteMany({ where: { id: { in: students.map((s) => s.accountId) } } })
      return [{ table: 'students', rows: removed.count }] satisfies BackupTableCount[]
    }, { timeout: 120_000, maxWait: 20_000 })

    await audit(user, 'data.deleteClassStudents', 'class', cls.id, `${cls.name}: deleted ${deleted[0]!.rows} students`)
    revalidatePath(`/portal/classes/${cls.id}`)
    revalidatePath('/portal/admin/students')
    revalidatePath('/portal/admin/data')
    revalidatePath('/portal')
    return {
      action: `Deleted every student in ${cls.name}`,
      deleted,
      detail: 'The class and its servants were kept. Each student\'s attendance, points, quiz results and follow-up cases went with their account.',
    }
  })
}

export async function clearClassPoints(classId: string, confirm: string): Promise<ActionResult<DangerResult>> {
  return runAction(async () => {
    const user = await requireAdmin()
    assertPhrase(confirm, CONFIRM_PHRASE.clearPoints)
    const cls = await prisma.schoolClass.findUnique({ where: { id: classId }, select: { id: true, name: true } })
    if (!cls) throw new PortalError('Class not found.')

    const deleted = await prisma.$transaction(async (tx) => {
      const points = await tx.pointEntry.count({ where: { classId: cls.id } })
      await tx.pointEntry.deleteMany({ where: { classId: cls.id } })
      return [{ table: 'pointEntries', rows: points }] satisfies BackupTableCount[]
    }, { timeout: 120_000, maxWait: 20_000 })

    await audit(user, 'data.clearPoints', 'class', cls.id, `${cls.name}: deleted ${deleted[0]!.rows} point entries`)
    revalidatePath(`/portal/classes/${cls.id}`)
    revalidatePath(`/portal/classes/${cls.id}/points`)
    revalidatePath('/portal/leaderboard')
    revalidatePath('/portal/admin/data')
    return { action: `Cleared points for ${cls.name}`, deleted, detail: 'Attendance records were kept; only the point entries were removed.' }
  })
}

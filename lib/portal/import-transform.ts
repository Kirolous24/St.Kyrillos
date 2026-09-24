// Pure transform from the Firebase prototype's JSON backup to rows the portal
// understands. No DB access here so the mapping can be unit-tested and
// rehearsed; scripts/import-firebase.ts does the writing.

import { splitName, formatFullName } from './names'
import { parseDateOnly } from './dates'
import { normalizePhone } from './phones'
import type { Role, StageKey } from './permissions'

export interface BackupUser {
  id: string
  role: string
  name?: string
  email?: string
  loginId?: string
  pin?: string
  classId?: string
  stage?: string
  classTitle?: string
  stageOversight?: string
  grade?: string
  gender?: string
  dob?: string
  birthday?: string
  phone?: string
  address?: string
  fatherName?: string
  fatherPhone?: string
  motherName?: string
  motherPhone?: string
  parentEmails?: string
  notes?: string
  photo?: string
  createdAt?: string
}

export interface BackupClass {
  id: string
  name: string
  stage?: string
  description?: string
  visitationThreshold?: number
  curriculumLinkedTo?: string
  servants?: Array<{ id: string; name?: string; title?: string }>
  createdAt?: string
}

export interface BackupSetting {
  id: string
  [key: string]: unknown
}

export interface BackupActivity {
  id: string
  key?: string
  label: string
  icon?: string
  pts: number
  classId?: string
  createdBy?: string
}

export interface BackupJson {
  exportedAt: string
  users: BackupUser[]
  classes: BackupClass[]
  settings?: BackupSetting[]
  activities?: BackupActivity[]
  [collection: string]: unknown
}

export interface ImportClass {
  id: string
  legacyId: string
  name: string
  stage: StageKey
  sortOrder: number
  description: string | null
  visitationThreshold: number
  curriculumLinkedToId: string | null
  createdAt: string | null
}

export interface ImportStudent {
  classId: string | null
  firstName: string
  lastName: string
  gender: string | null
  dob: string | null
  grade: string | null
  address: string | null
  fatherName: string | null
  fatherPhone: string | null
  motherName: string | null
  motherPhone: string | null
  parentEmails: string[]
  notes: string | null
  importNotes: string | null
}

export interface ImportServant {
  birthday: string | null
  address: string | null
  stageOversight: StageKey | null
  classes: Array<{ classId: string; title: 'COORDINATOR' | 'ASSISTANT_COORDINATOR' | null }>
}

export interface ImportAccount {
  legacyUid: string
  loginId: string
  pin: string
  role: Role
  displayName: string
  email: string | null
  phone: string | null
  photo: string | null
  createdAt: string | null
  student?: ImportStudent
  servant?: ImportServant
}

export interface ImportSession {
  key: string
  label: string
  points: number
  sortOrder: number
  icon?: string
}

export interface ImportActivity {
  classId: string | null
  key: string
  label: string
  icon: string | null
  points: number
  createdByLegacyUid: string | null
}

export interface ImportResult {
  classes: ImportClass[]
  accounts: ImportAccount[]
  sessions: ImportSession[]
  activities: ImportActivity[]
  skipped: Array<{ legacyUid: string; name: string; role: string; reason: string }>
  warnings: string[]
}

const STAGE_MAP: Record<string, StageKey> = {
  elementary: 'ELEMENTARY',
  middle_school: 'MIDDLE_SCHOOL',
  high_school: 'HIGH_SCHOOL',
}

const ROLE_MAP: Record<string, Role> = {
  student: 'STUDENT',
  servant: 'SERVANT',
  admin: 'ADMIN',
  pastor: 'PASTOR',
}

// School order for sorting classes; anything unknown goes after, alphabetically.
const CLASS_ORDER = [
  'pre-k', 'kg', '1st', '2nd', '3rd', '4th',
  '5th-6th-boys', '5th-6th-girls', '7th-8th-boys', '7th-8th-girls',
  'high-school-boys', 'high-school-girls',
]

const DEFAULT_SESSIONS: Array<{ key: string; label: string; points: number }> = [
  { key: 'bible', label: 'Bible Study', points: 2 },
  { key: 'vespers', label: 'Vespers', points: 2 },
  { key: 'tasbeha', label: 'Tasbeha', points: 5 },
  { key: 'liturgy', label: 'Liturgy', points: 2 },
  { key: 'sunday', label: 'Sunday School', points: 2 },
  { key: 'hymns', label: 'Hymns', points: 2 },
]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function slugifyClassId(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const t = value.replace(/\s+/g, ' ').trim()
  return t ? t : null
}

function email(value: unknown): string | null {
  const t = text(value)?.toLowerCase() ?? null
  return t && EMAIL_RE.test(t) ? t : null
}

function splitEmails(value: unknown): string[] {
  if (typeof value !== 'string') return []
  return value
    .split(/[;,\s]+/)
    .map((e) => email(e))
    .filter((e): e is string => !!e)
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items))
}

function nameKey(first: string, last: string): string {
  return `${first} ${last}`.toLowerCase().split(/\s+/).filter(Boolean).sort().join(' ')
}

function classSortOrder(id: string): number {
  const i = CLASS_ORDER.indexOf(id)
  return i === -1 ? CLASS_ORDER.length : i
}

function mapTitle(raw: string | undefined): 'COORDINATOR' | 'ASSISTANT_COORDINATOR' | null {
  const t = (raw ?? '').trim().toLowerCase()
  if (t === 'coordinator') return 'COORDINATOR'
  if (t === 'assistant coordinator') return 'ASSISTANT_COORDINATOR'
  return null
}

export function transformBackup(backup: BackupJson): ImportResult {
  const warnings: string[] = []
  const skipped: ImportResult['skipped'] = []

  // ── Classes ────────────────────────────────────────────────────────────
  const legacyToClassId = new Map<string, string>()
  const classes: ImportClass[] = backup.classes.map((c) => {
    const id = slugifyClassId(c.id)
    legacyToClassId.set(c.id, id)
    const stage = STAGE_MAP[(c.stage ?? '').toLowerCase()]
    if (!stage) warnings.push(`Class "${c.name}" has unknown stage "${c.stage}"; defaulted to ELEMENTARY`)
    return {
      id,
      legacyId: c.id,
      name: c.name.trim(),
      stage: stage ?? 'ELEMENTARY',
      sortOrder: classSortOrder(id),
      description: text(c.description),
      visitationThreshold: typeof c.visitationThreshold === 'number' && c.visitationThreshold > 0 ? c.visitationThreshold : 1,
      curriculumLinkedToId: c.curriculumLinkedTo ? slugifyClassId(c.curriculumLinkedTo) : null,
      createdAt: c.createdAt ?? null,
    }
  })
  classes.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
  const classNameById = new Map(classes.map((c) => [c.id, c.name]))

  const resolveClass = (legacyClassId: string | undefined): string | null => {
    if (!legacyClassId) return null
    return legacyToClassId.get(legacyClassId) ?? null
  }

  // ── Servant memberships from class docs ────────────────────────────────
  const userIds = new Set(backup.users.map((u) => u.id))
  const memberships = new Map<string, Array<{ classId: string; title: ReturnType<typeof mapTitle> }>>()
  for (const c of backup.classes) {
    const classId = legacyToClassId.get(c.id)!
    for (const s of c.servants ?? []) {
      if (!userIds.has(s.id)) {
        warnings.push(`Class "${c.name}" lists servant ${s.name ?? '?'} (${s.id}) who no longer exists; skipped`)
        continue
      }
      const list = memberships.get(s.id) ?? []
      if (!list.some((m) => m.classId === classId)) list.push({ classId, title: mapTitle(s.title) })
      memberships.set(s.id, list)
    }
  }

  // ── Accounts ───────────────────────────────────────────────────────────
  const seenLoginIds = new Map<string, string>()
  const accounts: ImportAccount[] = []

  for (const u of backup.users) {
    const role = ROLE_MAP[(u.role ?? '').toLowerCase()]
    const rawName = text(u.name) ?? ''
    if (!role) {
      skipped.push({ legacyUid: u.id, name: rawName, role: u.role, reason: `unknown role "${u.role}"` })
      continue
    }
    const loginId = text(u.loginId)
    const pin = text(u.pin)
    if (!loginId || !/^\d{4}$/.test(loginId)) {
      skipped.push({ legacyUid: u.id, name: rawName, role: u.role, reason: 'no loginId' })
      continue
    }
    if (!pin || !/^\d{4,8}$/.test(pin)) {
      skipped.push({ legacyUid: u.id, name: rawName, role: u.role, reason: 'no pin' })
      continue
    }
    const prev = seenLoginIds.get(loginId)
    if (prev) throw new Error(`duplicate loginId ${loginId} (${prev} and ${u.id})`)
    seenLoginIds.set(loginId, u.id)

    const parts = splitName(rawName)
    const base: ImportAccount = {
      legacyUid: u.id,
      loginId,
      pin,
      role,
      displayName: formatFullName(parts) || rawName || `User ${loginId}`,
      email: email(u.email),
      phone: normalizePhone(u.phone),
      photo: typeof u.photo === 'string' && u.photo.startsWith('data:image/') ? u.photo : null,
      createdAt: u.createdAt ?? null,
    }

    if (role === 'STUDENT') {
      const notes: string[] = []
      const dob = parseDateOnly(u.dob)
      if (u.dob && !dob) notes.push(`Invalid birthday "${u.dob}"`)
      const classId = resolveClass(u.classId)
      if (u.classId && !classId) notes.push(`Unknown class "${u.classId}"`)
      // The prototype's student "email" field almost always holds a parent's address.
      const parentEmails = unique([...(base.email ? [base.email] : []), ...splitEmails(u.parentEmails)])
      base.email = null
      base.student = {
        classId,
        firstName: parts.firstName,
        lastName: parts.lastName,
        gender: text(u.gender)?.toLowerCase() ?? null,
        dob,
        grade: text(u.grade),
        address: text(u.address),
        fatherName: text(u.fatherName),
        fatherPhone: normalizePhone(u.fatherPhone),
        motherName: text(u.motherName),
        motherPhone: normalizePhone(u.motherPhone),
        parentEmails,
        notes: text(u.notes),
        importNotes: notes.length ? notes.join('; ') : null,
      }
    } else if (role === 'SERVANT') {
      const birthday = parseDateOnly(u.birthday ?? u.dob)
      if ((u.birthday ?? u.dob) && !birthday) warnings.push(`Servant ${base.displayName} has invalid birthday "${u.birthday ?? u.dob}"`)
      const list = memberships.get(u.id) ?? []
      const ownClass = resolveClass(u.classId)
      if (ownClass && !list.some((m) => m.classId === ownClass)) {
        list.push({ classId: ownClass, title: mapTitle(u.classTitle) })
        warnings.push(`Servant ${base.displayName} is assigned to ${classNameById.get(ownClass)} on their profile but missing from the class roster; added`)
      }
      list.sort((a, b) => classSortOrder(a.classId) - classSortOrder(b.classId))
      if (list.length === 0) warnings.push(`Servant ${base.displayName} (ID ${loginId}) has no class`)
      const oversight = STAGE_MAP[(u.stageOversight ?? '').toLowerCase()] ?? null
      base.servant = {
        birthday,
        address: text(u.address),
        stageOversight: oversight,
        classes: list,
      }
    }

    accounts.push(base)
  }

  // ── Probable duplicate students ────────────────────────────────────────
  const students = accounts.filter((a) => a.student)
  const byKey = new Map<string, ImportAccount[]>()
  for (const a of students) {
    const key = nameKey(a.student!.firstName, a.student!.lastName)
    byKey.set(key, [...(byKey.get(key) ?? []), a])
  }
  for (const group of Array.from(byKey.values())) {
    if (group.length < 2) continue
    for (const a of group) {
      for (const b of group) {
        if (a === b) continue
        const sameDob = !a.student!.dob || !b.student!.dob || a.student!.dob === b.student!.dob
        if (!sameDob) continue
        const cls = b.student!.classId ? classNameById.get(b.student!.classId) ?? b.student!.classId : 'no class'
        const note = `Possible duplicate of ${b.displayName} (ID ${b.loginId}, ${cls})`
        a.student!.importNotes = a.student!.importNotes ? `${a.student!.importNotes}; ${note}` : note
      }
    }
  }

  // ── Attendance sessions ────────────────────────────────────────────────
  const pointsDoc: Record<string, unknown> =
    (backup.settings ?? []).find((s) => s.id === 'attendanceSessionPoints') ?? {}
  const sessions: ImportSession[] = DEFAULT_SESSIONS.map((s, i) => ({
    key: s.key,
    label: s.label,
    points: typeof pointsDoc[s.key] === 'number' ? (pointsDoc[s.key] as number) : s.points,
    sortOrder: i,
  }))
  const extras = Array.isArray(pointsDoc.extraSessions) ? (pointsDoc.extraSessions as Array<Record<string, unknown>>) : []
  for (const e of extras) {
    const key = text(e.key)
    const label = text(e.label)
    if (!key || !label || sessions.some((s) => s.key === key)) continue
    sessions.push({
      key,
      label,
      points: typeof e.pts === 'number' ? e.pts : 0,
      sortOrder: sessions.length,
      ...(text(e.icon) ? { icon: text(e.icon)! } : {}),
    })
  }

  // ── Custom activities ──────────────────────────────────────────────────
  const activities: ImportActivity[] = []
  for (const a of backup.activities ?? []) {
    const key = text(a.key) ?? a.id
    const label = text(a.label)
    if (!label) continue
    const icon = text(a.icon)
    activities.push({
      classId: resolveClass(a.classId),
      key,
      label,
      icon: icon && !icon.startsWith('<') ? icon : null,
      points: typeof a.pts === 'number' ? a.pts : 0,
      createdByLegacyUid: a.createdBy && userIds.has(a.createdBy) ? a.createdBy : null,
    })
  }

  return { classes, accounts, sessions, activities, skipped, warnings }
}

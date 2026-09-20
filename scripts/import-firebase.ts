/**
 * Import the Firebase prototype backup into the portal tables.
 *
 *   node --env-file=.env --import tsx scripts/import-firebase.ts <backup.json> [--dry-run] [--reset-pins]
 *
 * Idempotent: classes are upserted by id, accounts by legacyUid, memberships
 * are re-synced from the class docs. PINs are hashed on first import and left
 * alone on re-runs unless --reset-pins is passed. Safe to re-run at cutover
 * with a fresh export.
 */
import { readFileSync } from 'node:fs'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import { transformBackup, type BackupJson, type ImportAccount } from '../lib/portal/import-transform'
import { toUTCDate } from '../lib/portal/dates'

const args = process.argv.slice(2)
const file = args.find((a) => !a.startsWith('--'))
const dryRun = args.includes('--dry-run')
const resetPins = args.includes('--reset-pins')

if (!file) {
  console.error('usage: import-firebase.ts <backup.json> [--dry-run] [--reset-pins]')
  process.exit(1)
}

const backup = JSON.parse(readFileSync(file, 'utf8')) as BackupJson
const result = transformBackup(backup)

const byRole = result.accounts.reduce<Record<string, number>>((acc, a) => {
  acc[a.role] = (acc[a.role] ?? 0) + 1
  return acc
}, {})
const flagged = result.accounts.filter((a) => a.student?.importNotes)

console.log(`Export from ${backup.exportedAt}`)
console.log(`Classes: ${result.classes.length}`)
console.log(`Accounts: ${result.accounts.length}`, byRole)
console.log(`Sessions: ${result.sessions.map((s) => `${s.key}=${s.points}`).join(', ')}`)
console.log(`Custom activities: ${result.activities.length}`)
console.log(`Skipped users: ${result.skipped.length}`)
for (const s of result.skipped) console.log(`  - ${s.role} ${s.name || '(no name)'} [${s.legacyUid}]: ${s.reason}`)
console.log(`Warnings: ${result.warnings.length}`)
for (const w of result.warnings) console.log(`  - ${w}`)
console.log(`Students flagged for review: ${flagged.length}`)
for (const a of flagged) console.log(`  - ${a.displayName} (ID ${a.loginId}): ${a.student!.importNotes}`)

if (dryRun) {
  console.log('\nDry run: nothing written.')
  process.exit(0)
}

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL
const prisma = new PrismaClient({ datasources: { db: { url } } })

const date = (s: string | null) => (s ? toUTCDate(s) : null)
const ts = (s: string | null) => (s && !Number.isNaN(Date.parse(s)) ? new Date(s) : undefined)

async function upsertAccount(a: ImportAccount, legacyToAccountId: Map<string, string>) {
  const existing = await prisma.account.findUnique({ where: { legacyUid: a.legacyUid }, select: { id: true } })
  const pinHash = !existing || resetPins ? await bcrypt.hash(a.pin, 10) : undefined

  const account = await prisma.account.upsert({
    where: { legacyUid: a.legacyUid },
    create: {
      legacyUid: a.legacyUid,
      loginId: a.loginId,
      pinHash: pinHash!,
      role: a.role,
      displayName: a.displayName,
      email: a.email,
      phone: a.phone,
      photo: a.photo,
      createdAt: ts(a.createdAt),
    },
    update: {
      loginId: a.loginId,
      ...(pinHash ? { pinHash } : {}),
      role: a.role,
      displayName: a.displayName,
      email: a.email,
      phone: a.phone,
      photo: a.photo,
    },
    select: { id: true },
  })
  legacyToAccountId.set(a.legacyUid, account.id)

  if (a.student) {
    const s = a.student
    const data = {
      classId: s.classId,
      firstName: s.firstName,
      lastName: s.lastName,
      gender: s.gender,
      dob: date(s.dob),
      grade: s.grade,
      address: s.address,
      fatherName: s.fatherName,
      fatherPhone: s.fatherPhone,
      motherName: s.motherName,
      motherPhone: s.motherPhone,
      parentEmails: s.parentEmails,
      notes: s.notes,
      importNotes: s.importNotes,
    }
    await prisma.student.upsert({
      where: { accountId: account.id },
      create: { accountId: account.id, ...data },
      update: data,
    })
  }

  if (a.servant) {
    const s = a.servant
    const data = { birthday: date(s.birthday), address: s.address, stageOversight: s.stageOversight }
    const servant = await prisma.servant.upsert({
      where: { accountId: account.id },
      create: { accountId: account.id, ...data },
      update: data,
      select: { id: true },
    })
    await prisma.classServant.deleteMany({ where: { servantId: servant.id } })
    if (s.classes.length) {
      await prisma.classServant.createMany({
        data: s.classes.map((c, i) => ({ servantId: servant.id, classId: c.classId, title: c.title, sortOrder: i })),
      })
    }
  }
}

async function main() {
  console.log('\nWriting…')
  for (const c of result.classes) {
    const data = {
      name: c.name,
      stage: c.stage,
      sortOrder: c.sortOrder,
      description: c.description,
      visitationThreshold: c.visitationThreshold,
      curriculumLinkedToId: c.curriculumLinkedToId,
    }
    await prisma.schoolClass.upsert({
      where: { id: c.id },
      create: { id: c.id, ...data, createdAt: ts(c.createdAt) },
      update: data,
    })
  }
  console.log(`  classes: ${result.classes.length}`)

  for (const s of result.sessions) {
    const data = { label: s.label, points: s.points, sortOrder: s.sortOrder, icon: s.icon ?? null }
    await prisma.attendanceSession.upsert({ where: { key: s.key }, create: { key: s.key, ...data }, update: data })
  }
  console.log(`  sessions: ${result.sessions.length}`)

  const legacyToAccountId = new Map<string, string>()
  let n = 0
  for (const a of result.accounts) {
    await upsertAccount(a, legacyToAccountId)
    n++
    if (n % 50 === 0) console.log(`  accounts: ${n}/${result.accounts.length}`)
  }
  console.log(`  accounts: ${n}/${result.accounts.length}`)

  for (const act of result.activities) {
    const createdById = act.createdByLegacyUid ? legacyToAccountId.get(act.createdByLegacyUid) ?? null : null
    const data = { label: act.label, icon: act.icon, points: act.points, createdById }
    if (act.classId) {
      await prisma.pointActivity.upsert({
        where: { classId_key: { classId: act.classId, key: act.key } },
        create: { classId: act.classId, key: act.key, ...data },
        update: data,
      })
    } else {
      const existing = await prisma.pointActivity.findFirst({ where: { classId: null, key: act.key } })
      if (existing) await prisma.pointActivity.update({ where: { id: existing.id }, data })
      else await prisma.pointActivity.create({ data: { classId: null, key: act.key, ...data } })
    }
  }
  console.log(`  activities: ${result.activities.length}`)

  const counts = await Promise.all([
    prisma.schoolClass.count(),
    prisma.account.count(),
    prisma.student.count(),
    prisma.servant.count(),
    prisma.classServant.count(),
    prisma.attendanceSession.count(),
    prisma.pointActivity.count(),
  ])
  console.log('\nDatabase now holds:', {
    classes: counts[0], accounts: counts[1], students: counts[2], servants: counts[3],
    memberships: counts[4], sessions: counts[5], activities: counts[6],
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())

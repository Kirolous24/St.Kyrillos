/**
 * Seeds the portal's reference rows that the Firebase import did not carry:
 * the seven weekly servant activities. Idempotent — safe to re-run.
 *
 *   node --env-file=.env --import tsx scripts/seed-portal-reference.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Day numbers match JS getDay(): 0 = Sunday … 6 = Saturday.
const SERVANT_ACTIVITIES = [
  { key: 'friday_bible_study', label: 'Bible Study', dayOfWeek: 5, sortOrder: 10 },
  { key: 'saturday_vespers', label: 'Vespers', dayOfWeek: 6, sortOrder: 20 },
  { key: 'saturday_hymns', label: 'Hymns Class', dayOfWeek: 6, sortOrder: 30 },
  { key: 'saturday_tasbeha', label: 'Tasbeha', dayOfWeek: 6, sortOrder: 40 },
  { key: 'sunday_liturgy', label: 'Divine Liturgy', dayOfWeek: 0, sortOrder: 50 },
  { key: 'sunday_school', label: 'Sunday School', dayOfWeek: 0, sortOrder: 60 },
  { key: 'servants_meeting', label: 'Servants Meeting', dayOfWeek: 0, sortOrder: 70 },
]

async function main() {
  for (const a of SERVANT_ACTIVITIES) {
    await prisma.servantActivity.upsert({
      where: { key: a.key },
      update: { label: a.label, dayOfWeek: a.dayOfWeek, sortOrder: a.sortOrder },
      create: { ...a, isActive: true },
    })
  }
  const count = await prisma.servantActivity.count()
  console.log(`ServantActivity rows: ${count}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())

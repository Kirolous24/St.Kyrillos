import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const seedEvents = [
  // Sunday (0)
  { dayOfWeek: 0, time: '8:00 AM', sortOrder: 480, title: 'Divine Liturgy', description: null },
  // Wednesday (3)
  { dayOfWeek: 3, time: '7:00 PM', sortOrder: 1140, title: 'Bible Study', description: null },
  // Friday (5)
  { dayOfWeek: 5, time: '7:00 PM', sortOrder: 1140, title: 'Youth Meeting', description: null },
]

async function main() {
  console.log('Seeding schedule events...')

  for (const event of seedEvents) {
    await prisma.scheduleEvent.create({ data: event })
  }

  console.log(`Seeded ${seedEvents.length} events.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

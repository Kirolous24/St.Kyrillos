import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

// Helper: get the next occurrence of a weekday from today
function nextWeekday(dayOfWeek: number): Date {
  const now = new Date()
  const diff = (dayOfWeek - now.getDay() + 7) % 7
  const date = new Date(now)
  date.setDate(now.getDate() + diff)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0) // noon UTC
}

const seedEvents = [
  { date: nextWeekday(0), time: "8:00 AM", sortOrder: 480, title: "Divine Liturgy", description: null, location: "Main Church", durationMinutes: 180 },
  { date: nextWeekday(3), time: "7:00 PM", sortOrder: 1140, title: "Bible Study", description: null, location: "Fellowship Hall", durationMinutes: 90 },
  { date: nextWeekday(5), time: "7:00 PM", sortOrder: 1140, title: "Youth Meeting", description: null, location: "Main Church", durationMinutes: 180 },
]

async function main() {
  console.log("Seeding schedule events...")

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

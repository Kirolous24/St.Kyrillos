import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

// ─── Templates ────────────────────────────────────────────────────────────────
// All times in 24-hr format. Durations in minutes.
// These are starting points — all events are editable in the admin preview
// before applying to the schedule.

const TEMPLATES = [
  // ─── Pascha (Holy) Week ──────────────────────────────────────────────────
  // Starts on Lazarus Saturday (dynamic date each year).
  // Apply this template with day 0 = Lazarus Saturday.
  {
    name: 'Pascha (Holy) Week',
    description: 'Lazarus Saturday through Resurrection Feast (9 days)',
    totalDays: 9,
    days: [
      {
        dayOffset: 0,
        label: 'Lazarus Saturday',
        events: [
          { title: 'Divine Liturgy', time: '08:00', durationMinutes: 120, location: 'Main Church', description: null },
          { title: "Vespers' Praises", time: '17:00', durationMinutes: 60, location: 'Main Church', description: null },
          { title: 'Offering of Evening Incense', time: '18:00', durationMinutes: 120, location: 'Main Church', description: null },
          { title: 'Midnight Praises', time: '20:00', durationMinutes: 120, location: 'Main Church', description: null },
        ],
      },
      {
        dayOffset: 1,
        label: 'Hosanna (Palm Sunday)',
        events: [
          { title: 'Divine Liturgy', time: '07:00', durationMinutes: 300, location: 'Main Church', description: null },
          { title: 'General Funeral', time: '12:00', durationMinutes: 60, location: 'Main Church', description: null },
          { title: 'Evening Pascha', time: '17:00', durationMinutes: 270, location: 'Main Church', description: null },
        ],
      },
      {
        dayOffset: 2,
        label: 'Paschal Monday',
        events: [
          { title: 'Morning Pascha: 1st & 3rd Hour Prayers', time: '06:00', durationMinutes: 90, location: 'Main Church', description: null },
          { title: 'Morning Pascha: 6th, 9th & 11th Hour Prayers', time: '10:00', durationMinutes: 180, location: 'Main Church', description: null },
          { title: 'Evening Pascha', time: '18:00', durationMinutes: 210, location: 'Main Church', description: null },
        ],
      },
      {
        dayOffset: 3,
        label: 'Paschal Tuesday',
        events: [
          { title: 'Morning Pascha: 1st & 3rd Hour Prayers', time: '06:00', durationMinutes: 90, location: 'Main Church', description: null },
          { title: 'Morning Pascha: 6th, 9th & 11th Hour Prayers', time: '10:00', durationMinutes: 180, location: 'Main Church', description: null },
          { title: 'Evening Pascha', time: '18:00', durationMinutes: 210, location: 'Main Church', description: null },
        ],
      },
      {
        dayOffset: 4,
        label: 'Paschal Wednesday',
        events: [
          { title: 'Morning Pascha: 1st & 3rd Hour Prayers', time: '06:00', durationMinutes: 90, location: 'Main Church', description: null },
          { title: 'Morning Pascha: 6th, 9th & 11th Hour Prayers', time: '10:00', durationMinutes: 180, location: 'Main Church', description: null },
          { title: 'Evening Pascha', time: '18:00', durationMinutes: 210, location: 'Main Church', description: null },
        ],
      },
      {
        dayOffset: 5,
        label: 'Covenant Thursday',
        events: [
          { title: 'Morning Pascha', time: '07:00', durationMinutes: 270, location: 'Main Church', description: null },
          { title: 'Lakkan (Foot Washing) Liturgy', time: '11:00', durationMinutes: 90, location: 'Main Church', description: null },
          { title: 'Divine Liturgy', time: '12:30', durationMinutes: 90, location: 'Main Church', description: null },
          { title: 'Evening Pascha', time: '17:00', durationMinutes: 270, location: 'Main Church', description: null },
        ],
      },
      {
        dayOffset: 6,
        label: 'Good Friday',
        events: [
          { title: 'Pascha Prayers', time: '07:30', durationMinutes: 570, location: 'Main Church', description: null },
          { title: 'Apocalypse Night', time: '23:00', durationMinutes: 300, location: 'Main Church', description: 'Ends ~4:00 AM Saturday morning' },
        ],
      },
      {
        dayOffset: 7,
        label: 'Joyous Saturday',
        events: [
          { title: 'Divine Liturgy', time: '04:00', durationMinutes: 120, location: 'Main Church', description: 'Continuation from Apocalypse Night' },
          { title: 'Midnight Praises', time: '18:00', durationMinutes: 60, location: 'Main Church', description: null },
          { title: 'Raising of Morning Incense', time: '19:00', durationMinutes: 60, location: 'Main Church', description: null },
          { title: 'Divine Liturgy', time: '19:30', durationMinutes: 300, location: 'Main Church', description: null },
        ],
      },
      {
        dayOffset: 8,
        label: 'Resurrection Feast (Easter)',
        events: [
          { title: 'Sunday School Celebration', time: '11:00', durationMinutes: 120, location: 'Church & Trailer Classrooms', description: 'Update duration as needed' },
          { title: 'Offering of Evening Incense', time: '18:00', durationMinutes: 60, location: 'Main Church', description: null },
        ],
      },
    ],
  },

  // ─── Nativity (Christmas) ────────────────────────────────────────────────
  // Fixed dates: Jan 6 (Eve) and Jan 7 (Feast).
  // Apply this template with day 0 = Jan 6.
  {
    name: 'Nativity (Christmas)',
    description: 'Jan 6 (Eve) and Jan 7 (Feast) — 2 days',
    totalDays: 2,
    days: [
      {
        dayOffset: 0,
        label: 'Nativity Eve (Jan 6)',
        events: [
          { title: 'Midnight Praises', time: '17:30', durationMinutes: 120, location: 'Main Church', description: null },
          { title: 'Offering of Morning Incense', time: '19:30', durationMinutes: 90, location: 'Main Church', description: null },
          { title: 'Divine Liturgy', time: '21:00', durationMinutes: 180, location: 'Main Church', description: null },
        ],
      },
      {
        dayOffset: 1,
        label: 'Nativity Feast (Jan 7)',
        events: [
          { title: 'Sunday School Celebration', time: '11:30', durationMinutes: 120, location: 'Church & Trailer Classrooms', description: null },
          { title: 'Bethlehem: The Living Nativity', time: '13:30', durationMinutes: 120, location: 'Main Church', description: null },
        ],
      },
    ],
  },

  // ─── Jonah's Fast ────────────────────────────────────────────────────────
  // 3-day fast (dynamic Coptic calendar date each year).
  // Times depend on the priest — update when applying.
  {
    name: "Jonah's Fast",
    description: 'Three-day fast with daily Divine Liturgy (3 days) — update times when applying',
    totalDays: 3,
    days: [
      {
        dayOffset: 0,
        label: "Jonah's Fast — Day 1",
        events: [
          { title: 'Divine Liturgy', time: '08:00', durationMinutes: 180, location: 'Main Church', description: 'Update time per priest schedule' },
        ],
      },
      {
        dayOffset: 1,
        label: "Jonah's Fast — Day 2",
        events: [
          { title: 'Divine Liturgy', time: '08:00', durationMinutes: 180, location: 'Main Church', description: 'Update time per priest schedule' },
        ],
      },
      {
        dayOffset: 2,
        label: "Jonah's Fast — Day 3",
        events: [
          { title: 'Divine Liturgy', time: '08:00', durationMinutes: 180, location: 'Main Church', description: 'Update time per priest schedule' },
        ],
      },
    ],
  },

  // ─── Feast of the Cross ──────────────────────────────────────────────────
  // Sept 17 (Coptic calendar). Single day.
  {
    name: 'Feast of the Cross',
    description: 'Feast of the Holy Cross — 1 day',
    totalDays: 1,
    days: [
      {
        dayOffset: 0,
        label: 'Feast of the Cross',
        events: [
          { title: 'Divine Liturgy', time: '08:00', durationMinutes: 180, location: 'Main Church', description: 'Update time per priest schedule' },
        ],
      },
    ],
  },

  // ─── Nayrouz (Coptic New Year) ───────────────────────────────────────────
  // Fixed dates: Sept 10 (Eve) and Sept 11 (Feast).
  // Apply this template with day 0 = Sept 10.
  {
    name: 'Nayrouz (Coptic New Year)',
    description: 'Sept 10 (Eve) and Sept 11 (Feast) — 2 days',
    totalDays: 2,
    days: [
      {
        dayOffset: 0,
        label: 'Nayrouz Eve (Sept 10)',
        events: [
          { title: 'Offering of Evening Incense', time: '17:30', durationMinutes: 60, location: 'Main Church', description: null },
        ],
      },
      {
        dayOffset: 1,
        label: 'Nayrouz Feast (Sept 11)',
        events: [
          { title: 'Divine Liturgy', time: '08:30', durationMinutes: 150, location: 'Main Church', description: null },
        ],
      },
    ],
  },
]

// ─── Seed ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Clearing existing templates...')
  await prisma.seasonTemplate.deleteMany()
  console.log('All templates deleted.')

  console.log('Seeding templates...')
  for (const tmpl of TEMPLATES) {
    await prisma.seasonTemplate.create({
      data: {
        name: tmpl.name,
        description: tmpl.description,
        totalDays: tmpl.totalDays,
        days: {
          create: tmpl.days.map((day) => ({
            dayOffset: day.dayOffset,
            label: day.label,
            events: {
              create: day.events.map((ev) => ({
                title: ev.title,
                time: ev.time,
                durationMinutes: ev.durationMinutes,
                location: ev.location,
                description: ev.description,
              })),
            },
          })),
        },
      },
    })
    console.log(`  ✓ ${tmpl.name} (${tmpl.totalDays} day${tmpl.totalDays > 1 ? 's' : ''})`)
  }

  console.log(`\nDone. Seeded ${TEMPLATES.length} templates.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

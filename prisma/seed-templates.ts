import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const TEMPLATES = [
  {
    name: 'Pascha (Holy) Week',
    description: 'Palm Sunday through Bright Saturday (8 days)',
    totalDays: 8,
    days: [
      { dayOffset: 0, label: 'Palm Sunday', events: [
        { title: 'Palm Sunday Liturgy', time: '08:00', durationMinutes: 240, location: 'Main Church', description: null },
      ]},
      { dayOffset: 1, label: 'Monday of Holy Week', events: [
        { title: 'Pascha Prayers', time: '09:00', durationMinutes: 180, location: 'Main Church', description: null },
      ]},
      { dayOffset: 2, label: 'Tuesday of Holy Week', events: [
        { title: 'Pascha Prayers', time: '09:00', durationMinutes: 180, location: 'Main Church', description: null },
      ]},
      { dayOffset: 3, label: 'Wednesday of Holy Week', events: [
        { title: 'Pascha Prayers', time: '09:00', durationMinutes: 180, location: 'Main Church', description: null },
      ]},
      { dayOffset: 4, label: 'Covenant Thursday', events: [
        { title: 'Covenant Thursday Liturgy', time: '08:00', durationMinutes: 240, location: 'Main Church', description: null },
      ]},
      { dayOffset: 5, label: 'Good Friday', events: [
        { title: 'Good Friday Service', time: '08:00', durationMinutes: 300, location: 'Main Church', description: null },
      ]},
      { dayOffset: 6, label: 'Joyous Saturday', events: [
        { title: 'Joyous Saturday Liturgy', time: '08:00', durationMinutes: 240, location: 'Main Church', description: null },
      ]},
      { dayOffset: 7, label: 'Resurrection (Easter)', events: [
        { title: 'Resurrection Service', time: '08:00', durationMinutes: 180, location: 'Main Church', description: null },
      ]},
    ],
  },
  {
    name: 'Nativity (Christmas)',
    description: 'Paramoun and Nativity services (2 days)',
    totalDays: 2,
    days: [
      { dayOffset: 0, label: 'Paramoun (Christmas Eve)', events: [
        { title: 'Paramoun Prayers', time: '09:00', durationMinutes: 240, location: 'Main Church', description: null },
      ]},
      { dayOffset: 1, label: 'Nativity (Christmas Day)', events: [
        { title: 'Nativity Liturgy', time: '08:00', durationMinutes: 240, location: 'Main Church', description: null },
      ]},
    ],
  },
  {
    name: 'Epiphany (Theophany)',
    description: 'Paramoun and Epiphany services (2 days)',
    totalDays: 2,
    days: [
      { dayOffset: 0, label: 'Paramoun of Epiphany', events: [
        { title: 'Paramoun Prayers', time: '09:00', durationMinutes: 240, location: 'Main Church', description: null },
      ]},
      { dayOffset: 1, label: 'Epiphany', events: [
        { title: 'Epiphany Liturgy', time: '08:00', durationMinutes: 240, location: 'Main Church', description: null },
      ]},
    ],
  },
  {
    name: 'Great Lent Friday',
    description: 'Special Lenten Friday service pattern (1 day)',
    totalDays: 1,
    days: [
      { dayOffset: 0, label: 'Lent Friday', events: [
        { title: 'Lent Friday Service', time: '09:00', durationMinutes: 180, location: 'Main Church', description: null },
      ]},
    ],
  },
  {
    name: 'Great Lent Wednesday',
    description: 'Special Lenten Wednesday service pattern (1 day)',
    totalDays: 1,
    days: [
      { dayOffset: 0, label: 'Lent Wednesday', events: [
        { title: 'Lent Wednesday Service', time: '09:00', durationMinutes: 180, location: 'Main Church', description: null },
      ]},
    ],
  },
]

async function main() {
  console.log("Seeding season templates...")

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
    console.log(`  Created: ${tmpl.name}`)
  }

  console.log(`Seeded ${TEMPLATES.length} templates.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

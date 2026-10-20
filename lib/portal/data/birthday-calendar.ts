import { prisma } from '@/lib/prisma'
import { birthdayCalendarIcs } from '../birthday-calendar'
import { churchToday, formatDateOnly } from '../dates'
import { loadPortalUser } from '../portal-user'
import { listVisibleClasses } from './classes'

/**
 * The calendar behind a servant's birthday link, or null when the link is
 * unknown, reset, or belongs to an account that is switched off or a child's.
 * The children are the ones the owner sees on the Birthdays page: the classes
 * visible to them, each child counted in their own class.
 */
export async function birthdayCalendarFor(token: string, now: Date = new Date()): Promise<string | null> {
  const user = await loadPortalUser({ calendarToken: token })
  if (!user || user.role === 'STUDENT') return null

  const classes = await listVisibleClasses(user)
  const students = await prisma.student.findMany({
    where: { classId: { in: classes.map((c) => c.id) }, dob: { not: null } },
    select: { id: true, firstName: true, lastName: true, dob: true, class: { select: { name: true } } },
  })

  return birthdayCalendarIcs({
    kids: students.map((s) => ({
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      dob: s.dob ? formatDateOnly(s.dob) : null,
      className: s.class?.name ?? '',
    })),
    today: churchToday(now),
    now,
  })
}

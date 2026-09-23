import { ageOn, addDays, daysBetween, daysUntilBirthday } from './dates'

export interface BirthdayPerson {
  id: string
  name: string
  dob: string | null
}

export interface UpcomingBirthday extends BirthdayPerson {
  dob: string
  daysUntil: number
  turning: number
  on: string
}

export function upcomingBirthdays<T extends BirthdayPerson>(
  people: T[],
  today: string,
  windowDays: number,
): Array<T & UpcomingBirthday> {
  const out: Array<T & UpcomingBirthday> = []
  for (const p of people) {
    if (!p.dob) continue
    const daysUntil = daysUntilBirthday(p.dob, today)
    if (daysUntil > windowDays) continue
    const on = addDays(today, daysUntil)
    out.push({ ...p, dob: p.dob, daysUntil, on, turning: ageOn(p.dob, on) })
  }
  return out.sort((a, b) => a.daysUntil - b.daysUntil || a.name.localeCompare(b.name))
}

/**
 * Everyone whose birthday falls in one calendar week, Monday to Sunday.
 *
 * The prototype's birthday board was the calendar week; the port used a rolling
 * seven days from today, so by Sunday every birthday from Monday to Saturday
 * had dropped off and the servants who wanted to greet those children never saw
 * them. A calendar week has to look backwards inside the week, which a
 * forward-only "upcoming" window cannot do.
 *
 * `daysUntil` is negative for a birthday already passed this week. Walking the
 * week's seven dates rather than doing arithmetic on the stored year keeps the
 * new-year boundary correct for free.
 */
export function birthdaysInWeek<T extends BirthdayPerson>(
  people: T[],
  weekStartMonday: string,
  today: string,
): Array<T & UpcomingBirthday> {
  const out: Array<T & UpcomingBirthday> = []
  for (let i = 0; i < 7; i++) {
    const on = addDays(weekStartMonday, i)
    const monthDay = on.slice(5)
    const sameDay = people
      .filter((p) => p.dob && p.dob.slice(5) === monthDay)
      .sort((a, b) => a.name.localeCompare(b.name))
    for (const p of sameDay) {
      out.push({ ...p, dob: p.dob as string, on, daysUntil: daysBetween(today, on), turning: ageOn(p.dob as string, on) })
    }
  }
  return out
}


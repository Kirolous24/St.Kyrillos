import { ageOn, addDays, daysUntilBirthday } from './dates'

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

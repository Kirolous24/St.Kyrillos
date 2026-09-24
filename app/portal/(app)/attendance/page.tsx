import { CalendarCheck } from 'lucide-react'
import { requirePortalUser } from '@/lib/portal/session'
import { resolveClassEntry } from '@/lib/portal/data/class-entry'
import { ClassChoice } from '@/components/portal/ClassChoice'

export const metadata = { title: 'Attendance' }

export default async function AttendanceEntryPage() {
  const user = await requirePortalUser()
  const classes = await resolveClassEntry(user, '/attendance', 'attendance.write')
  return (
    <ClassChoice
      title="Take Attendance"
      subtitle="Mark who is present — pick a class"
      classes={classes}
      suffix="/attendance"
      icon={<CalendarCheck className="h-5 w-5" />}
    />
  )
}

import { Users } from 'lucide-react'
import { requirePortalUser } from '@/lib/portal/session'
import { resolveClassEntry } from '@/lib/portal/data/class-entry'
import { ClassChoice } from '@/components/portal/ClassChoice'

export const metadata = { title: 'Students' }

export default async function StudentsEntryPage() {
  const user = await requirePortalUser()
  // A Fellowship meeting's members are listed on its page (2026-10-24).
  const classes = await resolveClassEntry(user, '', 'class.read', { fellowship: 'include' })
  return (
    <ClassChoice
      title="Students"
      subtitle="Class roster — pick a class"
      classes={classes}
      suffix=""
      icon={<Users className="h-5 w-5" />}
    />
  )
}

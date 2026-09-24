import { Sparkles } from 'lucide-react'
import { requirePortalUser } from '@/lib/portal/session'
import { resolveClassEntry } from '@/lib/portal/data/class-entry'
import { ClassChoice } from '@/components/portal/ClassChoice'

export const metadata = { title: 'Points' }

export default async function PointsEntryPage() {
  const user = await requirePortalUser()
  const classes = await resolveClassEntry(user, '/points', 'points.write')
  return (
    <ClassChoice
      title="Points"
      subtitle="Give and remove points — pick a class"
      classes={classes}
      suffix="/points"
      icon={<Sparkles className="h-5 w-5" />}
    />
  )
}

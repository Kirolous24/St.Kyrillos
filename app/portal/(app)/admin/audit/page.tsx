import { notFound } from 'next/navigation'
import { ScrollText } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '@/lib/portal/session'
import { PageHeader, Card, Avatar, Badge, EmptyState } from '@/components/portal/ui'
import { CHURCH_TIMEZONE } from '@/lib/portal/dates'

export const metadata = { title: 'Activity log' }

const dayLabel = new Intl.DateTimeFormat('en-US', {
  timeZone: CHURCH_TIMEZONE,
  weekday: 'long',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})
const timeLabel = new Intl.DateTimeFormat('en-US', {
  timeZone: CHURCH_TIMEZONE,
  hour: 'numeric',
  minute: '2-digit',
})

export default async function AuditPage() {
  const user = await requirePortalUser()
  if (user.role !== 'ADMIN' && user.role !== 'PASTOR') notFound()
  const rows = await prisma.portalAuditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 300 })

  // Group the timeline by the day each action happened, in church time.
  const days: Array<{ label: string; entries: typeof rows }> = []
  for (const r of rows) {
    const label = dayLabel.format(r.createdAt)
    const last = days[days.length - 1]
    if (last && last.label === label) last.entries.push(r)
    else days.push({ label, entries: [r] })
  }

  return (
    <>
      <PageHeader title="Activity log" subtitle="The last 300 actions taken in the portal" icon={<ScrollText className="h-5 w-5" />} />
      {rows.length === 0 ? (
        <EmptyState title="Nothing yet" hint="Every change made in the portal is recorded here." />
      ) : (
        <div className="space-y-4">
          {days.map((day) => (
            <Card
              key={day.label}
              title={day.label}
              icon={<ScrollText className="h-4 w-4" />}
              action={<span className="text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">{day.entries.length}</span>}
            >
              <ol className="relative ml-1.5 space-y-4 border-l-2 border-brand-gold/30 pl-5">
                {day.entries.map((r) => (
                  <li key={r.id} className="relative flex items-start gap-3">
                    <span aria-hidden className="absolute -left-[26px] top-1.5 h-3 w-3 rounded-full bg-brand-gold ring-2 ring-parch-50" />
                    <Avatar name={r.actorName} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[12.5px] font-bold text-parch-900">{r.actorName}</span>
                        <Badge tone="brand">{r.action}</Badge>
                      </div>
                      {r.detail && <p className="mt-1 break-words text-[12.5px] leading-relaxed text-parch-700">{r.detail}</p>}
                    </div>
                    <span className="shrink-0 pt-0.5 text-[11px] tabular-nums text-parch-500">{timeLabel.format(r.createdAt)}</span>
                  </li>
                ))}
              </ol>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}

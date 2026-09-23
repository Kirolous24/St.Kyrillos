import { notFound } from 'next/navigation'
import { ClipboardList, Link2, Users } from 'lucide-react'
import { requirePortalUser } from '@/lib/portal/session'
import { listVisibleClasses, requireClassAccess } from '@/lib/portal/data/classes'
import { loadAgendaWeek } from '@/lib/portal/data/agenda'
import { normaliseWeekStart, schoolYearWeeks } from '@/lib/portal/agenda'
import { WeekSheetPicker } from './WeekSheetPicker'
import { mondayOf, todayInNewYork } from '@/lib/portal/dates'
import { Avatar, PageHeader, Card, EmptyState, Badge, LinkButton } from '@/components/portal/ui'
import { PrintButton } from '@/components/portal/PrintButton'
import { cn } from '@/lib/utils'

export const metadata = { title: 'Weekly assignments' }

/** The one-page "who is doing what this week" sheet servants print and carry. */
export default async function AgendaWeekPage({
  searchParams,
}: {
  searchParams: { class?: string; week?: string }
}) {
  const user = await requirePortalUser()
  if (user.role === 'STUDENT') notFound()

  const classes = await listVisibleClasses(user)
  if (classes.length === 0) {
    return (
      <>
        <PageHeader title="Weekly assignments" icon={<ClipboardList className="h-5 w-5" aria-hidden />} />
        <EmptyState title="No classes yet" />
      </>
    )
  }

  const classId = classes.some((c) => c.id === searchParams.class) ? searchParams.class! : classes[0]!.id
  const cls = await requireClassAccess(user, classId, 'class.read')
  const today = todayInNewYork()
  const week = normaliseWeekStart(searchParams.week) ?? mondayOf(today)
  const view = await loadAgendaWeek(cls.id, week)

  const assigned = view.grid.rows.filter((r) => r.servantName)
  const byServant = new Map<string, string[]>()
  for (const row of assigned) {
    const list = byServant.get(row.servantName!)
    if (list) list.push(row.label)
    else byServant.set(row.servantName!, [row.label])
  }
  const roster = Array.from(byServant.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  const backHref = `/portal/agenda?class=${encodeURIComponent(cls.id)}&week=${view.weekStart}`

  return (
    <div className="portal-print-page">
      <PageHeader
        title="Weekly assignments"
        icon={<ClipboardList className="h-5 w-5" aria-hidden />}
        subtitle={`${cls.name} · ${view.label}`}
        back={{ href: backHref, label: 'Back to the schedule' }}
        actions={
          <>
            <LinkButton href={backHref} variant="secondary">Edit the week</LinkButton>
            <PrintButton label="Print" />
          </>
        }
      />

      <WeekSheetPicker
        classId={cls.id}
        classes={classes.map((c) => ({ id: c.id, name: c.name }))}
        week={view.weekStart}
        weeks={schoolYearWeeks(today)}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title="Running order" icon={<ClipboardList className="h-4 w-4" aria-hidden />} bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="bg-[#F3EFE6]">
                    <th scope="col" className="w-9 px-3 py-3 text-left text-[12px] font-bold text-brand-800">#</th>
                    <th scope="col" className="px-4 py-3 text-left text-[12px] font-bold text-brand-800">Activity / Service</th>
                    <th scope="col" className="px-4 py-3 text-left text-[12px] font-bold text-brand-800">Topic &amp; Content</th>
                    <th scope="col" className="px-4 py-3 text-center text-[12px] font-bold text-brand-800">Assigned Servant</th>
                  </tr>
                </thead>
                <tbody>
                  {view.grid.rows.map((row, i) => (
                    <tr key={row.key}>
                      <td className="border-b border-[#F0EEE8] px-3 py-3 tabular-nums text-parch-400">{i + 1}</td>
                      <td className="whitespace-nowrap border-b border-[#F0EEE8] px-4 py-3 font-semibold text-parch-900">
                        {row.label}
                      </td>
                      <td className={cn('border-b border-[#F0EEE8] px-4 py-3', row.topic ? 'text-[#374151]' : 'text-parch-500')}>
                        {row.topic ?? '—'}
                      </td>
                      <td
                        className={cn(
                          'whitespace-nowrap border-b border-[#F0EEE8] px-4 py-3 text-center',
                          row.servantName ? 'text-[#374151]' : 'text-parch-500',
                        )}
                      >
                        {row.servantName ?? 'Unassigned'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="This week">
            <dl className="space-y-3">
              <div>
                <dt className="mb-0.5 text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">Lead servant</dt>
                <dd className="text-[12.5px] font-semibold text-parch-800">{view.leadServantName ?? '—'}</dd>
              </div>
              <div>
                <dt className="mb-0.5 text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">Backup servant</dt>
                <dd className="text-[12.5px] font-semibold text-parch-800">{view.backupServantName ?? '—'}</dd>
              </div>
              <div>
                <dt className="mb-1 text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">Activities covered</dt>
                <dd>
                  <Badge tone={assigned.length > 0 ? 'gold' : 'neutral'}>{assigned.length} of 10 assigned</Badge>
                </dd>
              </div>
              {view.slideLink && (
                <div>
                  <dt className="mb-1 text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">Slides</dt>
                  <dd>
                    <a
                      href={view.slideLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-gold bg-brand-wash px-3 py-1.5 text-[11.5px] font-bold text-brand-gold-dark"
                    >
                      <Link2 className="h-3.5 w-3.5" aria-hidden /> Open Slides
                    </a>
                    <span className="mt-1 block break-all text-[11px] text-parch-500">{view.slideLink}</span>
                  </dd>
                </div>
              )}
            </dl>
          </Card>

          <Card title="Who is doing what" icon={<Users className="h-4 w-4" aria-hidden />} bodyClassName="p-0">
            {roster.length === 0 ? (
              <p className="p-[18px] text-[12.5px] text-parch-500">Nobody is assigned yet this week.</p>
            ) : (
              <ul>
                {roster.map(([name, activities]) => (
                  <li
                    key={name}
                    className="flex items-center gap-3 border-b-[0.5px] border-[#F0EEE8] px-[18px] py-3 last:border-b-0"
                  >
                    <Avatar name={name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold text-parch-900">{name}</p>
                      <p className="text-[12px] text-parch-500">{activities.join(' · ')}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {view.notes && (
            <Card title="Notes">
              <p className="whitespace-pre-line text-[12.5px] leading-relaxed text-parch-700">{view.notes}</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

import { redirect } from 'next/navigation'
import { ClipboardList, Percent, Plus, Send, Upload } from 'lucide-react'
import { requirePortalUser } from '@/lib/portal/session'
import { listVisibleClasses } from '@/lib/portal/data/classes'
import { listExams, assignableClasses } from '@/lib/portal/data/exams'
import { todayInNewYork } from '@/lib/portal/dates'
import { PageHeader, StatCard, LinkButton } from '@/components/portal/ui'
import { ClassPicker } from '@/components/portal/ClassPicker'
import { ExamsTable } from './ExamsFilter'

export const metadata = { title: 'Exams' }

export default async function ExamsPage({ searchParams }: { searchParams: { class?: string } }) {
  const user = await requirePortalUser()
  if (user.role === 'STUDENT') redirect('/portal/quizzes')

  const classes = await listVisibleClasses(user)
  const selected = classes.some((c) => c.id === searchParams.class) ? searchParams.class! : 'all'
  const [rows, writable] = await Promise.all([
    listExams(user, selected === 'all' ? null : selected),
    assignableClasses(user),
  ])
  const canWrite = writable.length > 0
  const today = todayInNewYork()

  const open = rows.filter((r) => r.status === 'PUBLISHED' && (!r.dueDate || r.dueDate >= today))
  const submissions = rows.reduce((n, r) => n + r.submittedCount, 0)
  const scored = rows.filter((r) => r.averagePercentage !== null)
  const average = scored.length ? Math.round(scored.reduce((n, r) => n + (r.averagePercentage ?? 0), 0) / scored.length) : null

  return (
    <>
      <PageHeader
        title="Exams & Quizzes"
        icon={<ClipboardList className="h-[18px] w-[18px]" aria-hidden />}
        subtitle={
          <>
            {rows.length} exam{rows.length === 1 ? '' : 's'} ·{' '}
            {selected === 'all' ? 'every class you serve' : classes.find((c) => c.id === selected)?.name}
          </>
        }
        actions={
          canWrite ? (
            <>
              <LinkButton href="/portal/exams/import" variant="secondary">
                <Upload className="h-4 w-4" aria-hidden /> Import CSV
              </LinkButton>
              <LinkButton href="/portal/exams/new">
                <Plus className="h-4 w-4" aria-hidden /> New exam
              </LinkButton>
            </>
          ) : undefined
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Open now"
          value={open.length}
          hint={`${rows.length} exam${rows.length === 1 ? '' : 's'} in total`}
          tone="brand"
          icon={<ClipboardList className="h-5 w-5" aria-hidden />}
        />
        <StatCard
          label="Submissions"
          value={submissions}
          hint="Across the exams listed"
          accent="#2563EB"
          icon={<Send className="h-5 w-5" aria-hidden />}
        />
        <StatCard
          label="Average score"
          value={average === null ? '—' : `${average}%`}
          hint="Mean of each exam's average"
          tone={average !== null && average >= 60 ? 'good' : average === null ? 'default' : 'warn'}
          icon={<Percent className="h-5 w-5" aria-hidden />}
        />
      </div>

      {classes.length > 1 && (
        <div className="mb-4">
          <ClassPicker value={selected} options={classes.map((c) => ({ id: c.id, name: c.name }))} allowAll />
        </div>
      )}

      <ExamsTable rows={rows} today={today} canWrite={canWrite} />
    </>
  )
}

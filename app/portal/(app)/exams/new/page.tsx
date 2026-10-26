import { notFound } from 'next/navigation'
import { FilePlus2 } from 'lucide-react'
import { requirePortalUser } from '@/lib/portal/session'
import { postableClasses } from '@/lib/portal/data/exams'
import { mayAuthorExams } from '@/lib/portal/exams'
import { LinkButton, PageHeader } from '@/components/portal/ui'
import { ExamEditor } from './ExamEditor'

export const metadata = { title: 'New exam' }

export default async function NewExamPage({ searchParams }: { searchParams: { class?: string } }) {
  const user = await requirePortalUser()
  // Role first: authoring is staff-only. The list below can be non-empty for a
  // student (their own class), so length alone is not a gate.
  if (!mayAuthorExams(user)) notFound()
  // Every class it may go to (2026-10-26); it is written in one the servant
  // looks after, since that is the exam they land on afterwards.
  const targets = await postableClasses(user)
  const classes = targets.filter((c) => !c.postOnly)
  // No class you may write to means this page does not exist for you.
  if (classes.length === 0) notFound()

  const preferred =
    classes.find((c) => c.id === searchParams.class) ?? classes.find((c) => user.classIds.includes(c.id)) ?? classes[0]!
  const ordered = [preferred, ...classes.filter((c) => c.id !== preferred.id)]

  return (
    <>
      <PageHeader
        title="New exam"
        icon={<FilePlus2 className="h-[18px] w-[18px]" aria-hidden />}
        subtitle="Write the questions here, or import a whole quiz from a spreadsheet."
        back={{ href: '/portal/exams', label: 'Exams' }}
        actions={
          <LinkButton href="/portal/exams/import" variant="secondary">
            Import CSV instead
          </LinkButton>
        }
      />
      <ExamEditor
        classes={ordered.map((c) => ({ id: c.id, name: c.name }))}
        alsoClasses={targets.map((c) => ({ id: c.id, name: c.name, postOnly: c.postOnly }))}
      />
    </>
  )
}

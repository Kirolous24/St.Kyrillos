import { notFound } from 'next/navigation'
import { Upload } from 'lucide-react'
import { requirePortalUser } from '@/lib/portal/session'
import { postableClasses } from '@/lib/portal/data/exams'
import { mayAuthorExams } from '@/lib/portal/exams'
import { LinkButton, PageHeader } from '@/components/portal/ui'
import { ExamImport } from './ExamImport'

export const metadata = { title: 'Import quizzes' }

export default async function ImportExamsPage() {
  const user = await requirePortalUser()
  if (!mayAuthorExams(user)) notFound()
  // Imported into a class the servant looks after, and posted to the others
  // they tick (2026-10-26).
  const targets = await postableClasses(user)
  const classes = targets.filter((c) => !c.postOnly)
  if (classes.length === 0) notFound()
  const preferred = classes.find((c) => user.classIds.includes(c.id)) ?? classes[0]!
  const ordered = [preferred, ...classes.filter((c) => c.id !== preferred.id)]

  return (
    <>
      <PageHeader
        title="Import quizzes"
        icon={<Upload className="h-[18px] w-[18px]" aria-hidden />}
        subtitle="Bring a whole term of quizzes in from a spreadsheet."
        back={{ href: '/portal/exams', label: 'Exams' }}
        actions={
          <LinkButton href="/portal/exams/new" variant="secondary">
            Write one by hand
          </LinkButton>
        }
      />
      <ExamImport
        classes={ordered.map((c) => ({ id: c.id, name: c.name }))}
        alsoClasses={targets.map((c) => ({ id: c.id, name: c.name, postOnly: c.postOnly }))}
      />
    </>
  )
}

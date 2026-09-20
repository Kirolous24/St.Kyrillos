import { notFound } from 'next/navigation'
import { Upload } from 'lucide-react'
import { requirePortalUser } from '@/lib/portal/session'
import { assignableClasses } from '@/lib/portal/data/exams'
import { mayAuthorExams } from '@/lib/portal/exams'
import { LinkButton, PageHeader } from '@/components/portal/ui'
import { ExamImport } from './ExamImport'

export const metadata = { title: 'Import quizzes' }

export default async function ImportExamsPage() {
  const user = await requirePortalUser()
  if (!mayAuthorExams(user)) notFound()
  const classes = await assignableClasses(user)
  if (classes.length === 0) notFound()

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
      <ExamImport classes={classes.map((c) => ({ id: c.id, name: c.name }))} />
    </>
  )
}

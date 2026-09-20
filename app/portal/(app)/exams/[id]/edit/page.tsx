import { notFound } from 'next/navigation'
import { Pencil } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '@/lib/portal/session'
import { requireExamWrite, examQuestions } from '@/lib/portal/data/exams'
import { formatDateOnly } from '@/lib/portal/dates'
import { mayAuthorExams } from '@/lib/portal/exams'
import { PageHeader } from '@/components/portal/ui'
import { ExamEditor } from '../../new/ExamEditor'

export const metadata = { title: 'Edit exam' }

export default async function EditExamPage({ params }: { params: { id: string } }) {
  const user = await requirePortalUser()
  if (!mayAuthorExams(user)) notFound()
  const exam = await requireExamWrite(user, params.id)
  const [questions, resultCount] = await Promise.all([
    examQuestions(exam.id),
    prisma.quizResult.count({ where: { examId: exam.id } }),
  ])

  return (
    <>
      <PageHeader
        title="Edit exam"
        icon={<Pencil className="h-[18px] w-[18px]" aria-hidden />}
        subtitle={
          <>
            {exam.title} · {exam.class?.name ?? 'Stage-wide'} · {questions.length} question
            {questions.length === 1 ? '' : 's'}
          </>
        }
        back={{ href: `/portal/exams/${exam.id}`, label: exam.title }}
      />
      <ExamEditor
        classes={exam.class ? [{ id: exam.class.id, name: exam.class.name }] : []}
        hasResults={resultCount > 0}
        exam={{
          id: exam.id,
          classId: exam.classId ?? '',
          title: exam.title,
          subject: exam.subject ?? '',
          dueDate: exam.dueDate ? formatDateOnly(exam.dueDate) : '',
          pointsPerQuestion: exam.pointsPerQuestion,
          bibleReading: exam.bibleReading ?? '',
          readingMessage: exam.readingMessage ?? '',
          status: exam.status,
          questions: questions.map((q) => ({ id: q.id, text: q.text, options: q.options, correctIndex: q.correctIndex })),
        }}
      />
    </>
  )
}

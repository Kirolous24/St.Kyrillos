import { notFound, redirect } from 'next/navigation'
import { BookOpen, ClipboardList } from 'lucide-react'
import { requirePortalUser } from '@/lib/portal/session'
import { studentExamPaper } from '@/lib/portal/data/exams'
import { examStatusFor } from '@/lib/portal/exams'
import { todayInNewYork } from '@/lib/portal/dates'
import { formatLongDate } from '@/lib/portal/format'
import { Card, EmptyState, LinkButton, PageHeader } from '@/components/portal/ui'
import { QuizTaker } from './QuizTaker'

export const metadata = { title: 'Take quiz' }

export default async function TakeQuizPage({ params }: { params: { id: string } }) {
  const user = await requirePortalUser()
  if (user.role !== 'STUDENT' || !user.studentId) redirect(`/portal/exams/${params.id}`)

  const paper = await studentExamPaper(user.studentId, params.id)
  if (!paper) notFound()
  if (paper.alreadySubmitted) redirect(`/portal/quizzes/${paper.id}/review`)

  const status = examStatusFor(
    { id: paper.id, status: paper.status, dueDate: paper.dueDate, reopenedFor: paper.reopenedFor },
    user.studentId,
    [],
    todayInNewYork(),
  )

  if (status !== 'available') {
    return (
      <>
        <PageHeader title={paper.title} back={{ href: '/portal/quizzes', label: 'Quizzes' }} />
        <EmptyState
          title={status === 'missed' ? 'This quiz has closed' : 'Not open yet'}
          hint={
            status === 'missed'
              ? `It was due ${paper.dueDate ? formatLongDate(paper.dueDate) : 'earlier'}. Ask your servant to reopen it for you.`
              : 'Your servant has not published this quiz yet.'
          }
          action={<LinkButton href="/portal/quizzes" variant="secondary">Back to quizzes</LinkButton>}
        />
      </>
    )
  }

  if (paper.questions.length === 0) {
    return (
      <>
        <PageHeader title={paper.title} back={{ href: '/portal/quizzes', label: 'Quizzes' }} />
        <EmptyState title="This quiz has no questions yet" hint="Check back later." />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={paper.title}
        icon={<ClipboardList className="h-[18px] w-[18px]" aria-hidden />}
        subtitle={
          <>
            {paper.subject ? `${paper.subject} · ` : ''}
            {paper.questions.length} question{paper.questions.length === 1 ? '' : 's'} ·{' '}
            {paper.dueDate ? `due ${formatLongDate(paper.dueDate)}` : 'no deadline'}
          </>
        }
        back={{ href: '/portal/quizzes', label: 'Quizzes' }}
      />

      {(paper.bibleReading || paper.readingMessage) && (
        <div className="mb-4">
          <Card
            className="border-[#EFE4C8] border-l-brand-gold"
            bodyClassName="bg-brand-wash p-[18px]"
            title={paper.bibleReading ? `Today's reading: ${paper.bibleReading}` : 'Before you start'}
            icon={<BookOpen className="h-4 w-4" aria-hidden />}
          >
            <p className="whitespace-pre-line text-[12.5px] leading-relaxed text-[#633806]">
              {paper.readingMessage ?? 'Read the passage before answering.'}
            </p>
          </Card>
        </div>
      )}

      <QuizTaker
        examId={paper.id}
        title={paper.title}
        pointsPerQuestion={paper.pointsPerQuestion}
        questions={paper.questions.map((q) => ({ id: q.id, text: q.text, options: q.options }))}
      />
    </>
  )
}

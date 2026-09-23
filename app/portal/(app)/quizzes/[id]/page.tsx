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
          {/* F0326 — the prototype put the reading behind its own chevron and the
              servant's note underneath it, in italics. The port hoisted the
              reference into the card's TITLE and showed only the note in the body,
              so a child opening a quiz read a heading and then a sentence that was
              not the passage, with nothing to open. The title is fixed now, the
              reference is the summary, and the passage itself renders pre-line so a
              multi-line devotional keeps its shape. Open by default when there is
              no reference to collapse, so a note-only quiz still shows its note. */}
          <Card
            className="border-[#EFE4C8] border-l-brand-gold"
            bodyClassName="bg-brand-wash p-[18px]"
            title="Today’s Bible Reading"
            icon={<BookOpen className="h-4 w-4" aria-hidden />}
          >
            <details className="group" open={!paper.bibleReading}>
              <summary className="flex min-h-[40px] cursor-pointer list-none items-center justify-between gap-3 text-[12.5px] font-bold text-[#633806]">
                <span className="min-w-0 truncate">
                  {paper.bibleReading ? paper.bibleReading.split('\n')[0] : 'Before you start'}
                </span>
                <span aria-hidden className="shrink-0 text-[12px] text-[#8B5A0F] group-open:hidden">▾</span>
                <span aria-hidden className="hidden shrink-0 text-[12px] text-[#8B5A0F] group-open:inline">▴</span>
              </summary>
              <div className="mt-2.5 space-y-2">
                {paper.bibleReading?.includes('\n') && (
                  <p className="whitespace-pre-line text-[12.5px] leading-relaxed text-[#633806]">
                    {paper.bibleReading}
                  </p>
                )}
                <p className="whitespace-pre-line text-[12.5px] italic leading-relaxed text-[#8B5A0F]">
                  ✨ {paper.readingMessage ?? 'Read the passage before answering.'}
                </p>
              </div>
            </details>
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

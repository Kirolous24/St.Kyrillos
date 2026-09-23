'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '../session'
import { assertClassAction } from '../data/classes'
import { assertExamWrite, studentExamPaper, EXAM_WRITE } from '../data/exams'
import { runAction, PortalError, type ActionResult } from '../action-result'
import { parseDateOnly, toUTCDate, todayInNewYork } from '../dates'
import { parseCsvRecords } from '../csv'
import {
  compactQuestion,
  examStatusFor,
  gradeSubmission,
  parseExamCsv,
  quizActivityLabel,
  quizPointReason,
  MAX_OPTIONS,
  MAX_QUESTIONS,
  type QuestionDraft,
  type RowError,
} from '../exams'
import { audit } from '../audit'

/* ── Schemas ──────────────────────────────────────────────────────────────── */

const QuestionSchema = z.object({
  id: z.string().min(1).optional(),
  text: z.string().max(600),
  options: z.array(z.string().max(300)).min(1).max(MAX_OPTIONS),
  correctIndex: z.number().int().min(0).max(MAX_OPTIONS - 1),
})

const ExamSchema = z.object({
  classId: z.string().min(1),
  title: z.string().trim().min(1).max(160),
  subject: z.string().trim().max(120).optional(),
  dueDate: z.string().max(40).optional(),
  pointsPerQuestion: z.number().int().min(1).max(100),
  /**
   * F0324 — 2000, not 300, and the form gives it more than one line. The
   * prototype took a multi-line passage: a servant setting "Mark 1-3, and read
   * the footnotes on the parable" ran out of room at 300 characters, and the
   * single-line input made a long entry unreadable while typing it. Relaxing one
   * side alone is worse than leaving both — a taller box that zod still rejects
   * loses the servant's work at submit.
   */
  bibleReading: z.string().trim().max(2000).optional(),
  readingMessage: z.string().trim().max(2000).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'CLOSED']),
  questions: z.array(QuestionSchema).min(1).max(MAX_QUESTIONS),
})

export type ExamInput = z.infer<typeof ExamSchema>

/**
 * Validate every question, keeping each correct answer bound to its option
 * value through blank-option removal (the prototype shifted the key here —
 * ANALYSIS §6). Reports the question number so the editor can point at it.
 */
function cleanQuestions(questions: ExamInput['questions']): { text: string; options: string[]; correctIndex: number; id?: string }[] {
  return questions.map((q, i) => {
    const { question, error } = compactQuestion(q as QuestionDraft)
    if (!question) throw new PortalError(`Question ${i + 1}: ${error}`)
    return { ...question, id: q.id }
  })
}

function parseDue(raw: string | undefined): Date | null {
  if (!raw || !raw.trim()) return null
  const iso = parseDateOnly(raw)
  if (!iso) throw new PortalError('Pick a valid due date.')
  return toUTCDate(iso)
}

/**
 * F0024 / F0483 — is there already a quiz for this class on this date?
 *
 * Two quizzes for the same class on the same Sunday is almost always the second
 * servant not knowing about the first. The prototype's answer was to merge them,
 * which is worse than either: merging edits a quiz children may already have sat,
 * so their stored score and the quiz's question count end up disagreeing with
 * each other on a report card. A warning costs one sentence on the form and
 * leaves the servant in charge — they may well mean to set a second one.
 *
 * Read-only, and gated on the same permission as writing a quiz for that class.
 */
export async function findDuplicateExam(
  classId: string,
  dueDate: string,
  excludeExamId?: string,
): Promise<ActionResult<{ title: string; id: string } | null>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    if (!classId || !dueDate) return null
    const cls = await assertClassAction(user, classId, EXAM_WRITE)
    const due = parseDue(dueDate)
    if (!due) return null
    const existing = await prisma.exam.findFirst({
      where: {
        classId: cls.id,
        dueDate: due,
        ...(excludeExamId ? { id: { not: excludeExamId } } : {}),
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true, title: true },
    })
    return existing ?? null
  })
}

/* ── Create / update ──────────────────────────────────────────────────────── */

export async function createExam(raw: ExamInput): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const input = ExamSchema.parse(raw)
    const cls = await assertClassAction(user, input.classId, EXAM_WRITE)
    const questions = cleanQuestions(input.questions)
    const due = parseDue(input.dueDate)

    const exam = await prisma.exam.create({
      data: {
        classId: cls.id,
        stage: cls.stage,
        title: input.title,
        subject: input.subject || null,
        dueDate: due,
        pointsPerQuestion: input.pointsPerQuestion,
        bibleReading: input.bibleReading || null,
        readingMessage: input.readingMessage || null,
        status: input.status,
        createdById: user.accountId,
        questions: {
          create: questions.map((q, i) => ({ text: q.text, options: q.options, correctIndex: q.correctIndex, sortOrder: i })),
        },
      },
      select: { id: true },
    })

    await audit(user, 'exam.create', 'exam', exam.id, `${cls.name}: "${input.title}" (${questions.length} questions)`)
    revalidatePath('/portal/exams')
    revalidatePath('/portal/quizzes')
    revalidatePath('/portal')
    return { id: exam.id }
  })
}

const UpdateSchema = ExamSchema.extend({ examId: z.string().min(1) })

export async function updateExam(raw: z.infer<typeof UpdateSchema>): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const input = UpdateSchema.parse(raw)
    const exam = await assertExamWrite(user, input.examId)
    const cls = await assertClassAction(user, input.classId, EXAM_WRITE)
    if (exam.classId && exam.classId !== cls.id) {
      // Moving an exam between classes would orphan its results.
      throw new PortalError('An exam cannot be moved to another class once it exists.')
    }
    const questions = cleanQuestions(input.questions)
    const due = parseDue(input.dueDate)

    const existing = await prisma.examQuestion.findMany({ where: { examId: exam.id }, select: { id: true } })
    const existingIds = new Set(existing.map((q) => q.id))
    const keptIds = new Set(questions.map((q) => q.id).filter((id): id is string => !!id && existingIds.has(id)))
    const removed = existing.filter((q) => !keptIds.has(q.id)).map((q) => q.id)

    await prisma.$transaction(async (tx) => {
      await tx.exam.update({
        where: { id: exam.id },
        data: {
          title: input.title,
          subject: input.subject || null,
          dueDate: due,
          pointsPerQuestion: input.pointsPerQuestion,
          bibleReading: input.bibleReading || null,
          readingMessage: input.readingMessage || null,
          status: input.status,
        },
      })
      if (removed.length) await tx.examQuestion.deleteMany({ where: { id: { in: removed } } })
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i]!
        if (q.id && keptIds.has(q.id)) {
          await tx.examQuestion.update({
            where: { id: q.id },
            data: { text: q.text, options: q.options, correctIndex: q.correctIndex, sortOrder: i },
          })
        } else {
          await tx.examQuestion.create({
            data: { examId: exam.id, text: q.text, options: q.options, correctIndex: q.correctIndex, sortOrder: i },
          })
        }
      }
    })

    await audit(user, 'exam.update', 'exam', exam.id, `${cls.name}: "${input.title}" — ${questions.length} questions, ${removed.length} removed`)
    revalidatePath('/portal/exams')
    revalidatePath(`/portal/exams/${exam.id}`)
    revalidatePath(`/portal/exams/${exam.id}/edit`)
    revalidatePath('/portal/quizzes')
    return { id: exam.id }
  })
}

/* ── Status, reopen, delete ───────────────────────────────────────────────── */

const StatusSchema = z.object({ examId: z.string().min(1), status: z.enum(['DRAFT', 'PUBLISHED', 'CLOSED']) })

export async function setExamStatus(raw: z.infer<typeof StatusSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const input = StatusSchema.parse(raw)
    const exam = await assertExamWrite(user, input.examId)
    await prisma.exam.update({ where: { id: exam.id }, data: { status: input.status } })
    await audit(user, 'exam.status', 'exam', exam.id, `"${exam.title}" → ${input.status}`)
    revalidatePath('/portal/exams')
    revalidatePath(`/portal/exams/${exam.id}`)
    revalidatePath('/portal/quizzes')
    return undefined
  })
}

const ReopenSchema = z.object({ examId: z.string().min(1), studentIds: z.array(z.string().min(1)).max(500) })

/** Grant named students access after the due date (Exam.reopenedFor). */
export async function setReopenedStudents(raw: z.infer<typeof ReopenSchema>): Promise<ActionResult<{ count: number }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const input = ReopenSchema.parse(raw)
    const exam = await assertExamWrite(user, input.examId)
    if (!exam.classId) throw new PortalError('This exam is not attached to a class.')

    const roster = await prisma.student.findMany({
      where: { id: { in: input.studentIds }, classId: exam.classId },
      select: { id: true },
    })
    const ids = roster.map((s) => s.id)

    await prisma.exam.update({ where: { id: exam.id }, data: { reopenedFor: ids } })
    await audit(user, 'exam.reopen', 'exam', exam.id, `"${exam.title}": reopened for ${ids.length} student${ids.length === 1 ? '' : 's'}`)
    revalidatePath(`/portal/exams/${exam.id}`)
    revalidatePath('/portal/exams')
    revalidatePath('/portal/quizzes')
    return { count: ids.length }
  })
}

const BulkReopenSchema = z.object({
  examIds: z.array(z.string().min(1)).min(1).max(50),
  studentIds: z.array(z.string().min(1)).min(1).max(500),
})

/**
 * Reopen several exams at once for the same students, merging into each exam's
 * existing list rather than replacing it (OG L11448-11456).
 *
 * The merge is the point: a student who was already granted one overdue quiz
 * individually must not lose that grant because a later bulk action named a
 * different set. The single-exam action deliberately still replaces, because
 * that screen shows the current list and the servant is editing it directly.
 *
 * Each exam is permission-checked on its own, and students are filtered to the
 * roster of the exam being written, so one selection spanning two classes
 * grants each child only their own class's quizzes.
 */
export async function bulkReopenExams(
  raw: z.infer<typeof BulkReopenSchema>,
): Promise<ActionResult<{ exams: number; students: number }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const input = BulkReopenSchema.parse(raw)

    let touched = 0
    const granted = new Set<string>()
    for (const examId of input.examIds) {
      const exam = await assertExamWrite(user, examId)
      if (!exam.classId) continue
      const roster = await prisma.student.findMany({
        where: { id: { in: input.studentIds }, classId: exam.classId },
        select: { id: true },
      })
      if (roster.length === 0) continue
      const current = await prisma.exam.findUnique({ where: { id: exam.id }, select: { reopenedFor: true } })
      const merged = Array.from(new Set([...(current?.reopenedFor ?? []), ...roster.map((r) => r.id)]))
      await prisma.exam.update({ where: { id: exam.id }, data: { reopenedFor: merged } })
      for (const r of roster) granted.add(r.id)
      touched += 1
      revalidatePath(`/portal/exams/${exam.id}`)
    }

    if (touched === 0) throw new PortalError('None of those students are on the roster of the exams you picked.')
    await audit(user, 'exam.bulkReopen', 'exam', null, `Reopened ${touched} exam${touched === 1 ? '' : 's'} for ${granted.size} student${granted.size === 1 ? '' : 's'}`)
    revalidatePath('/portal/exams')
    revalidatePath('/portal/quizzes')
    return { exams: touched, students: granted.size }
  })
}

export async function deleteExams(examIds: string[]): Promise<ActionResult<{ deleted: number }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const ids = z.array(z.string().min(1)).min(1).max(100).parse(examIds)

    const allowed: { id: string; title: string }[] = []
    for (const id of ids) {
      const exam = await assertExamWrite(user, id)
      allowed.push({ id: exam.id, title: exam.title })
    }

    await prisma.$transaction(async (tx) => {
      // Results and answers cascade; the awarded quiz points do not, so clear
      // them here rather than leaving points that point at nothing.
      const reasons = allowed.map((e) => quizPointReason(e.id))
      const quizEntries = await tx.pointEntry.findMany({
        where: { source: 'QUIZ', reason: { in: reasons } },
        select: { id: true },
      })
      const quizIds = quizEntries.map((e) => e.id)
      if (quizIds.length > 0) {
        // An UNDO row mirrors a QUIZ row (source 'UNDO', reason null, negative
        // points). PointEntry.undoOf is SetNull, so deleting only the QUIZ row
        // would strand the -N correction and leave the student permanently
        // short on the leaderboard. Remove both halves together.
        await tx.pointEntry.deleteMany({
          where: { OR: [{ id: { in: quizIds } }, { undoOfId: { in: quizIds } }] },
        })
      }
      await tx.exam.deleteMany({ where: { id: { in: allowed.map((e) => e.id) } } })
    })

    await audit(user, 'exam.delete', 'exam', allowed[0]?.id ?? null, `Deleted ${allowed.length}: ${allowed.map((e) => e.title).join(', ').slice(0, 300)}`)
    revalidatePath('/portal/exams')
    revalidatePath('/portal/quizzes')
    revalidatePath('/portal/leaderboard')
    revalidatePath('/portal')
    return { deleted: allowed.length }
  })
}

/* ── CSV import ───────────────────────────────────────────────────────────── */

const ImportSchema = z.object({
  classId: z.string().min(1),
  csv: z.string().min(1).max(500_000),
  status: z.enum(['DRAFT', 'PUBLISHED']),
  // Only used by the prototype's Day-based sheet, which carries no Title and
  // no full date — the month those day numbers belong to is picked in the form.
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  pointsPerQuestion: z.number().int().min(1).max(100).optional(),
})

export interface ImportReport {
  created: { title: string; questions: number; dueDate: string | null }[]
  errors: RowError[]
}

export async function importExamsCsv(raw: z.infer<typeof ImportSchema>): Promise<ActionResult<ImportReport>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const input = ImportSchema.parse(raw)
    const cls = await assertClassAction(user, input.classId, EXAM_WRITE)

    const records = parseCsvRecords(input.csv)
    if (records.length === 0) throw new PortalError('That file has no rows under its header.')
    const { drafts, errors } = parseExamCsv(records, { month: input.month, pointsPerQuestion: input.pointsPerQuestion })
    if (drafts.length === 0) {
      throw new PortalError(
        errors.length
          ? `Nothing could be imported. First problem — row ${errors[0]!.row}: ${errors[0]!.message}`
          : 'No quizzes were found in that file.',
      )
    }
    if (drafts.length > 50) throw new PortalError('That file holds more than 50 quizzes. Split it up.')

    const created: ImportReport['created'] = []
    await prisma.$transaction(
      async (tx) => {
        for (const draft of drafts) {
          await tx.exam.create({
            data: {
              classId: cls.id,
              stage: cls.stage,
              title: draft.title,
              subject: draft.subject,
              dueDate: draft.dueDate ? toUTCDate(draft.dueDate) : null,
              pointsPerQuestion: draft.pointsPerQuestion,
              bibleReading: draft.bibleReading,
              readingMessage: draft.readingMessage,
              status: input.status,
              createdById: user.accountId,
              questions: {
                create: draft.questions.map((q, i) => ({
                  text: q.text,
                  options: q.options,
                  correctIndex: q.correctIndex,
                  sortOrder: i,
                })),
              },
            },
            select: { id: true },
          })
          created.push({ title: draft.title, questions: draft.questions.length, dueDate: draft.dueDate })
        }
      },
      { timeout: 60_000, maxWait: 10_000 },
    )

    await audit(user, 'exam.import', 'class', cls.id, `${cls.name}: imported ${created.length} quiz${created.length === 1 ? '' : 'zes'} (${errors.length} row error${errors.length === 1 ? '' : 's'})`)
    revalidatePath('/portal/exams')
    revalidatePath('/portal/quizzes')
    return { created, errors }
  })
}

/* ── Student submission ───────────────────────────────────────────────────── */

const SubmitSchema = z.object({
  examId: z.string().min(1),
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        chosenIndex: z.number().int().min(0).max(MAX_OPTIONS - 1).nullable(),
      }),
    )
    .max(MAX_QUESTIONS),
})

export interface SubmitResult {
  score: number
  total: number
  percentage: number
  correctCount: number
  questionCount: number
}

/**
 * Grade and record one student's quiz. The client sends only chosen indexes;
 * the questions, the key, the points per question and the class all come from
 * the database, so nothing the browser says can change the score.
 */
export async function submitQuiz(raw: z.infer<typeof SubmitSchema>): Promise<ActionResult<SubmitResult>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const input = SubmitSchema.parse(raw)
    if (user.role !== 'STUDENT' || !user.studentId) throw new PortalError('Only students can submit a quiz.')
    const studentId = user.studentId

    const paper = await studentExamPaper(studentId, input.examId)
    if (!paper) throw new PortalError('That quiz is not available to you.')
    if (paper.alreadySubmitted) throw new PortalError('You have already submitted this quiz.')

    const status = examStatusFor(
      { id: paper.id, status: paper.status, dueDate: paper.dueDate, reopenedFor: paper.reopenedFor },
      studentId,
      [],
      todayInNewYork(),
    )
    if (status !== 'available') throw new PortalError('This quiz is closed. Ask your servant to reopen it for you.')

    const questions = await prisma.examQuestion.findMany({
      where: { examId: paper.id },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, correctIndex: true, options: true },
    })
    if (questions.length === 0) throw new PortalError('This quiz has no questions yet.')

    const chosen: Record<string, number | null> = {}
    for (const a of input.answers) chosen[a.questionId] = a.chosenIndex
    const graded = gradeSubmission(
      questions.map((q) => ({ id: q.id, correctIndex: q.correctIndex, optionCount: q.options.length })),
      chosen,
      paper.pointsPerQuestion,
    )

    const student = await prisma.student.findUnique({ where: { id: studentId }, select: { classId: true } })
    const classId = paper.classId ?? student?.classId ?? null

    try {
      await prisma.$transaction(async (tx) => {
        await tx.quizResult.create({
          data: {
            examId: paper.id,
            studentId,
            classId,
            score: graded.score,
            total: graded.total,
            correctCount: graded.correctCount,
            questionCount: graded.questionCount,
            percentage: graded.percentage,
            answers: {
              create: graded.answers.map((a) => ({
                questionId: a.questionId,
                chosenIndex: a.chosenIndex,
                isCorrect: a.isCorrect,
              })),
            },
          },
        })
        if (graded.score > 0) {
          await tx.pointEntry.create({
            data: {
              studentId,
              classId,
              points: graded.score,
              source: 'QUIZ',
              activityKey: 'quiz',
              activityLabel: quizActivityLabel(paper.title),
              reason: quizPointReason(paper.id),
              createdById: user.accountId,
            },
          })
        }
      })
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new PortalError('You have already submitted this quiz.')
      }
      throw err
    }

    await audit(user, 'quiz.submit', 'exam', paper.id, `"${paper.title}": ${graded.score}/${graded.total} (${graded.percentage}%)`)
    revalidatePath('/portal/quizzes')
    revalidatePath(`/portal/quizzes/${paper.id}`)
    revalidatePath(`/portal/exams/${paper.id}`)
    revalidatePath('/portal/leaderboard')
    revalidatePath('/portal')
    return {
      score: graded.score,
      total: graded.total,
      percentage: graded.percentage,
      correctCount: graded.correctCount,
      questionCount: graded.questionCount,
    }
  })
}

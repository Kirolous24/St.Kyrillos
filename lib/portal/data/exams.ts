// Exam/quiz reads. Every query is scoped in SQL — the prototype pulled whole
// collections and filtered in JS (ANALYSIS §7); nothing here does that.
// The answer key (ExamQuestion.correctIndex) is selected ONLY by the functions
// marked "server-only key" and never by anything a student page renders.

import { notFound } from 'next/navigation'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { can, type Action, type PortalUser, type StageKey } from '../permissions'
import { PortalError } from '../action-result'
import { formatDateOnly, todayInNewYork } from '../dates'
import {
  percentageOf,
  questionRates,
  bestAndWorst,
  mayReadExam,
  mayAuthorExams,
  type QuestionRate,
} from '../exams'
import { studentName } from './students'

/* ── Scoping ──────────────────────────────────────────────────────────────── */

/**
 * Which exams this staff user may see: their own classes, plus stage-wide
 * exams for the stage they oversee. Admin and pastor see everything.
 */
export function examScopeWhere(user: PortalUser): Prisma.ExamWhereInput {
  if (user.role === 'ADMIN' || user.role === 'PASTOR') return {}
  const or: Prisma.ExamWhereInput[] = [{ classId: { in: user.classIds } }]
  if (user.stageOversight) or.push({ classId: null, stage: user.stageOversight })
  return { OR: or }
}

/** The writable action an exam operation maps onto (exams award points). */
export const EXAM_WRITE: Action = 'points.write'

interface ExamOwner {
  id: string
  classId: string | null
  stage: StageKey | null
  class: { id: string; name: string; stage: StageKey } | null
}

export function canWriteExam(user: PortalUser, exam: ExamOwner): boolean {
  if (user.role === 'ADMIN') return true
  // Pastors read only; students never touch a staff exam surface.
  if (user.role === 'PASTOR' || user.role === 'STUDENT') return false
  if (exam.classId) return can(user, EXAM_WRITE, { classId: exam.classId, classStage: exam.class?.stage })
  // Stage-wide exams have no class to be assigned to: admin only.
  return false
}

const ownerSelect = {
  id: true,
  classId: true,
  stage: true,
  class: { select: { id: true, name: true, stage: true } },
} as const

/** Load an exam the staff user may read; 404 when it is not theirs. */
export async function requireExamRead(user: PortalUser, examId: string) {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: {
      ...ownerSelect,
      title: true,
      subject: true,
      dueDate: true,
      pointsPerQuestion: true,
      bibleReading: true,
      readingMessage: true,
      status: true,
      reopenedFor: true,
      createdAt: true,
      updatedAt: true,
    },
  })
  if (!exam || !mayReadExam(user, exam)) notFound()
  return exam
}

/** Same, but for editing: 404 when the user may read but not write. */
export async function requireExamWrite(user: PortalUser, examId: string) {
  const exam = await requireExamRead(user, examId)
  if (!canWriteExam(user, exam)) notFound()
  return exam
}

/** For server actions: throws PortalError rather than rendering a 404. */
export async function assertExamWrite(user: PortalUser, examId: string) {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: { ...ownerSelect, title: true, pointsPerQuestion: true, status: true, reopenedFor: true },
  })
  if (!exam || !mayReadExam(user, exam) || !canWriteExam(user, exam)) {
    throw new PortalError('You do not have permission to change this exam.')
  }
  return exam
}

/** Classes the user may attach a new exam to. */
export async function assignableClasses(user: PortalUser) {
  // Pastors and students may not author exams at all, so there is nothing to
  // offer them — and no staff screen gated on this list is reachable for them.
  if (!mayAuthorExams(user)) return []
  const all = await prisma.schoolClass.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, stage: true },
  })
  if (user.role === 'ADMIN') return all
  const mine = new Set(user.classIds)
  return all.filter((c) => mine.has(c.id))
}

/* ── Staff list ───────────────────────────────────────────────────────────── */

export interface ExamListRow {
  id: string
  title: string
  subject: string | null
  className: string
  classId: string | null
  dueDate: string | null
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED'
  questionCount: number
  submittedCount: number
  studentCount: number
  averagePercentage: number | null
  reopenedCount: number
}

export async function listExams(user: PortalUser, classId?: string | null): Promise<ExamListRow[]> {
  const scope = examScopeWhere(user)
  const where: Prisma.ExamWhereInput = classId ? { AND: [scope, { classId }] } : scope

  const exams = await prisma.exam.findMany({
    where,
    orderBy: [{ dueDate: 'desc' }, { createdAt: 'desc' }],
    take: 200,
    select: {
      id: true,
      title: true,
      subject: true,
      dueDate: true,
      status: true,
      classId: true,
      stage: true,
      reopenedFor: true,
      class: { select: { name: true } },
      _count: { select: { questions: true, results: true } },
    },
  })
  if (exams.length === 0) return []

  const examIds = exams.map((e) => e.id)
  const classIds = Array.from(new Set(exams.map((e) => e.classId).filter((c): c is string => !!c)))

  const [averages, rosters] = await Promise.all([
    prisma.quizResult.groupBy({ by: ['examId'], where: { examId: { in: examIds } }, _avg: { percentage: true } }),
    classIds.length
      ? prisma.student.groupBy({ by: ['classId'], where: { classId: { in: classIds } }, _count: { _all: true } })
      : Promise.resolve([] as { classId: string | null; _count: { _all: number } }[]),
  ])
  const avgById = new Map(averages.map((a) => [a.examId, a._avg.percentage]))
  const rosterById = new Map(rosters.map((r) => [r.classId ?? '', r._count._all]))

  return exams.map((e) => ({
    id: e.id,
    title: e.title,
    subject: e.subject,
    className: e.class?.name ?? (e.stage ? `${e.stage.replace('_', ' ').toLowerCase()} (stage-wide)` : 'All classes'),
    classId: e.classId,
    dueDate: e.dueDate ? formatDateOnly(e.dueDate) : null,
    status: e.status,
    questionCount: e._count.questions,
    submittedCount: e._count.results,
    studentCount: e.classId ? rosterById.get(e.classId) ?? 0 : 0,
    averagePercentage: avgById.get(e.id) == null ? null : Math.round(avgById.get(e.id)!),
    reopenedCount: e.reopenedFor.length,
  }))
}

/* ── Exam detail (server-only key) ────────────────────────────────────────── */

export interface ExamQuestionDetail {
  id: string
  text: string
  options: string[]
  correctIndex: number
  sortOrder: number
}

export async function examQuestions(examId: string): Promise<ExamQuestionDetail[]> {
  const rows = await prisma.examQuestion.findMany({
    where: { examId },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, text: true, options: true, correctIndex: true, sortOrder: true },
  })
  return rows
}

export interface ExamResultRow {
  studentId: string
  name: string
  score: number
  total: number
  percentage: number
  submittedAt: Date | null
  reopened: boolean
}

export interface ExamDetail {
  results: ExamResultRow[]
  notSubmitted: ExamResultRow[]
  averagePercentage: number | null
  averageScore: number | null
  rates: QuestionRate[]
  best: QuestionRate | null
  worst: QuestionRate | null
}

export async function examDetail(
  exam: { id: string; classId: string | null; reopenedFor: string[] },
): Promise<ExamDetail> {
  const [results, roster, answered, correct] = await Promise.all([
    prisma.quizResult.findMany({
      where: { examId: exam.id },
      orderBy: { percentage: 'desc' },
      select: {
        studentId: true,
        score: true,
        total: true,
        percentage: true,
        submittedAt: true,
        student: { select: { firstName: true, lastName: true } },
      },
    }),
    exam.classId
      ? prisma.student.findMany({
          where: { classId: exam.classId },
          orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
          select: { id: true, firstName: true, lastName: true },
        })
      : Promise.resolve([] as { id: string; firstName: string; lastName: string }[]),
    prisma.quizAnswer.groupBy({
      by: ['questionId'],
      where: { result: { examId: exam.id } },
      _count: { _all: true },
    }),
    prisma.quizAnswer.groupBy({
      by: ['questionId'],
      where: { result: { examId: exam.id }, isCorrect: true },
      _count: { _all: true },
    }),
  ])

  const reopened = new Set(exam.reopenedFor)
  const rows: ExamResultRow[] = results.map((r) => ({
    studentId: r.studentId,
    name: studentName(r.student),
    score: r.score,
    total: r.total,
    percentage: r.percentage,
    submittedAt: r.submittedAt,
    reopened: reopened.has(r.studentId),
  }))
  const submitted = new Set(rows.map((r) => r.studentId))
  const missing: ExamResultRow[] = roster
    .filter((s) => !submitted.has(s.id))
    .map((s) => ({
      studentId: s.id,
      name: studentName(s),
      score: 0,
      total: 0,
      percentage: 0,
      submittedAt: null,
      reopened: reopened.has(s.id),
    }))

  const correctById = new Map(correct.map((c) => [c.questionId, c._count._all]))
  const rates = questionRates(
    answered.map((a) => ({
      questionId: a.questionId,
      answered: a._count._all,
      correct: correctById.get(a.questionId) ?? 0,
    })),
  )
  const { best, worst } = bestAndWorst(rates)

  const totalScore = rows.reduce((n, r) => n + r.score, 0)
  const totalPossible = rows.reduce((n, r) => n + r.total, 0)

  return {
    results: rows,
    notSubmitted: missing,
    averagePercentage: rows.length ? Math.round(rows.reduce((n, r) => n + r.percentage, 0) / rows.length) : null,
    averageScore: rows.length ? percentageOf(totalScore, totalPossible) : null,
    rates,
    best,
    worst,
  }
}

/* ── Student side ─────────────────────────────────────────────────────────── */

export interface StudentExamRow {
  id: string
  title: string
  subject: string | null
  dueDate: string | null
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED'
  reopenedFor: string[]
  questionCount: number
  pointsPerQuestion: number
  bibleReading: string | null
  result: { score: number; total: number; percentage: number; submittedAt: Date } | null
}

/** The student's own class + stage-wide exams, with their own result attached. */
export async function studentExams(studentId: string): Promise<{ today: string; rows: StudentExamRow[] }> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, classId: true, class: { select: { stage: true } } },
  })
  if (!student) throw new PortalError('Your student record is missing. Ask a servant for help.')

  const or: Prisma.ExamWhereInput[] = []
  if (student.classId) or.push({ classId: student.classId })
  if (student.class?.stage) or.push({ classId: null, stage: student.class.stage })
  if (or.length === 0) return { today: todayInNewYork(), rows: [] }

  const exams = await prisma.exam.findMany({
    where: { AND: [{ OR: or }, { status: { not: 'DRAFT' } }] },
    orderBy: [{ dueDate: 'desc' }, { createdAt: 'desc' }],
    take: 100,
    select: {
      id: true,
      title: true,
      subject: true,
      dueDate: true,
      status: true,
      reopenedFor: true,
      pointsPerQuestion: true,
      bibleReading: true,
      _count: { select: { questions: true } },
      results: {
        where: { studentId },
        select: { score: true, total: true, percentage: true, submittedAt: true },
      },
    },
  })

  return {
    today: todayInNewYork(),
    rows: exams.map((e) => ({
      id: e.id,
      title: e.title,
      subject: e.subject,
      dueDate: e.dueDate ? formatDateOnly(e.dueDate) : null,
      status: e.status,
      reopenedFor: e.reopenedFor,
      questionCount: e._count.questions,
      pointsPerQuestion: e.pointsPerQuestion,
      bibleReading: e.bibleReading,
      result: e.results[0] ?? null,
    })),
  }
}

/**
 * An exam a student is allowed to open, WITHOUT the answer key.
 * Returns null when the exam is not theirs to see.
 */
export async function studentExamPaper(studentId: string, examId: string) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, classId: true, class: { select: { stage: true } } },
  })
  if (!student) return null

  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: {
      id: true,
      title: true,
      subject: true,
      classId: true,
      stage: true,
      dueDate: true,
      status: true,
      reopenedFor: true,
      pointsPerQuestion: true,
      bibleReading: true,
      readingMessage: true,
      // NOTE: correctIndex is deliberately absent — this shape reaches the browser.
      questions: { orderBy: { sortOrder: 'asc' }, select: { id: true, text: true, options: true, sortOrder: true } },
      results: { where: { studentId }, select: { id: true } },
    },
  })
  if (!exam) return null

  const mine = exam.classId
    ? exam.classId === student.classId
    : !!exam.stage && exam.stage === student.class?.stage
  if (!mine) return null

  return {
    ...exam,
    dueDate: exam.dueDate ? formatDateOnly(exam.dueDate) : null,
    alreadySubmitted: exam.results.length > 0,
  }
}

/** The student's own graded paper, answer key included (post-submission only). */
export async function studentReview(studentId: string, examId: string) {
  const result = await prisma.quizResult.findUnique({
    where: { examId_studentId: { examId, studentId } },
    select: {
      id: true,
      score: true,
      total: true,
      percentage: true,
      correctCount: true,
      questionCount: true,
      submittedAt: true,
      exam: { select: { id: true, title: true, subject: true, pointsPerQuestion: true, bibleReading: true, readingMessage: true } },
      answers: { select: { questionId: true, chosenIndex: true, isCorrect: true } },
    },
  })
  if (!result) return null
  const questions = await examQuestions(examId)
  const byQuestion = new Map(result.answers.map((a) => [a.questionId, a]))
  return {
    result,
    questions: questions.map((q) => ({
      ...q,
      chosenIndex: byQuestion.get(q.id)?.chosenIndex ?? null,
      isCorrect: byQuestion.get(q.id)?.isCorrect ?? false,
    })),
  }
}

// Pure exam/quiz rules. No DB, no React — everything here is unit-tested in
// tests/portal/exams.test.ts. Grading lives here so it can only ever run on
// the server (see lib/portal/actions/exams.ts): the answer key must never be
// shipped to a student's browser, which was the prototype's biggest hole.

import { parseDateOnly } from './dates'
import { can, type PortalUser, type StageKey } from './permissions'

export const MIN_OPTIONS = 2
export const MAX_OPTIONS = 6
export const MAX_QUESTIONS = 100
export const DEFAULT_POINTS_PER_QUESTION = 2

/* ── Who may read an exam (staff only) ────────────────────────── */

export interface ExamOwnership {
  classId: string | null
  stage: StageKey | null
  class?: { stage: StageKey } | null
}

/**
 * Exams are a STAFF surface. The detail and edit screens carry the answer key
 * and every classmate's score, so a student must never read an exam through
 * these helpers no matter which class it belongs to — `can(user, 'class.read')`
 * is true for a student's own class, which is exactly why the role is checked
 * first here rather than being left to each page.
 *
 * Students reach their own paper through studentExamPaper/studentReview, which
 * omit correctIndex until the paper has been handed in.
 */
export function mayReadExam(user: PortalUser, exam: ExamOwnership): boolean {
  if (user.role === 'STUDENT') return false
  if (user.role === 'ADMIN' || user.role === 'PASTOR') return true
  if (exam.classId) return can(user, 'class.read', { classId: exam.classId, classStage: exam.class?.stage })
  return !!exam.stage && user.stageOversight === exam.stage
}

/** True when the user may reach the exam-authoring screens at all. */
export function mayAuthorExams(user: PortalUser): boolean {
  return user.role === 'ADMIN' || user.role === 'SERVANT'
}

/* ── Grading ──────────────────────────────────────────────────────────────── */

export interface GradableQuestion {
  id: string
  correctIndex: number
  /** When given, a chosen index outside 0..optionCount-1 counts as unanswered. */
  optionCount?: number
}

export interface GradedAnswer {
  questionId: string
  chosenIndex: number | null
  isCorrect: boolean
}

export interface GradedSubmission {
  questionCount: number
  correctCount: number
  score: number
  total: number
  percentage: number
  answers: GradedAnswer[]
}

/**
 * Grade one submission. `answers` maps questionId → chosen option index;
 * anything missing, null, non-integer or out of range is an unanswered
 * question and simply scores zero. Questions drive the loop, never the
 * client's payload, so a student cannot invent questions or skip grading.
 */
export function gradeSubmission(
  questions: readonly GradableQuestion[],
  answers: Readonly<Record<string, number | null | undefined>>,
  pointsPerQuestion: number,
): GradedSubmission {
  const perQuestion = Math.max(0, Math.trunc(pointsPerQuestion))
  const graded: GradedAnswer[] = questions.map((q) => {
    const raw = answers[q.id]
    const chosen =
      typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && (q.optionCount === undefined || raw < q.optionCount)
        ? raw
        : null
    return { questionId: q.id, chosenIndex: chosen, isCorrect: chosen !== null && chosen === q.correctIndex }
  })
  const correctCount = graded.filter((a) => a.isCorrect).length
  const questionCount = questions.length
  const score = correctCount * perQuestion
  const total = questionCount * perQuestion
  return { questionCount, correctCount, score, total, percentage: percentageOf(score, total), answers: graded }
}

export function percentageOf(score: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((score / total) * 100)
}

export function examTotalPoints(questionCount: number, pointsPerQuestion: number): number {
  return Math.max(0, questionCount) * Math.max(0, Math.trunc(pointsPerQuestion))
}

/* ── Status and bands ─────────────────────────────────────────────────────── */

export type ExamStudentStatus = 'available' | 'completed' | 'missed' | 'upcoming'

export interface ExamStatusInput {
  id: string
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED'
  /** "YYYY-MM-DD" or null when the exam never closes. */
  dueDate: string | null
  reopenedFor: readonly string[]
}

/**
 * What one student sees for one exam.
 * - a draft is 'upcoming' (not released yet);
 * - a submitted exam is always 'completed', even past due;
 * - past the due date (or once closed) it is 'missed' unless the student was
 *   individually reopened, which puts it back in 'available'.
 */
export function examStatusFor(
  exam: ExamStatusInput,
  studentId: string,
  submittedExamIds: ReadonlySet<string> | readonly string[],
  today: string,
): ExamStudentStatus {
  const submitted =
    submittedExamIds instanceof Set
      ? (submittedExamIds as ReadonlySet<string>).has(exam.id)
      : (submittedExamIds as readonly string[]).includes(exam.id)
  if (submitted) return 'completed'
  if (exam.status === 'DRAFT') return 'upcoming'
  const reopened = exam.reopenedFor.includes(studentId)
  if (reopened) return 'available'
  if (exam.status === 'CLOSED') return 'missed'
  if (exam.dueDate && exam.dueDate < today) return 'missed'
  return 'available'
}

export type ScoreBand = 'excellent' | 'good' | 'needs-work'

export function scoreBand(percentage: number): ScoreBand {
  if (percentage >= 90) return 'excellent'
  if (percentage >= 60) return 'good'
  return 'needs-work'
}

export const SCORE_BAND_LABEL: Record<ScoreBand, string> = {
  excellent: 'Excellent',
  good: 'Good',
  'needs-work': 'Needs work',
}

export const SCORE_BAND_TONE: Record<ScoreBand, 'good' | 'warn' | 'bad'> = {
  excellent: 'good',
  good: 'warn',
  'needs-work': 'bad',
}

/** Days until the due date; negative once past. Null when there is no due date. */
export function daysUntilDue(dueDate: string | null, today: string): number | null {
  if (!dueDate) return null
  const a = Date.parse(`${today}T00:00:00.000Z`)
  const b = Date.parse(`${dueDate}T00:00:00.000Z`)
  if (Number.isNaN(a) || Number.isNaN(b)) return null
  return Math.round((b - a) / 86_400_000)
}

/* ── Question drafts ──────────────────────────────────────────────────────── */

export interface QuestionDraft {
  text: string
  options: string[]
  correctIndex: number
}

export interface CompactResult {
  question: QuestionDraft | null
  error: string | null
}

/**
 * Drop blank options WITHOUT losing the answer key.
 *
 * The prototype filtered blank options and left `correct` pointing at the old
 * index, silently re-keying the exam (ANALYSIS §6). Here the correct option is
 * identified by value first, then its new index is read back, so add / remove /
 * reorder can never shift it. Refuses outright when the correct option is the
 * blank one — better an error than a wrong key.
 */
export function compactQuestion(draft: QuestionDraft): CompactResult {
  const text = draft.text.trim()
  if (!text) return { question: null, error: 'Question text is required.' }

  const marked = draft.options.map((opt, idx) => ({ value: opt.trim(), correct: idx === draft.correctIndex }))
  const kept = marked.filter((o) => o.value !== '')
  if (kept.length < MIN_OPTIONS) return { question: null, error: `Give at least ${MIN_OPTIONS} answer options.` }
  if (kept.length > MAX_OPTIONS) return { question: null, error: `No more than ${MAX_OPTIONS} answer options.` }

  const correctIndex = kept.findIndex((o) => o.correct)
  if (correctIndex === -1) return { question: null, error: 'Mark which option is the correct answer.' }

  return { question: { text, options: kept.map((o) => o.value), correctIndex }, error: null }
}

/* ── Per-question analytics ───────────────────────────────────────────────── */

export interface QuestionRate {
  questionId: string
  answered: number
  correct: number
  /** 0–100; -1 when nobody has answered, so it sorts last. */
  rate: number
}

export function questionRates(
  rows: readonly { questionId: string; answered: number; correct: number }[],
): QuestionRate[] {
  return rows.map((r) => ({
    questionId: r.questionId,
    answered: r.answered,
    correct: r.correct,
    rate: r.answered > 0 ? Math.round((r.correct / r.answered) * 100) : -1,
  }))
}

/** Best and worst question by correct rate; both null until someone answers. */
export function bestAndWorst(rates: readonly QuestionRate[]): { best: QuestionRate | null; worst: QuestionRate | null } {
  const answered = rates.filter((r) => r.answered > 0)
  if (answered.length === 0) return { best: null, worst: null }
  const sorted = [...answered].sort((a, b) => b.rate - a.rate || a.questionId.localeCompare(b.questionId))
  return { best: sorted[0]!, worst: sorted[sorted.length - 1]! }
}

/* ── Points traceability ──────────────────────────────────────────────────── */

const REASON_PREFIX = 'examId:'

/** Stored on the QUIZ PointEntry so a score can be traced back to its exam. */
export function quizPointReason(examId: string): string {
  return `${REASON_PREFIX}${examId}`
}

export function examIdFromReason(reason: string | null | undefined): string | null {
  if (!reason) return null
  const trimmed = reason.trim()
  return trimmed.startsWith(REASON_PREFIX) ? trimmed.slice(REASON_PREFIX.length) || null : null
}

export function quizActivityLabel(title: string): string {
  return `Quiz: ${title}`
}

/* ── CSV import ───────────────────────────────────────────────────────────── */

export interface ExamDraft {
  title: string
  subject: string | null
  dueDate: string | null
  bibleReading: string | null
  readingMessage: string | null
  pointsPerQuestion: number
  questions: QuestionDraft[]
  /** 1-based CSV line numbers that fed this draft, for the import report. */
  rows: number[]
}

export interface RowError {
  row: number
  message: string
}

export interface ExamCsvParse {
  drafts: ExamDraft[]
  errors: RowError[]
}

const LETTERS = ['a', 'b', 'c', 'd', 'e', 'f']

function pick(rec: Record<string, string>, keys: readonly string[]): string {
  for (const k of keys) {
    const v = rec[k]
    if (v !== undefined && v.trim() !== '') return v.trim()
  }
  return ''
}

function readOptions(rec: Record<string, string>): string[] {
  const out: string[] = []
  for (const letter of LETTERS) {
    out.push(pick(rec, [`option ${letter}`, `answer ${letter}`, `choice ${letter}`, letter]))
  }
  // Trailing blanks are normal (a 3-option question); interior blanks are
  // dropped by compactQuestion, which keeps the answer key bound.
  while (out.length > 0 && out[out.length - 1] === '') out.pop()
  return out
}

function resolveCorrectIndex(raw: string, options: readonly string[]): number {
  const value = raw.trim()
  if (!value) return -1
  const letter = value.toLowerCase()
  const byLetter = LETTERS.indexOf(letter)
  if (byLetter !== -1) return byLetter
  const asNumber = Number(value)
  if (Number.isInteger(asNumber) && asNumber >= 1 && asNumber <= MAX_OPTIONS) return asNumber - 1
  const byText = options.findIndex((o) => o.toLowerCase() === letter)
  return byText
}

/**
 * Turn CSV records (one row per question) into exam drafts, grouped by
 * title + due date. Bad rows are reported and skipped — never fatal to the
 * whole file — so a servant can fix three lines instead of the whole sheet.
 */
export function parseExamCsv(records: readonly Record<string, string>[]): ExamCsvParse {
  const byTitle = new Map<string, ExamDraft[]>()
  const order: ExamDraft[] = []
  const errors: RowError[] = []

  records.forEach((rec, idx) => {
    const row = idx + 2 // header is line 1
    const hasAnything = Object.values(rec).some((v) => v.trim() !== '')
    if (!hasAnything) return

    const title = pick(rec, ['title', 'exam', 'quiz', 'exam title', 'quiz title'])
    if (!title) {
      errors.push({ row, message: 'Missing exam title.' })
      return
    }

    const dueRaw = pick(rec, ['due date', 'due', 'date'])
    const dueDate = dueRaw ? parseDateOnly(dueRaw) : null
    if (dueRaw && !dueDate) {
      errors.push({ row, message: `Could not read the due date "${dueRaw}".` })
      return
    }

    const questionText = pick(rec, ['question', 'question text', 'q'])
    const options = readOptions(rec)
    const correctRaw = pick(rec, ['correct', 'correct letter', 'correct answer', 'answer', 'key'])
    const correctIndex = resolveCorrectIndex(correctRaw, options)
    if (correctIndex === -1 && correctRaw) {
      errors.push({ row, message: `"${correctRaw}" is not one of the answer options.` })
      return
    }

    const compacted = compactQuestion({ text: questionText, options, correctIndex })
    if (!compacted.question) {
      errors.push({ row, message: compacted.error ?? 'Invalid question.' })
      return
    }

    // Rows of the same quiz usually leave the exam-level columns blank after
    // the first one, so a blank due date joins the quiz already opened under
    // that title; two different due dates mean two different quizzes.
    const titleKey = title.toLowerCase()
    const siblings = byTitle.get(titleKey) ?? []
    let draft =
      dueDate === null
        ? siblings[0]
        : siblings.find((d) => d.dueDate === dueDate) ?? siblings.find((d) => d.dueDate === null)
    if (draft) {
      draft.dueDate ??= dueDate
    } else {
      draft = {
        title,
        subject: pick(rec, ['subject', 'topic']) || null,
        dueDate,
        bibleReading: pick(rec, ['bible reading', 'reading', 'chapter']) || null,
        readingMessage: pick(rec, ['reading message', 'message', 'note']) || null,
        pointsPerQuestion: DEFAULT_POINTS_PER_QUESTION,
        questions: [],
        rows: [],
      }
      const pts = Number(pick(rec, ['points per question', 'points per q', 'points', 'pts']))
      if (Number.isInteger(pts) && pts > 0 && pts <= 100) draft.pointsPerQuestion = pts
      byTitle.set(titleKey, [...siblings, draft])
      order.push(draft)
    }
    // Later rows may carry exam-level fields an earlier row left blank.
    draft.subject ??= pick(rec, ['subject', 'topic']) || null
    draft.bibleReading ??= pick(rec, ['bible reading', 'reading', 'chapter']) || null
    draft.readingMessage ??= pick(rec, ['reading message', 'message', 'note']) || null

    if (draft.questions.length >= MAX_QUESTIONS) {
      errors.push({ row, message: `"${draft.title}" already has ${MAX_QUESTIONS} questions.` })
      return
    }
    draft.questions.push(compacted.question)
    draft.rows.push(row)
  })

  return { drafts: order, errors }
}

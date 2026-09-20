import { describe, it, expect } from 'vitest'
import {
  gradeSubmission,
  percentageOf,
  examTotalPoints,
  examStatusFor,
  scoreBand,
  daysUntilDue,
  compactQuestion,
  questionRates,
  bestAndWorst,
  parseExamCsv,
  quizPointReason,
  examIdFromReason,
  quizActivityLabel,
  mayReadExam,
  mayAuthorExams,
} from '@/lib/portal/exams'
import { can, type PortalUser, type StageKey } from '@/lib/portal/permissions'
import { parseCsvRecords } from '@/lib/portal/csv'

describe('gradeSubmission', () => {
  const questions = [
    { id: 'q1', correctIndex: 0, optionCount: 4 },
    { id: 'q2', correctIndex: 2, optionCount: 4 },
    { id: 'q3', correctIndex: 1, optionCount: 3 },
  ]

  it('scores correct answers at pointsPerQuestion each', () => {
    const g = gradeSubmission(questions, { q1: 0, q2: 2, q3: 1 }, 2)
    expect(g).toMatchObject({ correctCount: 3, questionCount: 3, score: 6, total: 6, percentage: 100 })
  })

  it('treats missing, null and out-of-range answers as unanswered', () => {
    const g = gradeSubmission(questions, { q1: 0, q2: null, q3: 9 }, 2)
    expect(g.correctCount).toBe(1)
    expect(g.score).toBe(2)
    expect(g.percentage).toBe(33)
    expect(g.answers.map((a) => a.chosenIndex)).toEqual([0, null, null])
  })

  it('ignores answers for questions that are not on the paper', () => {
    const g = gradeSubmission(questions, { q1: 0, ghost: 0 } as Record<string, number>, 2)
    expect(g.answers).toHaveLength(3)
    expect(g.answers.some((a) => a.questionId === 'ghost')).toBe(false)
  })

  it('never awards points for a wrong answer, whatever the client sends', () => {
    const g = gradeSubmission(questions, { q1: 1, q2: 1, q3: 0 }, 5)
    expect(g.correctCount).toBe(0)
    expect(g.score).toBe(0)
    expect(g.percentage).toBe(0)
  })

  it('handles an empty paper without dividing by zero', () => {
    expect(gradeSubmission([], {}, 2)).toMatchObject({ score: 0, total: 0, percentage: 0 })
  })
})

describe('percentageOf / examTotalPoints', () => {
  it('rounds to the nearest whole percent', () => {
    expect(percentageOf(5, 6)).toBe(83)
    expect(percentageOf(1, 3)).toBe(33)
    expect(percentageOf(0, 0)).toBe(0)
  })
  it('multiplies questions by points per question', () => {
    expect(examTotalPoints(10, 2)).toBe(20)
    expect(examTotalPoints(0, 2)).toBe(0)
  })
})

describe('examStatusFor', () => {
  const base = { id: 'e1', status: 'PUBLISHED' as const, dueDate: '2026-09-20', reopenedFor: [] as string[] }

  it('is available before the due date', () => {
    expect(examStatusFor(base, 's1', [], '2026-09-19')).toBe('available')
    expect(examStatusFor(base, 's1', [], '2026-09-20')).toBe('available')
  })

  it('is missed once past due', () => {
    expect(examStatusFor(base, 's1', [], '2026-09-21')).toBe('missed')
  })

  it('reopens for the named students only', () => {
    const reopened = { ...base, reopenedFor: ['s2'] }
    expect(examStatusFor(reopened, 's2', [], '2026-09-30')).toBe('available')
    expect(examStatusFor(reopened, 's1', [], '2026-09-30')).toBe('missed')
  })

  it('is completed once submitted, even past due', () => {
    expect(examStatusFor(base, 's1', ['e1'], '2026-12-01')).toBe('completed')
    expect(examStatusFor(base, 's1', new Set(['e1']), '2026-12-01')).toBe('completed')
  })

  it('treats drafts as upcoming and closed exams as missed', () => {
    expect(examStatusFor({ ...base, status: 'DRAFT' }, 's1', [], '2026-09-01')).toBe('upcoming')
    expect(examStatusFor({ ...base, status: 'CLOSED' }, 's1', [], '2026-09-01')).toBe('missed')
  })

  it('stays available forever when there is no due date', () => {
    expect(examStatusFor({ ...base, dueDate: null }, 's1', [], '2030-01-01')).toBe('available')
  })
})

describe('scoreBand', () => {
  it('uses the prototype bands: 90 excellent, 60 good', () => {
    expect(scoreBand(100)).toBe('excellent')
    expect(scoreBand(90)).toBe('excellent')
    expect(scoreBand(89)).toBe('good')
    expect(scoreBand(60)).toBe('good')
    expect(scoreBand(59)).toBe('needs-work')
    expect(scoreBand(0)).toBe('needs-work')
  })
})

describe('daysUntilDue', () => {
  it('counts forward and backward in whole days', () => {
    expect(daysUntilDue('2026-09-25', '2026-09-20')).toBe(5)
    expect(daysUntilDue('2026-09-20', '2026-09-20')).toBe(0)
    expect(daysUntilDue('2026-09-18', '2026-09-20')).toBe(-2)
    expect(daysUntilDue(null, '2026-09-20')).toBeNull()
  })
})

describe('compactQuestion — the prototype answer-shift bug (§6)', () => {
  it('keeps the correct answer bound to its option when blanks are removed', () => {
    const { question } = compactQuestion({ text: 'Who?', options: ['', 'Peter', '', 'Paul'], correctIndex: 3 })
    expect(question).toEqual({ text: 'Who?', options: ['Peter', 'Paul'], correctIndex: 1 })
  })

  it('does not shift when the blanks are after the correct option', () => {
    const { question } = compactQuestion({ text: 'Who?', options: ['Peter', 'Paul', '', ''], correctIndex: 0 })
    expect(question).toEqual({ text: 'Who?', options: ['Peter', 'Paul'], correctIndex: 0 })
  })

  it('refuses rather than re-keying when the correct option is blank', () => {
    const { question, error } = compactQuestion({ text: 'Who?', options: ['Peter', '', 'Paul'], correctIndex: 1 })
    expect(question).toBeNull()
    expect(error).toMatch(/correct answer/i)
  })

  it('trims text and options and demands at least two options', () => {
    expect(compactQuestion({ text: '  Who?  ', options: [' Peter ', 'Paul'], correctIndex: 0 }).question).toEqual({
      text: 'Who?',
      options: ['Peter', 'Paul'],
      correctIndex: 0,
    })
    expect(compactQuestion({ text: 'Who?', options: ['Peter'], correctIndex: 0 }).error).toMatch(/at least 2/i)
    expect(compactQuestion({ text: '   ', options: ['a', 'b'], correctIndex: 0 }).error).toMatch(/required/i)
  })
})

describe('questionRates / bestAndWorst', () => {
  const rates = questionRates([
    { questionId: 'q1', answered: 10, correct: 9 },
    { questionId: 'q2', answered: 10, correct: 3 },
    { questionId: 'q3', answered: 0, correct: 0 },
  ])

  it('computes a correct rate and marks unanswered questions with -1', () => {
    expect(rates.map((r) => r.rate)).toEqual([90, 30, -1])
  })

  it('picks best and worst from answered questions only', () => {
    const { best, worst } = bestAndWorst(rates)
    expect(best?.questionId).toBe('q1')
    expect(worst?.questionId).toBe('q2')
  })

  it('returns nulls before anyone has answered', () => {
    expect(bestAndWorst(questionRates([{ questionId: 'q1', answered: 0, correct: 0 }]))).toEqual({ best: null, worst: null })
  })
})

describe('quiz point traceability', () => {
  it('round-trips the exam id through the point entry reason', () => {
    expect(examIdFromReason(quizPointReason('exam_123'))).toBe('exam_123')
    expect(examIdFromReason('some manual note')).toBeNull()
    expect(examIdFromReason(null)).toBeNull()
  })
  it('labels the point entry with the exam title', () => {
    expect(quizActivityLabel('St. Mark 1')).toBe('Quiz: St. Mark 1')
  })
})

describe('parseExamCsv', () => {
  const csv = [
    'Title,Subject,Due Date,Bible Reading,Question,Option A,Option B,Option C,Option D,Correct',
    'Mark 1,Bible,2026-10-05,Mark 1,Who baptised the Lord?,John,Peter,Paul,Andrew,A',
    'Mark 1,,,,Where was He baptised?,Nile,Jordan,Red Sea,,b',
    'Mark 2,Bible,10/12/2026,Mark 2,Who carried the paralytic?,Two men,Four men,Six men,,2',
  ].join('\r\n')

  it('groups rows by title and due date into one exam each', () => {
    const { drafts, errors } = parseExamCsv(parseCsvRecords(csv))
    expect(errors).toEqual([])
    expect(drafts).toHaveLength(2)
    expect(drafts[0]!.title).toBe('Mark 1')
    expect(drafts[0]!.dueDate).toBe('2026-10-05')
    expect(drafts[0]!.questions).toHaveLength(2)
    expect(drafts[0]!.bibleReading).toBe('Mark 1')
    expect(drafts[0]!.pointsPerQuestion).toBe(2)
  })

  it('accepts letters, numbers and the answer text as the key, and drops trailing blanks', () => {
    const { drafts } = parseExamCsv(parseCsvRecords(csv))
    expect(drafts[0]!.questions[0]).toEqual({
      text: 'Who baptised the Lord?',
      options: ['John', 'Peter', 'Paul', 'Andrew'],
      correctIndex: 0,
    })
    expect(drafts[0]!.questions[1]).toEqual({
      text: 'Where was He baptised?',
      options: ['Nile', 'Jordan', 'Red Sea'],
      correctIndex: 1,
    })
    expect(drafts[1]!.questions[0]!.correctIndex).toBe(1)
    expect(drafts[1]!.dueDate).toBe('2026-10-12')
  })

  it('matches the correct answer by its text', () => {
    const { drafts, errors } = parseExamCsv(
      parseCsvRecords('Title,Question,Option A,Option B,Correct\nQ,Colour?,Red,Blue,Blue'),
    )
    expect(errors).toEqual([])
    expect(drafts[0]!.questions[0]!.correctIndex).toBe(1)
  })

  it('reports bad rows by line number and imports the rest', () => {
    const bad = [
      'Title,Question,Option A,Option B,Correct',
      ',Orphan question,Yes,No,A',
      'Good,Is it good?,Yes,No,A',
      'Good,Missing key,Yes,No,',
      'Good,Bad key,Yes,No,Z',
      'Good,Only one option,Yes,,A',
    ].join('\n')
    const { drafts, errors } = parseExamCsv(parseCsvRecords(bad))
    expect(drafts).toHaveLength(1)
    expect(drafts[0]!.questions).toHaveLength(1)
    expect(errors.map((e) => e.row)).toEqual([2, 4, 5, 6])
    expect(errors[0]!.message).toMatch(/title/i)
    expect(errors[2]!.message).toMatch(/not one of the answer options/i)
  })

  it('rejects an unreadable due date rather than guessing', () => {
    const { drafts, errors } = parseExamCsv(
      parseCsvRecords('Title,Due Date,Question,Option A,Option B,Correct\nQ,not-a-date,Why?,Yes,No,A'),
    )
    expect(drafts).toHaveLength(0)
    expect(errors[0]).toMatchObject({ row: 2 })
    expect(errors[0]!.message).toMatch(/due date/i)
  })

  it('skips entirely blank rows', () => {
    const { drafts, errors } = parseExamCsv(
      parseCsvRecords('Title,Question,Option A,Option B,Correct\n,,,,\nGood,Q?,Yes,No,A'),
    )
    expect(errors).toEqual([])
    expect(drafts).toHaveLength(1)
  })

  it('reads a custom points-per-question column', () => {
    const { drafts } = parseExamCsv(
      parseCsvRecords('Title,Points Per Question,Question,Option A,Option B,Correct\nQ,5,Why?,Yes,No,A'),
    )
    expect(drafts[0]!.pointsPerQuestion).toBe(5)
  })
})

describe('mayReadExam / mayAuthorExams (staff-only exam surfaces)', () => {
  const base = {
    accountId: 'a1',
    displayName: 'Test',
    classIds: ['c1'],
    coordinatorOf: [] as string[],
    stageOversight: null as StageKey | null,
  }
  const student: PortalUser = { ...base, role: 'STUDENT', studentId: 's1' }
  const servant: PortalUser = { ...base, role: 'SERVANT', servantId: 'v1' }
  const admin: PortalUser = { ...base, role: 'ADMIN', classIds: [] }
  const pastor: PortalUser = { ...base, role: 'PASTOR', classIds: [] }

  const ownClassExam = { classId: 'c1', stage: null, class: { stage: 'MIDDLE_SCHOOL' as StageKey } }
  const otherClassExam = { classId: 'c2', stage: null, class: { stage: 'MIDDLE_SCHOOL' as StageKey } }
  const stageExam = { classId: null, stage: 'MIDDLE_SCHOOL' as StageKey, class: null }

  it('refuses a student the exam in their OWN class (answer key + classmates’ scores)', () => {
    expect(mayReadExam(student, ownClassExam)).toBe(false)
    expect(mayReadExam(student, otherClassExam)).toBe(false)
    expect(mayReadExam(student, stageExam)).toBe(false)
  })

  it('refuses a student even when class.read would say yes', () => {
    // The student genuinely may read their class — that is exactly the hole
    // this guard closes, so assert the two disagree on purpose.
    expect(can(student, 'class.read', { classId: 'c1' })).toBe(true)
    expect(mayReadExam(student, ownClassExam)).toBe(false)
  })

  it('lets a servant read their own class but not another', () => {
    expect(mayReadExam(servant, ownClassExam)).toBe(true)
    expect(mayReadExam(servant, otherClassExam)).toBe(false)
  })

  it('lets a servant with stage oversight read a stage-wide exam', () => {
    const overseer: PortalUser = { ...servant, stageOversight: 'MIDDLE_SCHOOL' }
    expect(mayReadExam(overseer, stageExam)).toBe(true)
    expect(mayReadExam(servant, stageExam)).toBe(false)
  })

  it('lets admin and pastor read anything', () => {
    for (const exam of [ownClassExam, otherClassExam, stageExam]) {
      expect(mayReadExam(admin, exam)).toBe(true)
      expect(mayReadExam(pastor, exam)).toBe(true)
    }
  })

  it('opens the authoring screens to staff only', () => {
    expect(mayAuthorExams(student)).toBe(false)
    expect(mayAuthorExams(pastor)).toBe(false)
    expect(mayAuthorExams(servant)).toBe(true)
    expect(mayAuthorExams(admin)).toBe(true)
  })
})

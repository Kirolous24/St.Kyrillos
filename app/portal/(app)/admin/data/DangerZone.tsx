'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
import { endOfYearReset, resetClassActivities, resetAllClassActivities, clearClassPoints, deleteClassStudents } from '@/lib/portal/actions/data-tools'
import { CONFIRM_PHRASE, type DangerResult } from '@/lib/portal/reports'
import { Card, Callout, buttonClass, inputClass, selectClass } from '@/components/portal/ui'
import { cn } from '@/lib/utils'

interface Props {
  classes: Array<{ id: string; name: string }>
  /**
   * F0846 — students on the roll right now. The prototype fetched this count
   * and showed it before the admin could even reach the typed confirm, and
   * kept the button disabled until it resolved. Here the card described what
   * would be deleted in categories and the number only appeared afterwards, in
   * the report of what had already gone. "Every student" is an abstraction;
   * "all 187 students" is the thing the admin is about to do.
   */
  studentCount: number
}

type Op = 'endOfYear' | 'resetActivities' | 'resetAllActivities' | 'clearPoints' | 'deleteClassStudents'

const CAPTION = 'mb-1.5 block text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500'

export function DangerZone({ classes, studentCount }: Props) {
  const router = useRouter()
  const [typed, setTyped] = useState<Record<Op, string>>({ endOfYear: '', resetActivities: '', resetAllActivities: '', clearPoints: '', deleteClassStudents: '' })
  const [classFor, setClassFor] = useState<Record<'resetActivities' | 'clearPoints' | 'deleteClassStudents', string>>({
    resetActivities: classes[0]?.id ?? '',
    clearPoints: classes[0]?.id ?? '',
    deleteClassStudents: classes[0]?.id ?? '',
  })
  const [result, setResult] = useState<DangerResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<Op | null>(null)
  const [, startTransition] = useTransition()

  function run(op: Op) {
    setError(null)
    setResult(null)
    setBusy(op)
    startTransition(async () => {
      const phrase = typed[op]
      const outcome =
        op === 'endOfYear'
          ? await endOfYearReset(phrase)
          : op === 'resetAllActivities'
            ? await resetAllClassActivities(phrase)
            : op === 'resetActivities'
              ? await resetClassActivities(classFor.resetActivities, phrase)
              : op === 'deleteClassStudents'
                ? await deleteClassStudents(classFor.deleteClassStudents, phrase)
                : await clearClassPoints(classFor.clearPoints, phrase)
      setBusy(null)
      if (!outcome.ok) {
        setError(outcome.error)
        return
      }
      setResult(outcome.data!)
      setTyped((prev) => ({ ...prev, [op]: '' }))
      router.refresh()
    })
  }

  /**
   * Hand-rolled rather than `Field` because the phrase itself has to be legible
   * — monospaced and red — inside the label, and `Field` takes a plain string.
   */
  function confirmField(op: Op) {
    const phrase = CONFIRM_PHRASE[op]
    return (
      <label className="block">
        {/* F0846 — the live number, at the step where it changes a mind. */}
        {op === 'endOfYear' && (
          <span className="mb-1.5 block text-[12.5px] font-bold text-[#7F1D1D]">
            This deletes all {studentCount.toLocaleString()} {studentCount === 1 ? 'student' : 'students'} on the roll
            right now, with everything recorded against them.
          </span>
        )}
        <span className={CAPTION}>
          Type <span className="font-mono text-[12px] font-bold normal-case tracking-normal text-[#B91C1C]">{phrase}</span> to confirm
        </span>
        <input
          value={typed[op]}
          onChange={(e) => setTyped((prev) => ({ ...prev, [op]: e.target.value }))}
          className={cn(inputClass, 'min-h-[40px] max-w-xs font-mono')}
          placeholder={phrase}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
    )
  }

  const canRun = (op: Op) => typed[op].trim() === CONFIRM_PHRASE[op] && busy === null

  return (
    <Card
      className="border-[#FCA5A5] border-l-[#DC2626]"
      title={<span className="text-[#B91C1C]">Danger zone</span>}
      icon={<AlertTriangle className="h-4 w-4 text-[#DC2626]" aria-hidden />}
      bodyClassName="p-0"
    >
      {(error || result) && (
        <div className="space-y-3 px-[18px] pt-[18px]">
          {error && <Callout tone="bad">{error}</Callout>}
          {result && (
            <Callout tone="good" title={result.action}>
              <ul className="ml-4 mt-1 list-disc space-y-0.5">
                {result.deleted.map((d) => (
                  <li key={d.table}>
                    {d.rows.toLocaleString()} {d.table}
                  </li>
                ))}
              </ul>
              <p className="mt-1.5">{result.detail}</p>
            </Callout>
          )}
        </div>
      )}

      {/* End-of-year reset */}
      <div className="space-y-3.5 border-b border-dashed border-[#FCA5A5] bg-[#FEF2F2]/60 p-[18px]">
        <div>
          <h3 className="text-[13px] font-bold text-[#7F1D1D]">End-of-year reset</h3>
          <p className="mt-0.5 text-[12px] text-parch-600">
            Start a new school year with the same classes and the same servants.
          </p>
        </div>
        <Callout tone="bad" title="This permanently deletes">
          Every student, and with them their points, attendance, quiz results, Bible reading logs, achievements and
          follow-up cases.
          <p className="mt-1.5 font-bold">Kept:</p>
          classes, servants and staff accounts, exams, lessons, hymns, agendas, the feed, events, activities and
          settings.
        </Callout>
        {confirmField('endOfYear')}
        <button
          type="button"
          onClick={() => run('endOfYear')}
          disabled={!canRun('endOfYear')}
          className={buttonClass('danger')}
        >
          <AlertTriangle className="h-4 w-4" aria-hidden />
          {busy === 'endOfYear' ? 'Resetting…' : 'Run end-of-year reset'}
        </button>
      </div>

      {/* Reset a class's activities */}
      <div className="space-y-3.5 border-b border-dashed border-[#FCA5A5] p-[18px]">
        <div>
          <h3 className="text-[13px] font-bold text-parch-900">Reset a class&rsquo;s point activities</h3>
          <p className="mt-0.5 text-[12px] text-parch-600">
            Removes the custom activities that class defined.
          </p>
        </div>
        <Callout tone="bad" title="This permanently deletes">
          Every custom point activity on the chosen class.
          <p className="mt-1.5 font-bold">Kept:</p>
          every point already awarded, and the class itself.
        </Callout>
        <label className="block">
          <span className={CAPTION}>Class</span>
          <select
            value={classFor.resetActivities}
            onChange={(e) => setClassFor((prev) => ({ ...prev, resetActivities: e.target.value }))}
            className={cn(selectClass, 'min-h-[40px] max-w-xs')}
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {confirmField('resetActivities')}
        <button
          type="button"
          onClick={() => run('resetActivities')}
          disabled={!canRun('resetActivities') || !classFor.resetActivities}
          className={buttonClass('danger')}
        >
          <AlertTriangle className="h-4 w-4" aria-hidden />
          {busy === 'resetActivities' ? 'Resetting…' : 'Reset activities'}
        </button>
      </div>

      {/* Church-wide version of the card above. This is the prototype's
          "Reset Activities to Standard 6" with an honest label: the six
          "standard activities" are the attendance sessions, which are separate
          rows edited under Sessions & Points — that button only ever deleted
          the custom point activities each class had defined. */}
      <div className="space-y-3.5 border-b border-dashed border-[#FCA5A5] p-[18px]">
        <div>
          <h3 className="text-[13px] font-bold text-parch-900">Reset every class&rsquo;s point activities</h3>
          <p className="mt-0.5 text-[12px] text-parch-600">
            Clears the custom activities across the whole Sunday School at once.
          </p>
        </div>
        <Callout tone="bad" title="This permanently deletes">
          Every custom point activity on every class.
          <p className="mt-1.5 font-bold">Kept:</p>
          every point already awarded, the classes themselves, the shared church-wide activities, and
          the attendance sessions under Sessions &amp; Points.
        </Callout>
        {confirmField('resetAllActivities')}
        <button
          type="button"
          onClick={() => run('resetAllActivities')}
          disabled={!canRun('resetAllActivities')}
          className={buttonClass('danger')}
        >
          <AlertTriangle className="h-4 w-4" aria-hidden />
          {busy === 'resetAllActivities' ? 'Resetting…' : 'Reset all activities'}
        </button>
      </div>

      {/* Delete every student in one class — the prototype's fourth card. The
          port had only the church-wide reset, so an admin retiring a single
          class had nothing between one student at a time and wiping the lot. */}
      <div className="space-y-3.5 border-b border-dashed border-[#FCA5A5] p-[18px]">
        <div>
          <h3 className="text-[13px] font-bold text-parch-900">Delete all students in a class</h3>
          <p className="mt-0.5 text-[12px] text-parch-600">
            For a class that has finished or is being retired.
          </p>
        </div>
        <Callout tone="bad" title="This permanently deletes">
          Every student in the chosen class, and with them their points, attendance, quiz results, Bible reading logs,
          achievements and follow-up cases.
          <p className="mt-1.5 font-bold">Kept:</p>
          the class itself and its servants.
        </Callout>
        <label className="block">
          <span className={CAPTION}>Class</span>
          <select
            value={classFor.deleteClassStudents}
            onChange={(e) => setClassFor((prev) => ({ ...prev, deleteClassStudents: e.target.value }))}
            className={cn(selectClass, 'min-h-[40px] max-w-xs')}
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {confirmField('deleteClassStudents')}
        <button
          type="button"
          onClick={() => run('deleteClassStudents')}
          disabled={!canRun('deleteClassStudents') || !classFor.deleteClassStudents}
          className={buttonClass('danger')}
        >
          <AlertTriangle className="h-4 w-4" aria-hidden />
          {busy === 'deleteClassStudents' ? 'Deleting…' : 'Delete students'}
        </button>
      </div>

      {/* Clear a class's points */}
      <div className="space-y-3.5 p-[18px]">
        <div>
          <h3 className="text-[13px] font-bold text-parch-900">Clear a class&rsquo;s points</h3>
          <p className="mt-0.5 text-[12px] text-parch-600">Resets the leaderboard for one class.</p>
        </div>
        <Callout tone="bad" title="This permanently deletes">
          Every point entry for every student in the chosen class.
          <p className="mt-1.5 font-bold">Kept:</p>
          attendance records, the students themselves, and the class.
        </Callout>
        <label className="block">
          <span className={CAPTION}>Class</span>
          <select
            value={classFor.clearPoints}
            onChange={(e) => setClassFor((prev) => ({ ...prev, clearPoints: e.target.value }))}
            className={cn(selectClass, 'min-h-[40px] max-w-xs')}
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {confirmField('clearPoints')}
        <button
          type="button"
          onClick={() => run('clearPoints')}
          disabled={!canRun('clearPoints') || !classFor.clearPoints}
          className={buttonClass('danger')}
        >
          <AlertTriangle className="h-4 w-4" aria-hidden />
          {busy === 'clearPoints' ? 'Clearing…' : 'Clear points'}
        </button>
      </div>
    </Card>
  )
}

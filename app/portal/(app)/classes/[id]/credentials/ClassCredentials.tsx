'use client'

import { useState, useTransition } from 'react'
import { KeyRound, Printer } from 'lucide-react'
import { resetClassPins, type ClassCredential } from '@/lib/portal/actions/admin'
import { reissueStudentPins, revealStudentLogins } from '@/lib/portal/actions/student-logins'
import { CONFIRM_PHRASE } from '@/lib/portal/reports'
import { Card, Callout, buttonClass, inputClass } from '@/components/portal/ui'
import { cn } from '@/lib/utils'

export interface ClassLogin {
  studentId: string
  accountId: string
  name: string
  loginId: string
  onFile: boolean
}

/**
 * A class's login sheet.
 *
 * Since option B (2026-09-26) the PINs the portal issues keep a sealed copy, so
 * "Current logins" prints the PINs the children already use without changing
 * any of them, and fills the gaps with new PINs only for the ones not on file.
 * Since 2026-10-04 that is for the class's servants and stage overseer as well
 * as the admin. The full reset below is the admin's alone, for a fresh start;
 * it invalidates every PIN in the class, so it takes a typed confirmation.
 */
export function ClassCredentials({
  classId,
  className,
  studentCount,
  students,
  vaultEnabled,
  canResetAll,
}: {
  classId: string
  className: string
  studentCount: number
  students: ClassLogin[]
  vaultEnabled: boolean
  /** The admin: the whole-class reset. */
  canResetAll: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [typed, setTyped] = useState('')
  const [error, setError] = useState('')
  const [rows, setRows] = useState<ClassCredential[] | null>(null)

  const phrase = CONFIRM_PHRASE.resetClassPins

  if (rows) {
    return (
      <>
        <div className="mb-4 print:hidden">
          {vaultEnabled ? (
            <Callout tone="good" title="New PINs issued">
              They are kept on file, so you can print them again later from Current logins. The old PINs
              no longer work.
            </Callout>
          ) : (
            <Callout tone="warn" title="Write these down or print them now">
              They are not stored in readable form and cannot be shown again. If you lose this page you
              will have to reset the PINs a second time.
            </Callout>
          )}
          <div className="mt-3">
            <button type="button" onClick={() => window.print()} className={buttonClass('primary')}>
              <Printer className="h-4 w-4" aria-hidden /> Print this sheet
            </button>
          </div>
        </div>

        <Card bodyClassName="p-0">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-parch-200 text-left text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">
                <th className="px-4 py-2.5">Student</th>
                <th className="px-4 py-2.5 text-right">ID</th>
                <th className="px-4 py-2.5 text-right">PIN</th>
                <th className="w-[40%] px-4 py-2.5">Given to</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.studentId} className="border-b border-[#F5F2ED]">
                  <td className="px-4 py-2 font-semibold text-parch-900">{r.name}</td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums">{r.loginId}</td>
                  <td className="px-4 py-2 text-right font-mono text-[14px] font-bold tabular-nums text-brand-800">{r.pin}</td>
                  {/* A blank column, because the sheet is handed round and
                      ticked off on paper as each family collects theirs. */}
                  <td className="px-4 py-2 text-parch-300">&nbsp;</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </>
    )
  }

  if (!canResetAll) return <CurrentLogins students={students} vaultEnabled={vaultEnabled} />

  return (
    <>
      <CurrentLogins students={students} vaultEnabled={vaultEnabled} />
      <Card
        className="border-[#FCA5A5] border-l-[#DC2626] print:hidden"
        title={<span className="text-[#B91C1C]">Reset and print PINs</span>}
        icon={<KeyRound className="h-4 w-4 text-[#DC2626]" aria-hidden />}
      >
        <Callout tone="bad" title="This changes every PIN in the class">
          All {studentCount} student{studentCount === 1 ? '' : 's'} in {className} get a new PIN. The PINs
          they use now stop working the moment you press the button, so only do this when you are ready
          to hand the sheet out.
          <p className="mt-1.5">
            {vaultEnabled
              ? 'To print the PINs the class uses now without changing them, use Current logins above.'
              : 'PIN viewing is switched off on this site, so resetting is the only way to produce a sheet.'}
          </p>
        </Callout>

        <label className="mt-3.5 block">
          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">
            Type <span className="font-mono text-[12px] font-bold normal-case tracking-normal text-[#B91C1C]">{phrase}</span> to confirm
          </span>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            className={cn(inputClass, 'min-h-[40px] max-w-xs font-mono')}
            placeholder={phrase}
            autoComplete="off"
            spellCheck={false}
          />
        </label>

        {error && <div className="mt-3" role="alert"><Callout tone="bad">{error}</Callout></div>}

        <div className="mt-3.5">
          <button
            type="button"
            disabled={pending || typed.trim() !== phrase}
            className={buttonClass('danger')}
            onClick={() => {
              setError('')
              startTransition(async () => {
                const r = await resetClassPins(classId, typed)
                if (!r.ok) return setError(r.error)
                setRows(r.data!.rows)
              })
            }}
          >
            <KeyRound className="h-4 w-4" aria-hidden />
            {pending ? 'Resetting…' : `Reset ${studentCount} PIN${studentCount === 1 ? '' : 's'}`}
          </button>
        </div>
      </Card>
    </>
  )
}

/**
 * The PINs the class uses now, read from the sealed copies. Nothing changes
 * unless somebody asks for new PINs for the children with none on file.
 */
function CurrentLogins({ students, vaultEnabled }: { students: ClassLogin[]; vaultEnabled: boolean }) {
  const [pending, startTransition] = useTransition()
  const [pins, setPins] = useState<Map<string, string | null> | null>(null)
  const [typed, setTyped] = useState('')
  const [error, setError] = useState('')
  const phrase = CONFIRM_PHRASE.reissuePins
  const onFileCount = students.filter((s) => s.onFile).length
  const missing = pins ? students.filter((s) => !pins.get(s.accountId)) : []

  function show() {
    setError('')
    startTransition(async () => {
      const ids = students.filter((s) => s.onFile).map((s) => s.studentId)
      const next = new Map<string, string | null>(students.map((s) => [s.accountId, null]))
      if (ids.length > 0) {
        const r = await revealStudentLogins(ids)
        if (!r.ok) return setError(r.error)
        for (const row of r.data!.rows) next.set(row.accountId, row.pin)
      }
      setPins(next)
    })
  }

  function reissueMissing() {
    setError('')
    startTransition(async () => {
      const r = await reissueStudentPins(
        missing.map((s) => s.studentId),
        typed,
      )
      if (!r.ok) return setError(r.error)
      setPins((prev) => {
        const next = new Map(prev ?? [])
        for (const row of r.data!.rows) next.set(row.accountId, row.pin)
        return next
      })
      setTyped('')
    })
  }

  if (!pins) {
    return (
      <Card title="Current logins" icon={<KeyRound className="h-4 w-4" aria-hidden />} className="mb-4 print:hidden">
        <p className="text-[12.5px] text-parch-700">
          {onFileCount} of {students.length} have a PIN on file. Showing them changes nothing, and it is written to the
          activity log.
        </p>
        {!vaultEnabled && (
          <p className="mt-1 text-[11.5px] text-parch-500">PIN viewing is switched off on this site (PORTAL_PIN_KEY is not set).</p>
        )}
        <button type="button" disabled={pending || !vaultEnabled} onClick={show} className={cn(buttonClass('primary'), 'mt-3 min-h-[40px]')}>
          {pending ? 'Opening…' : 'Show current logins'}
        </button>
        {error && (
          <div className="mt-3" role="alert">
            <Callout tone="bad">{error}</Callout>
          </div>
        )}
      </Card>
    )
  }

  return (
    <div className="mb-4">
      <div className="mb-3 flex flex-wrap gap-2 print:hidden">
        <button type="button" onClick={() => window.print()} className={buttonClass('primary')}>
          <Printer className="h-4 w-4" aria-hidden /> Print this sheet
        </button>
      </div>
      <Card bodyClassName="p-0">
        <table className="w-full text-[12.5px]" data-testid="current-logins">
          <thead>
            <tr className="border-b border-parch-200 text-left text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">
              <th className="px-4 py-2.5">Student</th>
              <th className="px-4 py-2.5 text-right">ID</th>
              <th className="px-4 py-2.5 text-right">PIN</th>
              <th className="w-[40%] px-4 py-2.5">Given to</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const pin = pins.get(s.accountId)
              return (
                <tr key={s.accountId} className="border-b border-[#F5F2ED]">
                  <td className="px-4 py-2 font-semibold text-parch-900">{s.name}</td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums">{s.loginId}</td>
                  <td className="px-4 py-2 text-right font-mono text-[14px] font-bold tabular-nums text-brand-800">
                    {pin ?? <span className="text-[11px] font-semibold text-parch-500">Not on file</span>}
                  </td>
                  {/* A blank column, because the sheet is handed round and
                      ticked off on paper as each family collects theirs. */}
                  <td className="px-4 py-2 text-parch-300">&nbsp;</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>
      {missing.length > 0 && (
        <div className="mt-3 print:hidden">
          <Callout tone="warn" title={`${missing.length} without a PIN on file`}>
            Give them a new PIN to complete the sheet. The PIN they use now stops working.
            <label className="mt-2.5 block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">
                Type <span className="font-mono text-[12px] normal-case tracking-normal text-[#B91C1C]">{phrase}</span> to confirm
              </span>
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                className={cn(inputClass, 'max-w-xs font-mono')}
                placeholder={phrase}
                autoComplete="off"
                spellCheck={false}
                aria-label="Confirmation phrase"
              />
            </label>
            <button
              type="button"
              disabled={pending || typed.trim() !== phrase}
              onClick={reissueMissing}
              className={cn(buttonClass('danger'), 'mt-2.5 min-h-[40px]')}
            >
              {pending ? 'Issuing…' : `Give ${missing.length} new PIN${missing.length === 1 ? '' : 's'}`}
            </button>
          </Callout>
        </div>
      )}
      {error && (
        <div className="mt-3" role="alert">
          <Callout tone="bad">{error}</Callout>
        </div>
      )}
    </div>
  )
}

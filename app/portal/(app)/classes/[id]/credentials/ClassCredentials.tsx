'use client'

import { useState, useTransition } from 'react'
import { KeyRound, Printer } from 'lucide-react'
import { resetClassPins, type ClassCredential } from '@/lib/portal/actions/admin'
import { CONFIRM_PHRASE } from '@/lib/portal/reports'
import { Card, Callout, buttonClass, inputClass } from '@/components/portal/ui'
import { cn } from '@/lib/utils'

/**
 * Mint a fresh PIN for every student in a class and print the sheet.
 *
 * The prototype exported a plaintext PIN column. PINs are hashed here, so no
 * export can read them back — the equivalent is to reset and show them once.
 * That invalidates the PINs in use, so it takes a typed confirmation, and the
 * sheet exists only in this page: leaving or reloading loses it for good.
 */
export function ClassCredentials({ classId, className, studentCount }: { classId: string; className: string; studentCount: number }) {
  const [pending, startTransition] = useTransition()
  const [typed, setTyped] = useState('')
  const [error, setError] = useState('')
  const [rows, setRows] = useState<ClassCredential[] | null>(null)

  const phrase = CONFIRM_PHRASE.resetClassPins

  if (rows) {
    return (
      <>
        <div className="mb-4 print:hidden">
          <Callout tone="warn" title="Write these down or print them now">
            They are not stored in readable form and cannot be shown again. If you lose this page you
            will have to reset the PINs a second time.
          </Callout>
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

  return (
    <Card
      className="border-[#FCA5A5] border-l-[#DC2626]"
      title={<span className="text-[#B91C1C]">Reset and print PINs</span>}
      icon={<KeyRound className="h-4 w-4 text-[#DC2626]" aria-hidden />}
    >
      <Callout tone="bad" title="This changes every PIN in the class">
        All {studentCount} student{studentCount === 1 ? '' : 's'} in {className} get a new PIN. The PINs
        they use now stop working the moment you press the button, so only do this when you are ready
        to hand the sheet out.
        <p className="mt-1.5">
          PINs are stored as hashes, so there is no way to read the existing ones — resetting is the
          only way to produce a sheet.
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
  )
}

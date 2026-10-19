'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarOff } from 'lucide-react'
import { addExcuse, removeExcuse, updateExcuse } from '@/lib/portal/actions/excuses'
import { EXCUSE_REASON_MAX, excuseDatesProblem, type ExcuseView } from '@/lib/portal/excuses'
import { buttonClass, inputClass, textareaClass } from './ui'
import { cn } from '@/lib/utils'

/**
 * Excuse a child from follow-up, or change or remove an excuse (2026-10-19).
 * Any servant of the child's class may, whoever's group the child is in; the
 * excuse then says who set it and who changed it last.
 */
export function ExcuseControl({
  studentId,
  studentName,
  today,
  excuse,
}: {
  studentId: string
  studentName: string
  today: string
  /** The excuse to change; without one, the control adds a new one. */
  excuse?: ExcuseView | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [startsOn, setStartsOn] = useState(excuse?.startsOn ?? today)
  const [endsOn, setEndsOn] = useState(excuse?.endsOn ?? '')
  const [reason, setReason] = useState(excuse?.reason ?? '')
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const small = cn(buttonClass('secondary', 'sm'), 'min-h-[36px]')

  function save() {
    // Said here first so a phone with a slow connection answers at once; the
    // server checks the same rule again.
    const problem = excuseDatesProblem(startsOn, endsOn) ?? (reason.trim() ? null : 'Say why they are excused.')
    if (problem) return setMessage({ ok: false, text: problem })
    setMessage(null)
    startTransition(async () => {
      const r = excuse
        ? await updateExcuse({ excuseId: excuse.id, startsOn, endsOn, reason })
        : await addExcuse({ studentId, startsOn, endsOn, reason })
      if (!r.ok) return setMessage({ ok: false, text: r.error })
      setOpen(false)
      setMessage({ ok: true, text: excuse ? 'Excuse changed.' : 'Excused.' })
      if (!excuse) {
        setStartsOn(today)
        setEndsOn('')
        setReason('')
      }
      router.refresh()
    })
  }

  function remove() {
    if (!excuse) return
    if (!window.confirm(`Remove this excuse for ${studentName}? They will be followed up as usual again.`)) return
    setMessage(null)
    startTransition(async () => {
      const r = await removeExcuse(excuse.id)
      if (!r.ok) return setMessage({ ok: false, text: r.error })
      router.refresh()
    })
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            // Filled from the excuse as it is now: after a save and a refresh
            // this control can be holding an excuse it did not start with.
            setStartsOn(excuse?.startsOn ?? today)
            setEndsOn(excuse?.endsOn ?? '')
            setReason(excuse?.reason ?? '')
            setOpen(true)
            setMessage(null)
          }}
          className={small}
          aria-label={excuse ? `Change the excuse for ${studentName}` : `Excuse ${studentName} from follow-up`}
        >
          <CalendarOff className="h-3.5 w-3.5" aria-hidden /> {excuse ? 'Change' : 'Excuse'}
        </button>
        {excuse && (
          <button type="button" disabled={pending} onClick={remove} className={cn(buttonClass('ghost', 'sm'), 'min-h-[36px]')}>
            Remove
          </button>
        )}
        {message && (
          <span role="status" className={cn('text-[11.5px] font-semibold', message.ok ? 'text-[#15803D]' : 'text-[#B91C1C]')}>
            {message.text}
          </span>
        )}
      </div>
    )
  }

  const id = (name: string) => `excuse-${excuse?.id ?? studentId}-${name}`
  return (
    <form
      className="space-y-2 rounded-[12px] border border-parch-200 bg-parch-50 p-3"
      aria-label={excuse ? `Change the excuse for ${studentName}` : `Excuse ${studentName} from follow-up`}
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        <label htmlFor={id('from')} className="flex flex-col gap-1 text-[11px] font-bold text-parch-700">
          From
          <input id={id('from')} type="date" required value={startsOn} onChange={(e) => setStartsOn(e.target.value)} className={inputClass} />
        </label>
        <label htmlFor={id('to')} className="flex flex-col gap-1 text-[11px] font-bold text-parch-700">
          Until (last day)
          <input id={id('to')} type="date" required min={startsOn || undefined} value={endsOn} onChange={(e) => setEndsOn(e.target.value)} className={inputClass} />
        </label>
      </div>
      <label htmlFor={id('reason')} className="flex flex-col gap-1 text-[11px] font-bold text-parch-700">
        Reason
        <textarea
          id={id('reason')}
          required
          rows={2}
          maxLength={EXCUSE_REASON_MAX}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className={textareaClass}
          placeholder="Travelling with family, ill, …"
        />
      </label>
      <p className="text-[11px] text-parch-500">
        They stay on every list, marked excused, and nobody has to follow them up until the last day. Sundays missed
        in between don&rsquo;t count.
      </p>
      {message && !message.ok && (
        <p role="alert" className="text-[11.5px] font-semibold text-[#B91C1C]">
          {message.text}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={cn(buttonClass('primary', 'sm'), 'min-h-[36px]')}>
          {pending ? 'Saving…' : excuse ? 'Save changes' : 'Excuse'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={cn(buttonClass('ghost', 'sm'), 'min-h-[36px]')}>
          Cancel
        </button>
      </div>
    </form>
  )
}

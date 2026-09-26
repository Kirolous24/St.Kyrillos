'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { PhoneCall } from 'lucide-react'
import { logCheckIn } from '@/lib/portal/actions/followups'
import { CONTACT_METHODS } from '@/lib/portal/followups'
import { buttonClass, selectClass, textareaClass } from './ui'
import { cn } from '@/lib/utils'

/** Every way of reaching a family, except the entry a case writes when it is resolved. */
type Method = Exclude<(typeof CONTACT_METHODS)[number]['key'], 'resolved'>
const METHODS = CONTACT_METHODS.filter((m): m is (typeof CONTACT_METHODS)[number] & { key: Method } => m.key !== 'resolved')

const RESULTS = [
  { key: 'reached', label: 'Reached' },
  { key: 'no_answer', label: 'No answer' },
  { key: 'left_message', label: 'Left message' },
  { key: 'will_come', label: 'Will come' },
  { key: 'other', label: 'Other' },
] as const

/** Log a call, text or visit on any child, from My Group or their profile. */
export function CheckInButton({ studentId, studentName }: { studentId: string; studentName: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [method, setMethod] = useState<Method>('call')
  const [result, setResult] = useState<(typeof RESULTS)[number]['key']>('reached')
  const [note, setNote] = useState('')
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => { setOpen(true); setMessage(null) }} className={cn(buttonClass('secondary', 'sm'), 'min-h-[36px]')}>
          <PhoneCall className="h-3.5 w-3.5" aria-hidden /> Log check-in
        </button>
        {message && <span role="status" className={cn('text-[11.5px] font-semibold', message.ok ? 'text-[#15803D]' : 'text-[#B91C1C]')}>{message.text}</span>}
      </div>
    )
  }

  return (
    <form
      className="space-y-2 rounded-[12px] border border-parch-200 bg-parch-50 p-3"
      aria-label={`Check-in for ${studentName}`}
      onSubmit={(e) => {
        e.preventDefault()
        startTransition(async () => {
          const r = await logCheckIn({ studentId, method, result, note })
          if (!r.ok) return setMessage({ ok: false, text: r.error })
          setOpen(false)
          setNote('')
          setMessage({ ok: true, text: r.data?.onCase ? 'Logged on their open case.' : 'Check-in logged.' })
          router.refresh()
        })
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        <select aria-label="How" value={method} onChange={(e) => setMethod(e.target.value as typeof method)} className={selectClass}>
          {METHODS.map((m) => (
            <option key={m.key} value={m.key}>{m.label}</option>
          ))}
        </select>
        <select aria-label="Result" value={result} onChange={(e) => setResult(e.target.value as typeof result)} className={selectClass}>
          {RESULTS.map((r) => (
            <option key={r.key} value={r.key}>{r.label}</option>
          ))}
        </select>
      </div>
      <textarea aria-label="Note" value={note} onChange={(e) => setNote(e.target.value)} className={textareaClass} rows={2} maxLength={1000} placeholder="What was said (optional)" />
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={cn(buttonClass('primary', 'sm'), 'min-h-[36px]')}>{pending ? 'Saving…' : 'Save'}</button>
        <button type="button" onClick={() => setOpen(false)} className={cn(buttonClass('ghost', 'sm'), 'min-h-[36px]')}>Cancel</button>
      </div>
    </form>
  )
}

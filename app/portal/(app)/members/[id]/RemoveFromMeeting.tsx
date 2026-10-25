'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { UserMinus } from 'lucide-react'
import { removeMemberFromMeeting } from '@/lib/portal/actions/fellowship'
import { buttonClass } from '@/components/portal/ui'
import { cn } from '@/lib/utils'

/**
 * Take a member out of a meeting (2026-10-24), asked twice. Their record and
 * attendance stay (the user's word), and People who left can add them back.
 */
export function RemoveFromMeeting({
  classId,
  meetingName,
  studentId,
  name,
}: {
  classId: string
  meetingName: string
  studentId: string
  name: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [asking, setAsking] = useState(false)
  const [error, setError] = useState('')

  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} className={buttonClass('danger')}>
        <UserMinus className="h-4 w-4" aria-hidden /> Remove from {meetingName}
      </button>
    )
  }
  return (
    <span role="group" aria-label={`Remove ${name} from ${meetingName}`} className="inline-flex flex-wrap items-center gap-2 rounded-[10px] border border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2 text-[12px] text-[#991B1B]">
      <span>
        {`Remove ${name} from ${meetingName}? Their record and attendance stay, and you can add them back later.`}
      </span>
      <button
        type="button"
        disabled={pending}
        className={cn(buttonClass('danger', 'sm'), 'min-h-[34px]')}
        onClick={() =>
          startTransition(async () => {
            setError('')
            const r = await removeMemberFromMeeting(classId, studentId)
            if (!r.ok) return setError(r.error)
            router.push(`/portal/classes/${classId}`)
            router.refresh()
          })
        }
      >
        {pending ? 'Removing…' : 'Remove'}
      </button>
      <button type="button" onClick={() => setAsking(false)} className={cn(buttonClass('ghost', 'sm'), 'min-h-[34px]')}>
        Cancel
      </button>
      {error && <span role="alert" className="w-full font-semibold">{error}</span>}
    </span>
  )
}

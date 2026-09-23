'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Undo2 } from 'lucide-react'
import { undoPoints } from '@/lib/portal/actions/points'
import { buttonClass } from '@/components/portal/ui'
import { cn } from '@/lib/utils'

/**
 * Undo, on the student's own ledger.
 *
 * The action already existed and worked — but only from the class-wide Points
 * page. A servant who spotted a wrong entry while looking at the child's own
 * profile had to go and find it again in a list of every student's entries.
 */
export function UndoEntryButton({ entryId, label }: { entryId: string; label: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={pending}
      aria-label={`Undo ${label}`}
      title="Undo this entry"
      className={cn(buttonClass('secondary', 'sm'), 'shrink-0 px-2.5')}
      onClick={() =>
        startTransition(async () => {
          const r = await undoPoints(entryId)
          if (!r.ok) alert(r.error)
          router.refresh()
        })
      }
    >
      <Undo2 className="h-3.5 w-3.5" aria-hidden />
    </button>
  )
}

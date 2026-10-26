'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarRange, ExternalLink, Pencil } from 'lucide-react'
import { setPlannerLink } from '@/lib/portal/actions/agenda'
import { Card, buttonClass, inputClass } from './ui'
import { cn } from '@/lib/utils'

/**
 * The planner (2026-10-25): one link, the same for every class, always on My
 * Assignments and the Schedule. Servants see it once the admin has added it;
 * the admin adds or changes it here.
 */
export function PlannerCard({ url, canEdit }: { url: string | null; canEdit: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(url ?? '')
  const [error, setError] = useState<string | null>(null)

  if (!url && !canEdit) return null

  function save(next: string) {
    setError(null)
    startTransition(async () => {
      const r = await setPlannerLink(next)
      if (!r.ok) return setError(r.error)
      setEditing(false)
      setValue(r.data?.url ?? '')
      router.refresh()
    })
  }

  return (
    <div className="mb-5" data-testid="planner-card">
      <Card
        title="Planner"
        icon={<CalendarRange className="h-[15px] w-[15px]" aria-hidden />}
        action={
          canEdit && !editing ? (
            <button type="button" onClick={() => setEditing(true)} className={cn(buttonClass('ghost', 'sm'), 'min-h-[36px]')}>
              <Pencil className="h-3.5 w-3.5" aria-hidden /> {url ? 'Change' : 'Add the link'}
            </button>
          ) : undefined
        }
      >
        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              save(value)
            }}
            className="flex flex-wrap items-center gap-2"
          >
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className={cn(inputClass, 'min-w-[220px] flex-1')}
              placeholder="https://…"
              inputMode="url"
              aria-label="Planner link"
              data-testid="planner-input"
            />
            <button type="submit" disabled={pending} className={cn(buttonClass('primary', 'sm'), 'min-h-[40px]')}>
              {pending ? 'Saving…' : 'Save'}
            </button>
            {url && (
              <button type="button" disabled={pending} onClick={() => save('')} className={cn(buttonClass('ghost', 'sm'), 'min-h-[40px]')}>
                Remove
              </button>
            )}
            <button type="button" disabled={pending} onClick={() => setEditing(false)} className={cn(buttonClass('ghost', 'sm'), 'min-h-[40px]')}>
              Cancel
            </button>
          </form>
        ) : url ? (
          <div className="flex flex-wrap items-center gap-3">
            <a href={url} target="_blank" rel="noopener noreferrer" className={cn(buttonClass('gold', 'sm'), 'min-h-[40px]')} data-testid="planner-link">
              <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Open the planner
            </a>
            <span className="text-[11.5px] text-parch-500">The same planner for every class.</span>
          </div>
        ) : (
          <p className="text-[12px] text-parch-500">No planner link yet. Add it once and every servant sees it here and on the Schedule.</p>
        )}
        {error && (
          <p role="alert" className="mt-2 text-[12px] font-semibold text-[#B91C1C]">
            {error}
          </p>
        )}
      </Card>
    </div>
  )
}

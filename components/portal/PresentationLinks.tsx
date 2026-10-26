'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ExternalLink, Pencil, Plus, Presentation } from 'lucide-react'
import { setWeekPresentation } from '@/lib/portal/actions/agenda'
import type { PresentationRow, PresentationWeek } from '@/lib/portal/agenda'
import { Card, buttonClass, inputClass } from './ui'
import { cn } from '@/lib/utils'

/**
 * Each class's presentation for the week (2026-10-25): "make sure people can
 * link the canva presentation too for the week for all servants … allow them
 * to see it". Every servant of a class sees this Sunday's and next Sunday's
 * here, and can add or change the link without opening the Schedule.
 */
export function PresentationLinks({ rows }: { rows: PresentationRow[] }) {
  if (rows.length === 0) return null
  return (
    <div className="mb-5" data-testid="presentations">
      <Card title="Presentations" icon={<Presentation className="h-[15px] w-[15px]" aria-hidden />} bodyClassName="p-0">
        <p className="border-b border-[#F0EEE8] px-[18px] py-2.5 text-[11.5px] text-parch-500">
          Each class has its own deck for the week. Anyone who serves the class can add or change it, and everyone serving it
          sees it here.
        </p>
        <ul>
          {rows.flatMap((r) =>
            r.weeks.map((w) => <WeekRow key={`${r.classId}:${w.weekStart}`} classId={r.classId} className={r.className} week={w} />),
          )}
        </ul>
      </Card>
    </div>
  )
}

function WeekRow({ classId, className, week }: { classId: string; className: string; week: PresentationWeek }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(week.url ?? '')
  const [error, setError] = useState<string | null>(null)

  function save(next: string) {
    setError(null)
    startTransition(async () => {
      const r = await setWeekPresentation({ classId, weekStart: week.weekStart, url: next })
      if (!r.ok) return setError(r.error)
      setEditing(false)
      setValue(r.data?.url ?? '')
      router.refresh()
    })
  }

  return (
    <li
      className="border-b-[0.5px] border-[#F0EEE8] px-[18px] py-3 last:border-b-0"
      data-presentation-class={classId}
      data-presentation-week={week.weekStart}
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-parch-900">{className}</p>
          <p className="text-[11.5px] text-parch-500">{week.title}</p>
        </div>
        {!editing &&
          (week.url ? (
            <>
              <a
                href={week.url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonClass('gold', 'sm'), 'min-h-[36px]')}
                data-testid="presentation-open"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Open
              </a>
              <button type="button" onClick={() => setEditing(true)} className={cn(buttonClass('ghost', 'sm'), 'min-h-[36px]')}>
                <Pencil className="h-3.5 w-3.5" aria-hidden /> Change
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className={cn(buttonClass('secondary', 'sm'), 'min-h-[36px]')}
              data-testid="presentation-add"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden /> Add link
            </button>
          ))}
      </div>
      {editing && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            save(value)
          }}
          className="mt-2 flex flex-wrap items-center gap-2"
        >
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className={cn(inputClass, 'min-w-[200px] flex-1')}
            placeholder="https://www.canva.com/design/…"
            inputMode="url"
            aria-label={`Presentation link for ${className}, ${week.title}`}
            data-testid="presentation-input"
          />
          <button type="submit" disabled={pending} className={cn(buttonClass('primary', 'sm'), 'min-h-[40px]')}>
            {pending ? 'Saving…' : 'Save'}
          </button>
          {week.url && (
            <button type="button" disabled={pending} onClick={() => save('')} className={cn(buttonClass('ghost', 'sm'), 'min-h-[40px]')}>
              Remove
            </button>
          )}
          <button type="button" disabled={pending} onClick={() => setEditing(false)} className={cn(buttonClass('ghost', 'sm'), 'min-h-[40px]')}>
            Cancel
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="mt-1.5 text-[12px] font-semibold text-[#B91C1C]">
          {error}
        </p>
      )}
    </li>
  )
}

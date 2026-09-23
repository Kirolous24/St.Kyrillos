'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { markMyServantAttendance } from '@/lib/portal/actions/servant-attendance'
import { Card, Callout, buttonClass } from '@/components/portal/ui'
import { formatLongDate } from '@/lib/portal/format'
import { cn } from '@/lib/utils'

type Status = 'PRESENT' | 'EXCUSED' | 'ABSENT'

const CHOICES: Array<{ value: Status; label: string; tone: string }> = [
  { value: 'PRESENT', label: 'Here', tone: 'bg-[#16A34A] text-white' },
  { value: 'EXCUSED', label: 'Excused', tone: 'bg-[#D97706] text-white' },
  { value: 'ABSENT', label: 'Away', tone: 'bg-[#DC2626] text-white' },
]

/**
 * Self check-in for the current week. `markMyServantAttendance` existed and
 * worked but nothing called it — the only way a servant could mark themselves
 * was the team-wide grid on Servants Attendance, a page that reads as a
 * coordinator tool, so plain servants did not know to look there.
 */
export function SelfCheckIn({
  weekStart,
  activities,
}: {
  weekStart: string
  activities: Array<{ key: string; label: string; status: Status | null }>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [saving, setSaving] = useState<string | null>(null)

  function mark(activityKey: string, status: Status) {
    setError('')
    setSaving(`${activityKey}:${status}`)
    startTransition(async () => {
      const result = await markMyServantAttendance({ activityKey, weekStart, status })
      setSaving(null)
      if (!result.ok) return setError(result.error)
      router.refresh()
    })
  }

  return (
    <Card
      title="Mark yourself this week"
      icon={<CheckCircle2 className="h-4 w-4" aria-hidden />}
      action={<span className="text-[11px] text-parch-500">Week of {formatLongDate(weekStart)}</span>}
    >
      {activities.length === 0 ? (
        <p className="text-[12.5px] text-parch-500">No servant activities are set up yet.</p>
      ) : (
        <ul className="space-y-2">
          {activities.map((a) => (
            <li
              key={a.key}
              className="flex flex-wrap items-center gap-2 rounded-[12px] border border-[#EFE9DC] bg-parch-100 px-3 py-2"
            >
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-bold text-parch-800">{a.label}</span>
              <span className="flex shrink-0 gap-1.5">
                {CHOICES.map((c) => {
                  const active = a.status === c.value
                  return (
                    <button
                      key={c.value}
                      type="button"
                      disabled={pending}
                      aria-pressed={active}
                      onClick={() => mark(a.key, c.value)}
                      className={cn(
                        'min-h-[32px] rounded-[8px] px-3 py-1 text-[11px] font-bold transition-colors',
                        active ? c.tone : 'border border-parch-200 bg-parch-50 text-parch-500 hover:text-brand-800',
                        saving === `${a.key}:${c.value}` && 'opacity-60',
                      )}
                    >
                      {c.label}
                    </button>
                  )
                })}
              </span>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <div className="mt-3">
          <Callout tone="bad">{error}</Callout>
        </div>
      )}
      <p className="mt-3 text-[11px] text-parch-500">
        This records only you. A coordinator marks the rest of the team on{' '}
        <a href="/portal/servant-attendance" className="font-semibold text-brand-800 underline">Servants Attendance</a>.
      </p>
    </Card>
  )
}

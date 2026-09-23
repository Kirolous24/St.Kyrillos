'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpenCheck, Check, Flame } from 'lucide-react'
import { checkInReading } from '@/lib/portal/actions/readings'
import { formatMonthDay } from '@/lib/portal/format'
import { Card, buttonClass, ProgressBar } from '@/components/portal/ui'
import { cn } from '@/lib/utils'

interface Props {
  checkedInToday: boolean
  streak: number
  totalDays: number
  /** 30 days, oldest first, ending today. */
  grid: Array<{ date: string; read: boolean; future: boolean }>
  /** "September 2026" — the prototype's own heading above the grid. */
  monthLabel: string
}

export function ReadingCheckIn({ checkedInToday, streak, totalDays, grid, monthLabel }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  // F0329 / F0754 — scored over the days that have actually happened. Dividing
  // by the whole month would tell a child on the 2nd that they were on 1/30.
  const elapsed = grid.filter((d) => !d.future)
  const readInWindow = elapsed.filter((d) => d.read).length
  const todayKey = elapsed.length > 0 ? elapsed[elapsed.length - 1]!.date : ''

  function checkIn() {
    setError('')
    startTransition(async () => {
      const result = await checkInReading()
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <Card title="My Bible reading" icon={<BookOpenCheck className="h-3.5 w-3.5" aria-hidden />} tone="brand">
      {/* Streak, exactly as the prototype's flame + Playfair figure. */}
      <div className="flex flex-wrap items-center gap-4">
        <span className="flex items-center gap-2.5">
          <Flame className={cn('h-6 w-6', streak > 0 ? 'text-brand-gold' : 'text-parch-400')} aria-hidden />
          <span className="leading-none">
            <span className="block font-serif text-[30px] font-bold leading-none text-brand-800 tabular-nums">{streak}</span>
            <span className="mt-1 block text-[9.5px] font-bold uppercase tracking-[0.6px] text-brand-gold-dark">
              Day{streak === 1 ? '' : 's'} in a row
            </span>
          </span>
        </span>
        <span aria-hidden className="hidden h-9 w-px bg-parch-200 sm:block" />
        <span className="text-[12px] text-parch-500">
          <span className="font-bold text-parch-800 tabular-nums">{totalDays}</span> day{totalDays === 1 ? '' : 's'} altogether
        </span>
      </div>

      <div className="mt-4">
        {checkedInToday ? (
          /* F0331 — the prototype answered back: "Marked as read — keep it up!".
             The port swapped in the green pill and nothing else, so a child tapped
             "I read today" and the page just moved under them, with the streak the
             action already counts never said out loud. Written from checkedInToday
             rather than from a transient flag on purpose: it appears the moment the
             pill does, and it survives the router.refresh() that follows. */
          <div className="space-y-1.5">
            <p className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[10px] border-[1.5px] border-[#BBF7D0] bg-[#F0FDF4] px-3.5 text-[13px] font-bold text-[#16A34A]">
              <Check className="h-4 w-4" aria-hidden /> Done for today
            </p>
            <p role="status" className="text-center text-[12px] font-semibold text-brand-gold-dark">
              {streak > 1
                ? `Marked as read — ${streak} days in a row, keep it up!`
                : 'Marked as read — keep it up!'}
            </p>
          </div>
        ) : (
          <button type="button" onClick={checkIn} disabled={pending} className={cn(buttonClass('primary'), 'w-full py-3 text-[13px]')}>
            <BookOpenCheck className="h-4 w-4" aria-hidden />
            {pending ? 'Saving…' : 'I read today'}
          </button>
        )}
        {error && <p role="alert" className="mt-2 text-[12px] font-bold text-red-700">{error}</p>}
      </div>

      <div className="mt-5">
        <div className="mb-2.5 flex items-baseline justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-parch-500">{monthLabel}</p>
          <p className="text-[11px] text-parch-500 tabular-nums">
            {readInWindow}/{elapsed.length} so far
          </p>
        </div>
        <ol className="grid grid-cols-10 gap-1.5">
          {grid.map((day) => {
            const dayNum = Number(day.date.slice(8, 10))
            const isToday = day.date === todayKey
            return (
              <li key={day.date}>
                <span
                  title={`${formatMonthDay(day.date)}${day.read ? ' — read' : ''}`}
                  className={cn(
                    'grid aspect-square place-items-center rounded-[8px] text-[11px] font-bold',
                    day.read
                      ? 'bg-[linear-gradient(160deg,#6F1D1B,#7A2A2A)] text-brand-gold shadow-[0_2px_6px_rgba(90,31,31,.25)]'
                      : day.future
                        // Not yet, rather than missed: a month grid contains days
                        // that have not happened, and colouring them like a
                        // skipped day would read as a month already lost.
                        ? 'bg-parch-50 text-parch-300 ring-1 ring-inset ring-[#F0EEE8]'
                        : 'bg-parch-100 text-parch-500',
                    isToday && 'shadow-[0_0_0_2px_#C89B3C,0_2px_8px_rgba(200,155,60,.35)]',
                  )}
                >
                  <span aria-hidden>{dayNum}</span>
                  <span className="sr-only">
                    {formatMonthDay(day.date)}
                    {day.read ? ': read' : day.future ? ': still to come' : ': not checked in'}
                  </span>
                </span>
              </li>
            )
          })}
        </ol>
        <div className="mt-3">
          <ProgressBar value={(readInWindow / 30) * 100} tone="brand" label="Days read in the last 30" />
        </div>
      </div>
    </Card>
  )
}

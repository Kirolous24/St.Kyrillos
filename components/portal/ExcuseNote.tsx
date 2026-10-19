import { CalendarOff } from 'lucide-react'
import { excuseByLine, excuseState, excuseSummary, type ExcuseView } from '@/lib/portal/excuses'
import { cn } from '@/lib/utils'

/**
 * A child's follow-up excuse wherever a servant meets the child (2026-10-19):
 * the dates, the reason in the servant's own words, and who set it and who
 * changed it. Blue while it is on, plain once it is over or still to come.
 */
export function ExcuseNote({ excuse, today, className }: { excuse: ExcuseView; today: string; className?: string }) {
  const state = excuseState(excuse, today)
  const on = state === 'active'
  return (
    <div
      data-testid="excuse-note"
      data-state={state}
      className={cn(
        'rounded-[10px] border px-3 py-2 text-[12px]',
        on ? 'border-[#DBEAFE] bg-[#DBEAFE]/50' : 'border-parch-200 bg-parch-50',
        className,
      )}
    >
      <p className={cn('flex items-center gap-1.5 font-bold', on ? 'text-[#2563EB]' : 'text-parch-700')}>
        <CalendarOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {excuseSummary(excuse, today)}
      </p>
      <p className="mt-0.5 whitespace-pre-wrap break-words text-parch-800">{excuse.reason}</p>
      <p className="mt-0.5 text-[11px] text-parch-500">{excuseByLine(excuse)}</p>
    </div>
  )
}

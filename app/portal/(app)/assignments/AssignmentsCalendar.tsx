import Link from '@/components/portal/Link'
import { Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { monthGrid, monthLabel, monthSundays, shiftMonth, spanQuery, termOf, type CalendarSpan } from '@/lib/portal/calendar-spans'
import { formatShortDate } from '@/lib/portal/format'
import type { Assignment } from '@/lib/portal/agenda'
import { accentFor, accentTint } from '@/lib/portal/accents'
import { TabLink } from '@/components/portal/ui'
import { cn } from '@/lib/utils'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** What a chip says: the part, and the topic when it is one of the class's parts. */
function chipText(a: Assignment): string {
  return a.kind === 'agenda' && a.detail ? `${a.title}: ${a.detail}` : a.title
}

/**
 * My Assignments as a calendar (2026-11-01): "a calendar where u can see what
 * you're preparing over the course of a month or semester". A month shows as
 * a grid with every Sunday listed under it; a semester lists its Sundays month
 * by month. Sundays with nothing on them are shown too, so a free Sunday is
 * visible at a glance.
 */
export function AssignmentsCalendar({
  span,
  days,
  today,
}: {
  span: CalendarSpan
  /** The servant's assignments by the day they fall on, within the span. */
  days: Map<string, Assignment[]>
  today: string
}) {
  const href = (kind: CalendarSpan['kind'], key: string) => `/portal/assignments?view=calendar&${spanQuery(kind, key)}`
  const monthKey = span.kind === 'month' ? span.key : today >= span.start && today <= span.end ? today.slice(0, 7) : span.start.slice(0, 7)
  const termKey = span.kind === 'semester' ? span.key : termOf(span.start).key
  // The months the span covers, each with its Sundays and any other day that has something on it.
  const months: Array<{ key: string; days: string[] }> = []
  for (let m = span.start.slice(0, 7); m <= span.end.slice(0, 7); m = shiftMonth(m, 1)) {
    const listed = new Set([...monthSundays(m), ...Array.from(days.keys()).filter((d) => d.slice(0, 7) === m)])
    months.push({ key: m, days: Array.from(listed).sort() })
  }
  const total = Array.from(days.values()).reduce((n, list) => n + list.length, 0)

  return (
    <div data-testid="assignments-calendar">
      <nav aria-label="Month or semester" className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
        <TabLink href={href('month', monthKey)} active={span.kind === 'month'}>
          Month
        </TabLink>
        <TabLink href={href('semester', termKey)} active={span.kind === 'semester'}>
          Semester
        </TabLink>
        <span className="ml-auto flex items-center gap-1.5">
          <Link href={href(span.kind, span.prev)} aria-label="Earlier" className="inline-flex min-h-[40px] items-center rounded-[20px] border border-parch-200 bg-parch-50 px-3 text-parch-700 hover:border-brand-gold/60">
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Link>
          <span className="min-w-[120px] text-center text-[13px] font-bold text-parch-900">{span.label}</span>
          <Link href={href(span.kind, span.next)} aria-label="Later" className="inline-flex min-h-[40px] items-center rounded-[20px] border border-parch-200 bg-parch-50 px-3 text-parch-700 hover:border-brand-gold/60">
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        </span>
      </nav>

      <p className="mb-3 text-[12px] text-parch-500">
        {total === 0 ? `Nothing assigned to you in ${span.label} yet.` : `${total} assignment${total === 1 ? '' : 's'} in ${span.label}.`}
      </p>

      {span.kind === 'month' && (
        <div className="mb-5 overflow-hidden rounded-[16px] border border-parch-200 bg-parch-50 shadow-card" data-testid="month-grid">
          <div className="grid grid-cols-7 border-b border-[#F0EEE8] bg-[#F3EFE6]">
            {WEEKDAYS.map((d) => (
              <span key={d} className="px-1 py-2 text-center text-[10.5px] font-bold uppercase tracking-[0.6px] text-brand-800">
                {d}
              </span>
            ))}
          </div>
          {monthGrid(span.key).map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 border-b border-[#F0EEE8] last:border-b-0">
              {week.map((day, di) => {
                const items = day ? days.get(day) ?? [] : []
                return (
                  <div
                    key={di}
                    data-day={day ?? undefined}
                    className={cn(
                      'min-h-[52px] border-r border-[#F0EEE8] p-1 last:border-r-0 sm:min-h-[84px] sm:p-1.5',
                      !day && 'bg-parch-100/50',
                      items.length > 0 && 'bg-[#FDF5E4]',
                    )}
                  >
                    {day && (
                      <>
                        <span
                          className={cn(
                            'inline-flex h-6 w-6 items-center justify-center rounded-full text-[11.5px] font-bold',
                            day === today ? 'bg-brand-800 text-white' : di === 0 ? 'text-brand-800' : 'text-parch-500',
                          )}
                        >
                          {Number(day.slice(8))}
                        </span>
                        {/* A phone has room for dots; a wider screen names the parts. */}
                        {items.length > 0 && (
                          <span className="mt-0.5 flex flex-wrap gap-0.5 sm:hidden" aria-label={`${items.length} assignment${items.length === 1 ? '' : 's'}`}>
                            {items.slice(0, 4).map((a) => (
                              <span key={a.id} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accentFor(a.classId) }} />
                            ))}
                          </span>
                        )}
                        <ul className="mt-0.5 hidden space-y-0.5 sm:block">
                          {items.slice(0, 3).map((a) => (
                            <li key={a.id} className="truncate rounded-[6px] px-1 py-px text-[10.5px] font-semibold text-parch-800" style={{ backgroundColor: accentTint(accentFor(a.classId)) }} title={`${chipText(a)} · ${a.className}`}>
                              {a.title}
                            </li>
                          ))}
                          {items.length > 3 && <li className="px-1 text-[10px] text-parch-500">+{items.length - 3} more</li>}
                        </ul>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-4">
        {months.map((month) => (
          <section key={month.key} className="overflow-hidden rounded-[16px] border border-parch-200 border-l-[3px] border-l-brand-gold bg-parch-50 shadow-card">
            <h3 className="border-b border-[#F0EEE8] px-[18px] py-3 text-[12px] font-bold uppercase tracking-[0.5px] text-parch-500">{monthLabel(month.key)}</h3>
            <ul>
              {month.days.map((day) => {
                const items = days.get(day) ?? []
                return (
                  <li key={day} id={`day-${day}`} data-day-row={day} className={cn('flex flex-wrap items-start gap-x-3 gap-y-1.5 border-b-[0.5px] border-[#F0EEE8] px-[18px] py-2.5 last:border-b-0', day < today && 'opacity-60')}>
                    <span className={cn('w-[92px] shrink-0 pt-1 text-[12px] font-bold', day === today ? 'text-brand-800' : 'text-parch-900')}>{formatShortDate(day)}</span>
                    {items.length === 0 ? (
                      <span className="pt-1 text-[12px] text-parch-400">Nothing for you</span>
                    ) : (
                      <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                        {items.map((a) => (
                          <Link
                            key={a.id}
                            href={a.href}
                            className="inline-flex max-w-full items-center gap-1.5 rounded-[10px] border px-2.5 py-1 text-[12px] hover:bg-brand-wash"
                            style={{ borderColor: accentFor(a.classId), backgroundColor: accentTint(accentFor(a.classId)) }}
                          >
                            <span className="truncate font-bold text-parch-900">{chipText(a)}</span>
                            <span className="shrink-0 text-parch-500">· {a.className}</span>
                            {a.doneLabel && <Check className="h-3.5 w-3.5 shrink-0 text-[#16A34A]" aria-label="marked done" />}
                          </Link>
                        ))}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}

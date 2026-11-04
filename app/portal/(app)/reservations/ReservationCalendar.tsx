import Link from '@/components/portal/Link'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { monthGrid, type CalendarSpan } from '@/lib/portal/calendar-spans'
import { andList, formatShortDate } from '@/lib/portal/format'
import { colorOf, dayLabel, formatReservationTime, reservationDays, reservationPurpose } from '@/lib/portal/reservations'
import type { ReservationRow } from '@/lib/portal/data/reservations'
import { cn } from '@/lib/utils'
import { VanChip, VanSwatch } from './parts'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const navLink = 'inline-flex min-h-[40px] items-center rounded-[20px] border border-parch-200 bg-parch-50 px-3 text-parch-700 hover:border-brand-gold/60'

/**
 * Who has which van when (2026-11-02): "a calendar on who using what". A month
 * as a grid, colored by van (dots on a phone, the vans named on a wider
 * screen), then every day that has a reservation, with who has it. Tapping a
 * busy day jumps to it; tapping a free day from today on starts a reservation.
 */
export function ReservationCalendar({
  span,
  days,
  today,
  items,
}: {
  span: CalendarSpan
  days: Map<string, ReservationRow[]>
  today: string
  items: Array<{ id: string; name: string; color: string }>
}) {
  const href = (month: string) => `/portal/reservations?month=${month}`
  const listed = Array.from(days.keys()).sort()
  const count = new Set(Array.from(days.values()).flat().map((r) => r.id)).size

  return (
    <section data-testid="reservations-calendar">
      <nav aria-label="Month" className="mb-3 flex flex-wrap items-center gap-2">
        {items.length > 0 && (
          <ul className="flex flex-wrap items-center gap-x-3 gap-y-1" aria-label="Vans">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-1.5 text-[12px] font-semibold text-parch-700">
                <VanSwatch color={item.color} />
                {item.name}
              </li>
            ))}
          </ul>
        )}
        <span className="ml-auto flex items-center gap-1.5">
          <Link href={href(span.prev)} aria-label="Earlier month" className={navLink}>
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Link>
          <span className="min-w-[120px] text-center text-[13px] font-bold text-parch-900" data-testid="calendar-month">
            {span.label}
          </span>
          <Link href={href(span.next)} aria-label="Later month" className={navLink}>
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        </span>
      </nav>

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
              const booked = day ? (days.get(day) ?? []) : []
              const inner = day && (
                <>
                  <span
                    className={cn(
                      'inline-flex h-6 w-6 items-center justify-center rounded-full text-[11.5px] font-bold',
                      day === today ? 'bg-brand-800 text-white' : day < today ? 'text-parch-400' : 'text-parch-600',
                    )}
                  >
                    {Number(day.slice(8))}
                  </span>
                  {booked.length > 0 && (
                    <span className="mt-0.5 flex flex-wrap gap-0.5 sm:hidden" aria-hidden>
                      {booked.slice(0, 4).map((r) => {
                        const c = colorOf(r.itemColor)
                        return <span key={r.id} className="h-2 w-2 rounded-full border" style={{ backgroundColor: c.bg, borderColor: c.border }} />
                      })}
                    </span>
                  )}
                  <span className="mt-0.5 hidden space-y-0.5 sm:block">
                    {booked.slice(0, 3).map((r) => (
                      <VanChip key={r.id} name={r.itemName} color={r.itemColor} className="flex w-full px-1 py-px text-[10px]">
                        <span className="shrink-0 font-semibold opacity-80">{dayLabel(r, day)}</span>
                      </VanChip>
                    ))}
                    {booked.length > 3 && <span className="block px-1 text-[10px] text-parch-500">+{booked.length - 3} more</span>}
                  </span>
                </>
              )
              const cell = cn(
                'block min-h-[56px] border-r border-[#F0EEE8] p-1 last:border-r-0 sm:min-h-[92px] sm:p-1.5',
                !day && 'bg-parch-100/50',
                day && day < today && 'bg-parch-100/40',
              )
              if (!day) return <div key={di} className={cell} />
              if (booked.length > 0) {
                return (
                  <a
                    key={di}
                    href={`#day-${day}`}
                    data-day={day}
                    className={cn(cell, 'hover:bg-brand-wash')}
                    aria-label={`${formatShortDate(day)}: ${booked.length} reservation${booked.length === 1 ? '' : 's'}`}
                  >
                    {inner}
                  </a>
                )
              }
              if (day >= today) {
                return (
                  <Link key={di} href={`/portal/reservations/new?date=${day}`} data-day={day} className={cn(cell, 'hover:bg-brand-wash')} aria-label={`Reserve a van on ${formatShortDate(day)}`}>
                    {inner}
                  </Link>
                )
              }
              return (
                <div key={di} data-day={day} className={cell}>
                  {inner}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      <p className="mb-3 text-[12px] text-parch-500">
        {count === 0 ? `Nothing reserved in ${span.label} yet. Tap a day to reserve a van.` : `${count} reservation${count === 1 ? '' : 's'} in ${span.label}.`}
      </p>

      {listed.length > 0 && (
        <ul className="space-y-3" data-testid="day-list">
          {listed.map((day) => (
            <li key={day} id={`day-${day}`} className={cn('scroll-mt-24 overflow-hidden rounded-[16px] border border-parch-200 border-l-[3px] border-l-brand-gold bg-parch-50 shadow-card', day < today && 'opacity-70')}>
              <div className="flex items-center justify-between gap-2 border-b border-[#F0EEE8] px-[18px] py-2.5">
                <h3 className={cn('text-[12.5px] font-bold', day === today ? 'text-brand-800' : 'text-parch-900')}>
                  {formatShortDate(day)}
                  {day === today && <span className="ml-1.5 text-[11px] font-semibold text-brand-gold-dark">today</span>}
                </h3>
                {day >= today && (
                  <Link href={`/portal/reservations/new?date=${day}`} className="inline-flex items-center gap-1 text-[12px] font-bold text-brand-800 hover:underline">
                    <Plus className="h-3.5 w-3.5" aria-hidden />
                    Reserve
                  </Link>
                )}
              </div>
              <ul>
                {days.get(day)!.map((r) => (
                  <li key={r.id} className="border-b-[0.5px] border-[#F0EEE8] last:border-b-0">
                    <Link href={`/portal/reservations/${r.id}`} data-reservation={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-[18px] py-2.5 hover:bg-brand-wash">
                      <VanChip name={r.itemName} color={r.itemColor} />
                      <span className="text-[12.5px] font-bold text-parch-900">{dayLabel(r, day)}</span>
                      <span className="text-[12.5px] text-parch-700">{reservationPurpose(r)}</span>
                      <span className="w-full text-[12px] text-parch-500 sm:w-auto sm:flex-1">
                        {r.servants.length > 0 ? andList(r.servants.map((s) => s.name)) : (r.createdByName ?? '')}
                      </span>
                      {reservationDays(r).length > 1 && <span className="w-full text-[11.5px] text-parch-500">{formatReservationTime(r)}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

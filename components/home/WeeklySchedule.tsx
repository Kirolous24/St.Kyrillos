'use client'

import { useState, useEffect, useMemo } from 'react'
import { Clock, Calendar, ChevronRight, MapPin } from 'lucide-react'
import { useScrollAnimation } from '@/hooks/useScrollAnimation'
import { cn } from '@/lib/utils'

const DAYS = [
  { short: 'Sun', full: 'Sunday' },
  { short: 'Mon', full: 'Monday' },
  { short: 'Tue', full: 'Tuesday' },
  { short: 'Wed', full: 'Wednesday' },
  { short: 'Thu', full: 'Thursday' },
  { short: 'Fri', full: 'Friday' },
  { short: 'Sat', full: 'Saturday' },
]

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

interface ScheduleEvent {
  id: string
  dayOfWeek: number
  time: string
  sortOrder: number
  durationMinutes: number
  title: string
  description: string | null
  location: string | null
}

function timeToMinutes(timeStr: string): number {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) return 0
  let hours = parseInt(match[1])
  const minutes = parseInt(match[2])
  const period = match[3].toUpperCase()
  if (period === 'PM' && hours !== 12) hours += 12
  if (period === 'AM' && hours === 12) hours = 0
  return hours * 60 + minutes
}

function minutesToTime(totalMinutes: number): string {
  const mins = ((totalMinutes % 1440) + 1440) % 1440
  let h = Math.floor(mins / 60)
  const m = mins % 60
  const period = h >= 12 ? 'PM' : 'AM'
  if (h === 0) h = 12
  else if (h > 12) h -= 12
  return `${h}:${m.toString().padStart(2, '0')} ${period}`
}

function getWeekDates(): Date[] {
  const now = new Date()
  const currentDay = now.getDay()
  const sunday = new Date(now)
  sunday.setDate(now.getDate() - currentDay)
  sunday.setHours(0, 0, 0, 0)

  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(sunday)
    date.setDate(sunday.getDate() + i)
    return date
  })
}

export function WeeklySchedule({ events }: { events: ScheduleEvent[] }) {
  const today = new Date().getDay()
  const [selectedDay, setSelectedDay] = useState(today)
  const [animating, setAnimating] = useState(false)
  const [displayedEvents, setDisplayedEvents] = useState<ScheduleEvent[]>([])
  const { ref, isVisible } = useScrollAnimation()

  const weekDates = useMemo(() => getWeekDates(), [])
  const daysWithEvents = new Set(events.map((e) => e.dayOfWeek))

  function getEventsForDay(day: number) {
    return events.filter((e) => e.dayOfWeek === day).sort((a, b) => a.sortOrder - b.sortOrder)
  }

  useEffect(() => {
    setDisplayedEvents(getEventsForDay(selectedDay))
  }, [selectedDay, events])

  function handleDayChange(i: number) {
    if (i === selectedDay) return
    setAnimating(true)
    setTimeout(() => {
      setSelectedDay(i)
      setAnimating(false)
    }, 180)
  }

  return (
    <section
      ref={ref}
      className={`py-24 relative overflow-hidden ${isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}
      style={{ background: 'linear-gradient(180deg, #f9fafb 0%, #ffffff 60%)' }}
    >
      {/* Decorative cross pattern */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23722f37' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/G%3E%3C/svg%3E")`,
        }}
      />
      {/* Decorative blurred circles */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary-50 rounded-full translate-x-1/2 -translate-y-1/2 blur-3xl opacity-60" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-gold/10 rounded-full -translate-x-1/2 translate-y-1/2 blur-3xl opacity-60" />

      <div className="container-custom relative">
        {/* Section header */}
        <div className="text-center mb-14">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="h-px w-16 bg-gradient-to-r from-transparent to-gold" />
            <Clock className="w-5 h-5 text-gold" />
            <div className="h-px w-16 bg-gradient-to-l from-transparent to-gold" />
          </div>
          <h2 className="font-serif text-4xl md:text-5xl text-gray-900 mb-4">
            This Week at <span className="text-primary-900">St. Kyrillos</span>
          </h2>
          <p className="text-gray-500 text-lg max-w-xl mx-auto">
            Join us for worship, prayer, and fellowship
          </p>
        </div>

        <div className="max-w-5xl mx-auto">
          {/* Day Selector Cards */}
          <div className="grid grid-cols-7 gap-2 md:gap-3 mb-10">
            {DAYS.map((day, i) => {
              const hasEvents = daysWithEvents.has(i)
              const isSelected = selectedDay === i
              const isToday = today === i
              const eventCount = getEventsForDay(i).length
              const date = weekDates[i]

              return (
                <button
                  key={day.full}
                  onClick={() => handleDayChange(i)}
                  className={cn(
                    'group relative flex flex-col items-center pt-4 pb-3 px-1 rounded-2xl',
                    'transition-all duration-300 cursor-pointer select-none',
                    isSelected
                      ? 'bg-primary-900 shadow-soft-xl -translate-y-1 scale-105'
                      : isToday
                        ? 'bg-white border-2 border-gold shadow-soft hover:-translate-y-1 hover:shadow-soft-xl hover:scale-[1.03]'
                        : 'bg-white border border-gray-100 shadow-soft hover:-translate-y-1 hover:shadow-soft-xl hover:border-gold/40 hover:scale-[1.03]'
                  )}
                >
                  {/* Event count badge */}
                  {hasEvents && (
                    <span className={cn(
                      'absolute -top-2 -right-2 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center shadow-sm',
                      isSelected
                        ? 'bg-gold text-primary-950'
                        : 'bg-gold text-primary-950 group-hover:scale-110 transition-transform duration-200'
                    )}>
                      {eventCount}
                    </span>
                  )}

                  {/* Today label */}
                  {isToday && !isSelected && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-gold text-primary-950 text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full shadow-sm whitespace-nowrap">
                      Today
                    </span>
                  )}

                  {/* Day abbreviation */}
                  <span className={cn(
                    'text-[10px] font-semibold uppercase tracking-widest mb-0.5 transition-colors duration-300',
                    isSelected ? 'text-white/60' : isToday ? 'text-gold' : 'text-gray-400 group-hover:text-gold'
                  )}>
                    {day.short}
                  </span>

                  {/* Date number */}
                  <span className={cn(
                    'font-serif font-bold text-xl leading-tight transition-colors duration-300',
                    isSelected ? 'text-white' : isToday ? 'text-primary-900' : 'text-gray-800 group-hover:text-primary-900'
                  )}>
                    {date.getDate()}
                  </span>

                  {/* Month abbreviation */}
                  <span className={cn(
                    'text-[9px] font-medium uppercase tracking-wider mt-0.5 transition-colors duration-300',
                    isSelected ? 'text-white/50' : 'text-gray-400'
                  )}>
                    {MONTH_NAMES[date.getMonth()]}
                  </span>

                  {/* Active indicator bar */}
                  {isSelected && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-gold rounded-full" />
                  )}

                  {/* Today ring glow (when selected) */}
                  {isToday && isSelected && (
                    <span className="absolute -inset-0.5 rounded-2xl border-2 border-gold/50 pointer-events-none" />
                  )}

                  {/* Hover shimmer effect */}
                  {!isSelected && (
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/0 to-primary-50/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  )}
                </button>
              )
            })}
          </div>

          {/* Events Panel */}
          <div
            className={cn(
              'transition-all duration-200',
              animating ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
            )}
          >
            {displayedEvents.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-14 text-center">
                <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-4">
                  <Calendar className="w-8 h-8 text-gray-300" />
                </div>
                <p className="text-gray-400 text-lg font-medium">No events scheduled</p>
                <p className="text-gray-300 text-sm mt-1">for {DAYS[selectedDay].full}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {displayedEvents.map((event, index) => {
                  const startMinutes = timeToMinutes(event.time)
                  const duration = event.durationMinutes || 60
                  const endTime = minutesToTime(startMinutes + duration)

                  return (
                    <div
                      key={event.id}
                      className={cn(
                        'group bg-white rounded-2xl border border-gray-100 shadow-soft p-5',
                        'hover:shadow-soft-xl hover:-translate-y-0.5 hover:border-gold/30',
                        'transition-all duration-300 cursor-default',
                        'flex items-center gap-5'
                      )}
                      style={{ animationDelay: `${index * 60}ms` }}
                    >
                      {/* Left accent line */}
                      <div className="w-1 self-stretch rounded-full bg-gradient-to-b from-gold to-primary-900 opacity-60 group-hover:opacity-100 transition-opacity duration-300 shrink-0" />

                      {/* Time bubble */}
                      <div className="shrink-0 text-center min-w-[5rem]">
                        <div className={cn(
                          'inline-flex flex-col items-center px-3 py-2 rounded-xl transition-all duration-300',
                          'bg-primary-50 group-hover:bg-primary-900'
                        )}>
                          <span className="text-xs font-bold tabular-nums leading-none group-hover:text-white text-primary-900 transition-colors duration-300">
                            {event.time.replace(' AM', '').replace(' PM', '')}
                          </span>
                          <span className="text-[9px] font-semibold uppercase tracking-wider mt-0.5 group-hover:text-gold text-primary-700 transition-colors duration-300">
                            {event.time.includes('AM') ? 'AM' : 'PM'}
                          </span>
                          <svg className="w-2.5 h-2.5 my-0.5 text-primary-300 group-hover:text-white/40 transition-colors duration-300" viewBox="0 0 10 12" fill="currentColor">
                            <path d="M5 12L0.669873 4.5L9.33013 4.5L5 12Z" />
                            <rect x="4" y="0" width="2" height="5" />
                          </svg>
                          <span className="text-[10px] font-medium tabular-nums leading-none group-hover:text-white/70 text-primary-600 transition-colors duration-300">
                            {endTime.replace(' AM', '').replace(' PM', '')}
                          </span>
                          <span className="text-[8px] font-semibold uppercase tracking-wider mt-0.5 group-hover:text-gold/70 text-primary-400 transition-colors duration-300">
                            {endTime.includes('AM') ? 'AM' : 'PM'}
                          </span>
                        </div>
                      </div>

                      {/* Event details */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-serif font-semibold text-gray-900 text-lg leading-tight group-hover:text-primary-900 transition-colors duration-300">
                          {event.title}
                        </h3>
                        {event.location && (
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <MapPin className="w-3.5 h-3.5 text-gold shrink-0" />
                            <span className="text-sm text-gray-500">{event.location}</span>
                          </div>
                        )}
                        {event.description && (
                          <p className="text-sm text-gray-400 mt-1 leading-relaxed">
                            {event.description}
                          </p>
                        )}
                      </div>

                      {/* Arrow indicator */}
                      <ChevronRight className="w-5 h-5 text-gray-200 group-hover:text-gold group-hover:translate-x-0.5 transition-all duration-300 shrink-0" />
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer note */}
          <p className="text-center text-gray-400 text-sm mt-8 flex items-center justify-center gap-2">
            <Calendar className="w-4 h-4" />
            Schedule may change during fasting seasons and feast days
          </p>
        </div>
      </div>
    </section>
  )
}

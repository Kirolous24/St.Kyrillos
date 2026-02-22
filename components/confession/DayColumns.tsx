'use client'

import { useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TimeSlotPill } from './TimeSlotPill'
import type { DayAvailability, TimeSlot } from '@/lib/confession/types'

interface DayColumnsProps {
  days: DayAvailability[]
  selectedSlot: TimeSlot | null
  onSlotSelect: (slot: TimeSlot) => void
  visibleStartIndex: number
  onNavigate: (direction: 'prev' | 'next') => void
  visibleCount?: number
}

export function DayColumns({
  days,
  selectedSlot,
  onSlotSelect,
  visibleStartIndex,
  onNavigate,
  visibleCount = 4
}: DayColumnsProps) {
  const visibleDays = useMemo(() => {
    return days.slice(visibleStartIndex, visibleStartIndex + visibleCount)
  }, [days, visibleStartIndex, visibleCount])

  const canGoPrevious = visibleStartIndex > 0
  const canGoNext = visibleStartIndex + visibleCount < days.length

  if (days.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <p>No available appointments in this period.</p>
      </div>
    )
  }

  return (
    <div className="w-full">
      {/* Navigation header */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={() => onNavigate('prev')}
          disabled={!canGoPrevious}
          className={cn(
            'p-1.5 rounded-full transition-colors',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-900',
            canGoPrevious
              ? 'text-gray-600 hover:bg-gray-100'
              : 'text-gray-300 cursor-not-allowed'
          )}
          aria-label="Previous days"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <span className="text-sm text-gray-500">
          {visibleDays.length > 0 && (
            <>
              {visibleDays[0].month} {visibleDays[0].dayNumber}
              {visibleDays.length > 1 && (
                <> - {visibleDays[visibleDays.length - 1].month} {visibleDays[visibleDays.length - 1].dayNumber}</>
              )}
            </>
          )}
        </span>

        <button
          type="button"
          onClick={() => onNavigate('next')}
          disabled={!canGoNext}
          className={cn(
            'p-1.5 rounded-full transition-colors',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-900',
            canGoNext
              ? 'text-gray-600 hover:bg-gray-100'
              : 'text-gray-300 cursor-not-allowed'
          )}
          aria-label="Next days"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Day columns */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {visibleDays.map((day) => {
          const availableSlots = day.slots.filter(s => !s.isBooked)

          return (
            <div key={day.date} className="min-w-0">
              {/* Day header */}
              <div className="text-center mb-3 pb-3 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-900">{day.dayAbbrev}</p>
                <p className="text-2xl font-semibold text-gray-900">{day.dayNumber}</p>
              </div>

              {/* Time slots */}
              <div className="space-y-2">
                {availableSlots.length > 0 ? (
                  availableSlots.map((slot) => (
                    <TimeSlotPill
                      key={slot.id}
                      time={slot.time}
                      displayTime={slot.displayTime}
                      isAvailable={!slot.isBooked}
                      isSelected={selectedSlot?.id === slot.id}
                      onClick={() => onSlotSelect(slot)}
                    />
                  ))
                ) : (
                  <div className="text-center py-4 text-gray-400">
                    <span className="text-2xl">—</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

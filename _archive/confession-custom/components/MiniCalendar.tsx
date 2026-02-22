'use client'

import { useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  getCalendarDays,
  formatDateString,
  isSameDay,
  isSameMonth,
  isPastDate,
  isValidAppointmentDay
} from '@/lib/confession/utils'

interface MiniCalendarProps {
  currentMonth: Date
  onMonthChange: (date: Date) => void
  selectedDate: Date | null
  onDateSelect: (date: Date) => void
  availableDates: string[]
}

const DAYS_OF_WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export function MiniCalendar({
  currentMonth,
  onMonthChange,
  selectedDate,
  onDateSelect,
  availableDates
}: MiniCalendarProps) {
  const availableDatesSet = useMemo(() => new Set(availableDates), [availableDates])

  const calendarDays = useMemo(() => {
    return getCalendarDays(currentMonth.getFullYear(), currentMonth.getMonth())
  }, [currentMonth])

  const monthYear = currentMonth.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  })

  const handlePreviousMonth = () => {
    const newDate = new Date(currentMonth)
    newDate.setMonth(newDate.getMonth() - 1)
    onMonthChange(newDate)
  }

  const handleNextMonth = () => {
    const newDate = new Date(currentMonth)
    newDate.setMonth(newDate.getMonth() + 1)
    onMonthChange(newDate)
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Don't allow navigating to previous months if we're in the current month
  const canGoPrevious = currentMonth.getFullYear() > today.getFullYear() ||
    (currentMonth.getFullYear() === today.getFullYear() && currentMonth.getMonth() > today.getMonth())

  return (
    <div className="w-full">
      {/* Month/Year header with navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={handlePreviousMonth}
          disabled={!canGoPrevious}
          className={cn(
            'p-1.5 rounded-full transition-colors',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-900',
            canGoPrevious
              ? 'text-gray-600 hover:bg-gray-100'
              : 'text-gray-300 cursor-not-allowed'
          )}
          aria-label="Previous month"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <h3 className="font-medium text-gray-900">{monthYear}</h3>

        <button
          type="button"
          onClick={handleNextMonth}
          className={cn(
            'p-1.5 rounded-full text-gray-600 hover:bg-gray-100 transition-colors',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-900'
          )}
          aria-label="Next month"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Day of week headers */}
      <div
        className="grid grid-cols-7 gap-1 mb-2"
        role="row"
      >
        {DAYS_OF_WEEK.map((day, index) => (
          <div
            key={index}
            role="columnheader"
            className="text-center text-xs font-medium text-gray-500 py-1"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div
        className="grid grid-cols-7 gap-1"
        role="grid"
        aria-label="Select appointment date"
      >
        {calendarDays.map((day, index) => {
          const dateString = formatDateString(day)
          const isCurrentMonth = isSameMonth(day, currentMonth)
          const isToday = isSameDay(day, today)
          const isSelected = selectedDate && isSameDay(day, selectedDate)
          const hasAvailability = availableDatesSet.has(dateString)
          const isPast = isPastDate(dateString)
          const isAppointmentDay = isValidAppointmentDay(dateString)
          const isDisabled = isPast || !isCurrentMonth || !isAppointmentDay

          return (
            <button
              key={index}
              type="button"
              role="gridcell"
              onClick={() => !isDisabled && hasAvailability && onDateSelect(day)}
              disabled={isDisabled || !hasAvailability}
              aria-selected={isSelected || undefined}
              aria-disabled={isDisabled || !hasAvailability}
              aria-label={day.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              className={cn(
                'relative aspect-square flex items-center justify-center text-sm rounded-full transition-all',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-900 focus-visible:ring-offset-1',
                // Not current month
                !isCurrentMonth && 'text-gray-300',
                // Current month but disabled (past or not appointment day)
                isCurrentMonth && isDisabled && 'text-gray-300 cursor-not-allowed',
                // Current month, valid day, but no availability
                isCurrentMonth && !isDisabled && !hasAvailability && 'text-gray-400 cursor-not-allowed',
                // Has availability
                isCurrentMonth && !isDisabled && hasAvailability && !isSelected && 'text-gray-900 hover:bg-primary-50',
                // Today indicator
                isToday && !isSelected && 'font-bold',
                // Selected
                isSelected && 'bg-primary-900 text-white font-medium'
              )}
            >
              {day.getDate()}
              {/* Availability dot */}
              {hasAvailability && !isSelected && isCurrentMonth && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-gold" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

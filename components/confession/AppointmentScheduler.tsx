'use client'

import { useMemo } from 'react'
import { MiniCalendar } from './MiniCalendar'
import { SelectedDaySlots } from './SelectedDaySlots'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatDateString } from '@/lib/confession/utils'
import type { AvailabilityResponse, DayAvailability, TimeSlot } from '@/lib/confession/types'

interface AppointmentSchedulerProps {
  availability: AvailabilityResponse | null
  currentMonth: Date
  onMonthChange: (date: Date) => void
  selectedDate: Date | null
  onDateSelect: (date: Date) => void
  selectedSlot: TimeSlot | null
  onSlotSelect: (slot: TimeSlot) => void
  isLoading: boolean
}

export function AppointmentScheduler({
  availability,
  currentMonth,
  onMonthChange,
  selectedDate,
  onDateSelect,
  selectedSlot,
  onSlotSelect,
  isLoading
}: AppointmentSchedulerProps) {
  // Get the selected day's availability
  const selectedDayAvailability = useMemo<DayAvailability | null>(() => {
    if (!availability || !selectedDate) return null
    const dateString = formatDateString(selectedDate)
    const allDays = availability.weeks.flatMap(week => week.days)
    return allDays.find(day => day.date === dateString) || null
  }, [availability, selectedDate])

  return (
    <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-6 md:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
        <h2 className="font-serif text-heading-4 text-gray-900">
          Select an appointment time
        </h2>
        <span className="text-sm text-gray-500">
          (GMT-06:00) Central Time - Chicago
        </span>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Calendar skeleton */}
          <div className="w-full lg:w-72 flex-shrink-0">
            <Skeleton className="h-8 w-32 mx-auto mb-4" />
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 35 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-full" />
              ))}
            </div>
          </div>

          {/* Time slots skeleton */}
          <div className="flex-1">
            <Skeleton className="h-6 w-32 mx-auto mb-4" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-full" />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Mini Calendar */}
          <div className="w-full lg:w-72 flex-shrink-0">
            <MiniCalendar
              currentMonth={currentMonth}
              onMonthChange={onMonthChange}
              selectedDate={selectedDate}
              onDateSelect={onDateSelect}
              availableDates={availability?.availableDates || []}
            />
          </div>

          {/* Selected Day Time Slots */}
          <div className="flex-1 min-w-0">
            <SelectedDaySlots
              day={selectedDayAvailability}
              selectedSlot={selectedSlot}
              onSlotSelect={onSlotSelect}
            />
          </div>
        </div>
      )}
    </div>
  )
}

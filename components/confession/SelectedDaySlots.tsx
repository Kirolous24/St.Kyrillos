'use client'

import { TimeSlotPill } from './TimeSlotPill'
import type { DayAvailability, TimeSlot } from '@/lib/confession/types'

interface SelectedDaySlotsProps {
  day: DayAvailability | null
  selectedSlot: TimeSlot | null
  onSlotSelect: (slot: TimeSlot) => void
}

export function SelectedDaySlots({
  day,
  selectedSlot,
  onSlotSelect
}: SelectedDaySlotsProps) {
  if (!day) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500">
        <p>Select a date to see available times</p>
      </div>
    )
  }

  const availableSlots = day.slots.filter(s => !s.isBooked)

  if (availableSlots.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 mb-2">No available times on this day</p>
        <p className="text-sm text-gray-400">Please select another date</p>
      </div>
    )
  }

  return (
    <div>
      {/* Day header */}
      <div className="text-center mb-6 pb-4 border-b border-gray-100">
        <p className="text-lg font-medium text-gray-900">{day.dayOfWeek}</p>
        <p className="text-2xl font-semibold text-primary-900">
          {day.month} {day.dayNumber}
        </p>
      </div>

      {/* Time slots grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {availableSlots.map((slot) => (
          <TimeSlotPill
            key={slot.id}
            time={slot.time}
            displayTime={slot.displayTime}
            isAvailable={!slot.isBooked}
            isSelected={selectedSlot?.id === slot.id}
            onClick={() => onSlotSelect(slot)}
          />
        ))}
      </div>
    </div>
  )
}

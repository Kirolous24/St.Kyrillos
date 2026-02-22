'use client'

import { cn } from '@/lib/utils'

interface TimeSlotPillProps {
  time: string
  displayTime: string
  isAvailable: boolean
  isSelected: boolean
  onClick: () => void
}

export function TimeSlotPill({
  time,
  displayTime,
  isAvailable,
  isSelected,
  onClick
}: TimeSlotPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isAvailable}
      aria-label={`${isAvailable ? 'Available' : 'Unavailable'} appointment at ${displayTime}`}
      aria-pressed={isSelected}
      className={cn(
        'px-4 py-2 rounded-full text-sm font-medium transition-all',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-900 focus-visible:ring-offset-2',
        // Available state
        isAvailable && !isSelected && 'bg-primary-50 text-primary-900 hover:bg-primary-100',
        // Selected state
        isSelected && 'bg-primary-900 text-white shadow-md',
        // Unavailable state
        !isAvailable && 'bg-gray-100 text-gray-400 cursor-not-allowed'
      )}
    >
      {displayTime}
    </button>
  )
}

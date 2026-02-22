import { NextRequest, NextResponse } from 'next/server'
import { CONFESSION_CONFIG } from '@/lib/constants'
import { confessionStore } from '@/lib/confession/store'
import type { AvailabilityResponse, DayAvailability, TimeSlot, WeekAvailability } from '@/lib/confession/types'
import {
  formatTimeSlot,
  generateSlotId,
  getDayAbbrev,
  getDayOfWeek,
  getDayNumber,
  getMonthAbbrev,
  getTimezoneDisplay,
  getTimezoneAbbrev,
  formatDateString,
  addDays,
  startOfWeek,
  isValidAppointmentDay,
  isPastDate
} from '@/lib/confession/utils'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * GET /api/confession/availability
 *
 * Query parameters:
 * - start: Start date in YYYY-MM-DD format (defaults to today)
 * - weeks: Number of weeks to return (defaults to 8)
 *
 * Returns available appointment slots organized by week
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const startParam = searchParams.get('start')
    const weeksParam = searchParams.get('weeks')

    // Parse start date (default to today)
    let startDate: Date
    if (startParam) {
      startDate = new Date(startParam + 'T00:00:00')
      if (isNaN(startDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid start date format. Use YYYY-MM-DD', code: 'INVALID_DATE' },
          { status: 400 }
        )
      }
    } else {
      startDate = new Date()
    }

    // Parse weeks (default to 8)
    const weeks = Math.min(Math.max(parseInt(weeksParam || '8', 10) || 8, 1), 12)

    // Calculate date range
    const rangeStart = formatDateString(startDate)
    const rangeEnd = formatDateString(addDays(startDate, weeks * 7))

    // Get already booked slots
    const bookedSlotIds = confessionStore.getBookedSlotIds(rangeStart, rangeEnd)

    // Generate availability data
    const weekData: WeekAvailability[] = []
    const availableDates: Set<string> = new Set()

    // Start from the beginning of the week containing startDate
    let currentWeekStart = startOfWeek(startDate)

    for (let weekIndex = 0; weekIndex < weeks; weekIndex++) {
      const days: DayAvailability[] = []

      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const currentDate = addDays(currentWeekStart, dayOffset)
        const dateString = formatDateString(currentDate)

        // Skip past dates
        if (isPastDate(dateString)) {
          continue
        }

        // Skip days that are not appointment days
        if (!isValidAppointmentDay(dateString)) {
          continue
        }

        // Generate time slots for this day
        const slots: TimeSlot[] = []

        for (const time of CONFESSION_CONFIG.timeSlots) {
          const slotId = generateSlotId(dateString, time)
          const isBooked = bookedSlotIds.has(slotId)

          slots.push({
            id: slotId,
            time,
            displayTime: formatTimeSlot(time),
            date: dateString,
            isBooked
          })

          if (!isBooked) {
            availableDates.add(dateString)
          }
        }

        // Only add days that have slots
        if (slots.length > 0) {
          days.push({
            date: dateString,
            dayOfWeek: getDayOfWeek(dateString),
            dayAbbrev: getDayAbbrev(dateString),
            dayNumber: getDayNumber(dateString),
            month: getMonthAbbrev(dateString),
            slots
          })
        }
      }

      // Only add weeks that have days with availability
      if (days.length > 0) {
        weekData.push({
          weekStart: formatDateString(currentWeekStart),
          days
        })
      }

      // Move to next week
      currentWeekStart = addDays(currentWeekStart, 7)
    }

    // TODO: Google Calendar Integration
    // - Replace this mock data generation with Google Calendar free/busy API
    // - Query the priest's calendar for busy times
    // - Subtract busy times from available slots
    // - See: https://developers.google.com/calendar/api/v3/reference/freebusy

    const response: AvailabilityResponse = {
      timezone: CONFESSION_CONFIG.timezone,
      timezoneAbbrev: getTimezoneAbbrev(),
      weeks: weekData,
      availableDates: Array.from(availableDates).sort()
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching confession availability:', error)
    return NextResponse.json(
      { error: 'Failed to fetch availability', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

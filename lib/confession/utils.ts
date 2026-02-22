// Date/time utilities for confession booking

import { CONFESSION_CONFIG } from '@/lib/constants'

/**
 * Format 24-hour time to 12-hour display format
 * "10:00" → "10:00 AM"
 * "14:30" → "2:30 PM"
 */
export function formatTimeSlot(time: string): string {
  const [hours, minutes] = time.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours % 12 || 12
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
}

/**
 * Format date string to full display format
 * "2024-02-15" → "Tuesday, February 15, 2024"
 */
export function formatFullDate(dateString: string): string {
  const date = new Date(dateString + 'T12:00:00')
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: CONFESSION_CONFIG.timezone
  })
}

/**
 * Format date for short display
 * "2024-02-15" → "Feb 15"
 */
export function formatShortDate(dateString: string): string {
  const date = new Date(dateString + 'T12:00:00')
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: CONFESSION_CONFIG.timezone
  })
}

/**
 * Get day abbreviation from date
 * "2024-02-15" → "Thu"
 */
export function getDayAbbrev(dateString: string): string {
  const date = new Date(dateString + 'T12:00:00')
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    timeZone: CONFESSION_CONFIG.timezone
  })
}

/**
 * Get full day name from date
 * "2024-02-15" → "Thursday"
 */
export function getDayOfWeek(dateString: string): string {
  const date = new Date(dateString + 'T12:00:00')
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    timeZone: CONFESSION_CONFIG.timezone
  })
}

/**
 * Get day number from date string
 * "2024-02-15" → 15
 */
export function getDayNumber(dateString: string): number {
  const date = new Date(dateString + 'T12:00:00')
  return date.getDate()
}

/**
 * Get month abbreviation from date
 * "2024-02-15" → "Feb"
 */
export function getMonthAbbrev(dateString: string): string {
  const date = new Date(dateString + 'T12:00:00')
  return date.toLocaleDateString('en-US', {
    month: 'short',
    timeZone: CONFESSION_CONFIG.timezone
  })
}

/**
 * Generate unique slot ID from date and time
 * ("2024-02-15", "10:00") → "2024-02-15-10-00"
 */
export function generateSlotId(date: string, time: string): string {
  return `${date}-${time.replace(':', '-')}`
}

/**
 * Parse slot ID back to date and time
 * "2024-02-15-10-00" → { date: "2024-02-15", time: "10:00" }
 */
export function parseSlotId(slotId: string): { date: string; time: string } {
  const parts = slotId.split('-')
  const date = parts.slice(0, 3).join('-')
  const time = parts.slice(3).join(':')
  return { date, time }
}

/**
 * Format date to YYYY-MM-DD string
 */
export function formatDateString(date: Date): string {
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Get the day of week number for a date (0=Sunday, 6=Saturday)
 */
export function getDayOfWeekNumber(dateString: string): number {
  const date = new Date(dateString + 'T12:00:00')
  return date.getDay()
}

/**
 * Check if a date is a valid appointment day
 */
export function isValidAppointmentDay(dateString: string): boolean {
  const dayOfWeek = getDayOfWeekNumber(dateString)
  return (CONFESSION_CONFIG.availableDays as readonly number[]).includes(dayOfWeek)
}

/**
 * Check if a date is in the past
 */
export function isPastDate(dateString: string): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const date = new Date(dateString + 'T00:00:00')
  return date < today
}

/**
 * Get timezone display string
 * Returns something like "(GMT-06:00) Central Time - Chicago"
 */
export function getTimezoneDisplay(): string {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: CONFESSION_CONFIG.timezone,
    timeZoneName: 'longOffset'
  })
  const parts = formatter.formatToParts(now)
  const offset = parts.find(p => p.type === 'timeZoneName')?.value || 'GMT-06:00'

  return `(${offset}) Central Time - Chicago`
}

/**
 * Get timezone abbreviation (CST or CDT)
 */
export function getTimezoneAbbrev(): string {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: CONFESSION_CONFIG.timezone,
    timeZoneName: 'short'
  })
  const parts = formatter.formatToParts(now)
  return parts.find(p => p.type === 'timeZoneName')?.value || 'CT'
}

/**
 * Calculate end time given start time and duration
 * ("10:00", 20) → "10:20 AM"
 */
export function calculateEndTime(startTime: string, durationMinutes: number): string {
  const [hours, minutes] = startTime.split(':').map(Number)
  const totalMinutes = hours * 60 + minutes + durationMinutes
  const endHours = Math.floor(totalMinutes / 60) % 24
  const endMinutes = totalMinutes % 60
  const endTime = `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`
  return formatTimeSlot(endTime)
}

/**
 * Get time range display
 * ("10:00", 20) → "10:00 AM - 10:20 AM"
 */
export function getTimeRangeDisplay(startTime: string, durationMinutes: number): string {
  const startDisplay = formatTimeSlot(startTime)
  const endDisplay = calculateEndTime(startTime, durationMinutes)
  return `${startDisplay} - ${endDisplay}`
}

/**
 * Generate a random confirmation number
 */
export function generateConfirmationNumber(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let result = ''
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Validate phone format (basic - accepts various formats)
 */
export function isValidPhone(phone: string): boolean {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '')
  // US phone numbers should have 10 or 11 digits (with country code)
  return digits.length >= 10 && digits.length <= 11
}

/**
 * Format phone number for display
 */
export function formatPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  if (digits.length === 11 && digits[0] === '1') {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  return phone
}

/**
 * Add days to a date
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

/**
 * Get start of week (Sunday)
 */
export function startOfWeek(date: Date): Date {
  const result = new Date(date)
  const day = result.getDay()
  result.setDate(result.getDate() - day)
  result.setHours(0, 0, 0, 0)
  return result
}

/**
 * Get end of week (Saturday)
 */
export function endOfWeek(date: Date): Date {
  const result = new Date(date)
  const day = result.getDay()
  result.setDate(result.getDate() + (6 - day))
  result.setHours(23, 59, 59, 999)
  return result
}

/**
 * Get start of month
 */
export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

/**
 * Get end of month
 */
export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

/**
 * Check if two dates are the same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}

/**
 * Check if two dates are in the same month
 */
export function isSameMonth(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth()
  )
}

/**
 * Get all days in a month for calendar display (including padding days)
 */
export function getCalendarDays(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  const startPadding = firstDay.getDay() // Days from previous month
  const endPadding = 6 - lastDay.getDay() // Days from next month

  const days: Date[] = []

  // Add padding days from previous month
  for (let i = startPadding - 1; i >= 0; i--) {
    days.push(new Date(year, month, -i))
  }

  // Add days of current month
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push(new Date(year, month, i))
  }

  // Add padding days from next month
  for (let i = 1; i <= endPadding; i++) {
    days.push(new Date(year, month + 1, i))
  }

  return days
}

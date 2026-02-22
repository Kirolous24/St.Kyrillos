// TypeScript interfaces for confession booking feature

export interface TimeSlot {
  id: string
  time: string           // "10:00" (24-hour format)
  displayTime: string    // "10:00 AM"
  date: string           // "2024-02-15"
  isBooked: boolean
}

export interface DayAvailability {
  date: string           // "2024-02-15"
  dayOfWeek: string      // "Tuesday"
  dayAbbrev: string      // "Tue"
  dayNumber: number      // 15
  month: string          // "Feb"
  slots: TimeSlot[]
}

export interface WeekAvailability {
  weekStart: string
  days: DayAvailability[]
}

export interface AvailabilityResponse {
  timezone: string
  timezoneAbbrev: string
  weeks: WeekAvailability[]
  availableDates: string[]  // Dates with at least one available slot
}

export interface BookingRequest {
  slotId: string
  date: string
  time: string
  firstName: string
  lastName: string
  email: string
  phone: string
}

export interface BookingConfirmation {
  confirmationNumber: string
  date: string
  time: string
  displayDate: string       // "Tuesday, February 15, 2024"
  displayTime: string       // "10:00 AM - 10:20 AM"
  clergName: string
  location: string
  firstName: string
  lastName: string
  email: string
  phone: string
}

export interface ApiError {
  error: string
  code: string
}

export interface Booking {
  id: string
  slotId: string
  date: string
  time: string
  firstName: string
  lastName: string
  email: string
  phone: string
  createdAt: string
  confirmationNumber: string
}

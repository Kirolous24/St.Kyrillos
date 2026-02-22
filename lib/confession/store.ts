// In-memory booking store for confession appointments
// NOTE: This is a simple in-memory store that will reset on server restart
// TODO: Replace with database (Prisma, MongoDB, etc.) for production

import type { Booking } from './types'
import { generateConfirmationNumber, generateSlotId } from './utils'

class ConfessionStore {
  private bookings: Map<string, Booking> = new Map()

  /**
   * Check if a specific slot is available
   */
  isSlotAvailable(date: string, time: string): boolean {
    const slotId = generateSlotId(date, time)
    // Check if any booking exists for this slot
    const bookingsArray = Array.from(this.bookings.values())
    for (const booking of bookingsArray) {
      if (booking.slotId === slotId) {
        return false
      }
    }
    return true
  }

  /**
   * Add a new booking
   * Returns the created booking with confirmation number
   */
  addBooking(data: {
    date: string
    time: string
    firstName: string
    lastName: string
    email: string
    phone: string
  }): Booking {
    const slotId = generateSlotId(data.date, data.time)

    // Double-check availability (prevent race conditions in production)
    if (!this.isSlotAvailable(data.date, data.time)) {
      throw new Error('SLOT_ALREADY_BOOKED')
    }

    const booking: Booking = {
      id: crypto.randomUUID(),
      slotId,
      date: data.date,
      time: data.time,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      createdAt: new Date().toISOString(),
      confirmationNumber: generateConfirmationNumber()
    }

    this.bookings.set(booking.id, booking)

    // TODO: Google Calendar Integration
    // - Create calendar event with title "Confession - {firstName} {lastName}"
    // - Set start/end time based on date, time, and CONFESSION_CONFIG.appointmentDuration
    // - Include email and phone in event description

    // TODO: Send confirmation email
    // - Send email to booking.email with appointment details
    // - Include confirmation number, date, time, location
    // - Attach iCal file for easy calendar import

    return booking
  }

  /**
   * Get a booking by confirmation number
   */
  getBookingByConfirmation(confirmationNumber: string): Booking | undefined {
    const bookingsArray = Array.from(this.bookings.values())
    for (const booking of bookingsArray) {
      if (booking.confirmationNumber === confirmationNumber) {
        return booking
      }
    }
    return undefined
  }

  /**
   * Get a booking by ID
   */
  getBookingById(id: string): Booking | undefined {
    return this.bookings.get(id)
  }

  /**
   * Get all bookings in a date range
   */
  getBookingsInRange(startDate: string, endDate: string): Booking[] {
    const result: Booking[] = []
    const bookingsArray = Array.from(this.bookings.values())
    for (const booking of bookingsArray) {
      if (booking.date >= startDate && booking.date <= endDate) {
        result.push(booking)
      }
    }
    return result
  }

  /**
   * Get all booked slot IDs in a date range
   */
  getBookedSlotIds(startDate: string, endDate: string): Set<string> {
    const bookedIds = new Set<string>()
    const bookingsArray = Array.from(this.bookings.values())
    for (const booking of bookingsArray) {
      if (booking.date >= startDate && booking.date <= endDate) {
        bookedIds.add(booking.slotId)
      }
    }
    return bookedIds
  }

  /**
   * Cancel a booking by ID
   */
  cancelBooking(id: string): boolean {
    return this.bookings.delete(id)
  }

  /**
   * Get total number of bookings (for debugging)
   */
  getBookingCount(): number {
    return this.bookings.size
  }

  /**
   * Clear all bookings (for testing)
   */
  clearAll(): void {
    this.bookings.clear()
  }
}

// Export singleton instance
export const confessionStore = new ConfessionStore()

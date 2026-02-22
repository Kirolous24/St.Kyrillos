import { NextRequest, NextResponse } from 'next/server'
import { CONFESSION_CONFIG } from '@/lib/constants'
import { confessionStore } from '@/lib/confession/store'
import type { BookingRequest, BookingConfirmation, ApiError } from '@/lib/confession/types'
import {
  formatFullDate,
  getTimeRangeDisplay,
  isValidEmail,
  isValidPhone,
  formatPhoneNumber,
  isValidAppointmentDay,
  isPastDate
} from '@/lib/confession/utils'

export const dynamic = 'force-dynamic'

/**
 * POST /api/confession/book
 *
 * Book a confession appointment
 *
 * Request body:
 * - slotId: Unique slot identifier
 * - date: Date in YYYY-MM-DD format
 * - time: Time in HH:MM format (24-hour)
 * - firstName: First name (required)
 * - lastName: Last name (required)
 * - email: Email address (required)
 * - phone: Phone number (required)
 */
export async function POST(request: NextRequest) {
  try {
    const body: BookingRequest = await request.json()

    // Validate required fields
    const validationErrors: string[] = []

    if (!body.firstName?.trim()) {
      validationErrors.push('First name is required')
    }

    if (!body.lastName?.trim()) {
      validationErrors.push('Last name is required')
    }

    if (!body.email?.trim()) {
      validationErrors.push('Email is required')
    } else if (!isValidEmail(body.email)) {
      validationErrors.push('Invalid email format')
    }

    if (!body.phone?.trim()) {
      validationErrors.push('Phone number is required')
    } else if (!isValidPhone(body.phone)) {
      validationErrors.push('Invalid phone number format (must be 10 digits)')
    }

    if (!body.date) {
      validationErrors.push('Date is required')
    }

    if (!body.time) {
      validationErrors.push('Time is required')
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          error: validationErrors.join('. '),
          code: 'VALIDATION_ERROR'
        } as ApiError,
        { status: 400 }
      )
    }

    // Validate date is valid appointment day
    if (!isValidAppointmentDay(body.date)) {
      return NextResponse.json(
        {
          error: 'Appointments are not available on this day',
          code: 'INVALID_DAY'
        } as ApiError,
        { status: 400 }
      )
    }

    // Validate date is not in the past
    if (isPastDate(body.date)) {
      return NextResponse.json(
        {
          error: 'Cannot book appointments in the past',
          code: 'PAST_DATE'
        } as ApiError,
        { status: 400 }
      )
    }

    // Validate time slot is valid
    if (!(CONFESSION_CONFIG.timeSlots as readonly string[]).includes(body.time)) {
      return NextResponse.json(
        {
          error: 'Invalid appointment time',
          code: 'INVALID_TIME'
        } as ApiError,
        { status: 400 }
      )
    }

    // Check slot availability
    if (!confessionStore.isSlotAvailable(body.date, body.time)) {
      return NextResponse.json(
        {
          error: 'This time slot is no longer available. Please select another time.',
          code: 'SLOT_UNAVAILABLE'
        } as ApiError,
        { status: 409 }
      )
    }

    // Create the booking
    let booking
    try {
      booking = confessionStore.addBooking({
        date: body.date,
        time: body.time,
        firstName: body.firstName.trim(),
        lastName: body.lastName.trim(),
        email: body.email.trim().toLowerCase(),
        phone: body.phone.trim()
      })
    } catch (error) {
      if (error instanceof Error && error.message === 'SLOT_ALREADY_BOOKED') {
        return NextResponse.json(
          {
            error: 'This time slot was just booked by someone else. Please select another time.',
            code: 'SLOT_UNAVAILABLE'
          } as ApiError,
          { status: 409 }
        )
      }
      throw error
    }

    // TODO: Google Calendar Integration
    // - Create event in priest's Google Calendar
    // - Title: "Confession - {firstName} {lastName}"
    // - Description: Include email and phone
    // - Set proper start/end times

    // TODO: Send confirmation email
    // - Use email service (SendGrid, Resend, etc.)
    // - Include confirmation number, date, time, location
    // - Attach iCal file

    // Build confirmation response
    const confirmation: BookingConfirmation = {
      confirmationNumber: booking.confirmationNumber,
      date: booking.date,
      time: booking.time,
      displayDate: formatFullDate(booking.date),
      displayTime: getTimeRangeDisplay(booking.time, CONFESSION_CONFIG.appointmentDuration),
      clergName: CONFESSION_CONFIG.clergName,
      location: `${CONFESSION_CONFIG.location.street}, ${CONFESSION_CONFIG.location.cityStateZip}`,
      firstName: booking.firstName,
      lastName: booking.lastName,
      email: booking.email,
      phone: formatPhoneNumber(booking.phone)
    }

    return NextResponse.json(confirmation, { status: 201 })
  } catch (error) {
    console.error('Error booking confession appointment:', error)
    return NextResponse.json(
      {
        error: 'Failed to book appointment. Please try again.',
        code: 'INTERNAL_ERROR'
      } as ApiError,
      { status: 500 }
    )
  }
}

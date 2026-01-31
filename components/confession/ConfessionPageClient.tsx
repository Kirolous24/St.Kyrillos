'use client'

import { useState, useEffect, useCallback } from 'react'
import { ClergyHeader } from './ClergyHeader'
import { MetaInfo } from './MetaInfo'
import { AppointmentScheduler } from './AppointmentScheduler'
import { BookingModal } from './BookingModal'
import { ConfirmationView } from './ConfirmationView'
import { CONFESSION_CONFIG } from '@/lib/constants'
import { formatDateString } from '@/lib/confession/utils'
import type { AvailabilityResponse, TimeSlot, BookingConfirmation } from '@/lib/confession/types'

export function ConfessionPageClient() {
  // Calendar state
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)

  // Data state
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [bookingLoading, setBookingLoading] = useState(false)
  const [bookingError, setBookingError] = useState<string | null>(null)

  // Confirmation state
  const [bookingConfirmation, setBookingConfirmation] = useState<BookingConfirmation | null>(null)

  // Fetch availability
  const fetchAvailability = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const startDate = formatDateString(new Date())
      const response = await fetch(`/api/confession/availability?start=${startDate}&weeks=8`)

      if (!response.ok) {
        throw new Error('Failed to fetch availability')
      }

      const data: AvailabilityResponse = await response.json()
      setAvailability(data)
    } catch (err) {
      setError('Failed to load available appointments. Please try again.')
      console.error('Error fetching availability:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Fetch on mount
  useEffect(() => {
    fetchAvailability()
  }, [fetchAvailability])

  // Handle month change
  const handleMonthChange = (date: Date) => {
    setCurrentMonth(date)
  }

  // Handle date selection
  const handleDateSelect = (date: Date) => {
    setSelectedDate(date)
    setSelectedSlot(null)
  }

  // Handle slot selection
  const handleSlotSelect = (slot: TimeSlot) => {
    setSelectedSlot(slot)
    setIsModalOpen(true)
    setBookingError(null)
  }

  // Handle booking submission
  const handleBookingSubmit = async (formData: {
    firstName: string
    lastName: string
    email: string
    phone: string
  }) => {
    if (!selectedSlot) return

    setBookingLoading(true)
    setBookingError(null)

    try {
      const response = await fetch('/api/confession/book', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          slotId: selectedSlot.id,
          date: selectedSlot.date,
          time: selectedSlot.time,
          ...formData
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to book appointment')
      }

      // Success - show confirmation
      setBookingConfirmation(data as BookingConfirmation)
      setIsModalOpen(false)

      // Refresh availability to reflect the booked slot
      fetchAvailability()
    } catch (err) {
      setBookingError(err instanceof Error ? err.message : 'Failed to book appointment')
    } finally {
      setBookingLoading(false)
    }
  }

  // Handle modal close
  const handleModalClose = () => {
    setIsModalOpen(false)
    setSelectedSlot(null)
    setBookingError(null)
  }

  // Handle book another
  const handleBookAnother = () => {
    setBookingConfirmation(null)
    setSelectedDate(null)
    setSelectedSlot(null)
    fetchAvailability()
  }

  // Show confirmation view if we have a booking
  if (bookingConfirmation) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container-custom">
          <ConfirmationView
            booking={bookingConfirmation}
            onBookAnother={handleBookAnother}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="container-custom py-8 md:py-12">
        {/* Header */}
        <ClergyHeader
          clergName={CONFESSION_CONFIG.clergName}
          clergTitle={CONFESSION_CONFIG.clergTitle}
          clergImage={CONFESSION_CONFIG.clergImage}
          pageTitle="Confession/Appointments"
        />

        {/* Meta info */}
        <MetaInfo
          duration={CONFESSION_CONFIG.appointmentDuration}
          location={CONFESSION_CONFIG.location}
        />

        {/* Error state */}
        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            <p>{error}</p>
            <button
              onClick={fetchAvailability}
              className="mt-2 text-sm font-medium underline hover:no-underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Scheduler */}
        <AppointmentScheduler
          availability={availability}
          currentMonth={currentMonth}
          onMonthChange={handleMonthChange}
          selectedDate={selectedDate}
          onDateSelect={handleDateSelect}
          selectedSlot={selectedSlot}
          onSlotSelect={handleSlotSelect}
          isLoading={isLoading}
        />

        {/* Booking Modal */}
        <BookingModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          selectedSlot={selectedSlot}
          onSubmit={handleBookingSubmit}
          isLoading={bookingLoading}
          error={bookingError}
        />

        {/* Screen reader status announcements */}
        <div role="status" aria-live="polite" className="sr-only">
          {bookingLoading && 'Booking appointment...'}
          {bookingConfirmation && 'Appointment booked successfully'}
          {bookingError && `Error: ${bookingError}`}
        </div>
      </div>
    </div>
  )
}

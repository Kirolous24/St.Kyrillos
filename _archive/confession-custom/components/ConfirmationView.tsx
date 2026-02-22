'use client'

import { CheckCircle, Calendar, Clock, MapPin, User, Mail, Phone } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { BookingConfirmation } from '@/lib/confession/types'
import { getTimezoneDisplay } from '@/lib/confession/utils'

interface ConfirmationViewProps {
  booking: BookingConfirmation
  onBookAnother: () => void
}

export function ConfirmationView({ booking, onBookAnother }: ConfirmationViewProps) {
  return (
    <div className="max-w-xl mx-auto text-center">
      {/* Success icon */}
      <div className="mb-6">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
      </div>

      {/* Confirmation message */}
      <h2 className="font-serif text-heading-2 text-gray-900 mb-2">
        Appointment Booked!
      </h2>
      <p className="text-gray-600 mb-2">
        Your confession appointment has been confirmed.
      </p>
      <p className="text-sm text-gray-500 mb-8">
        Confirmation #: <span className="font-mono font-medium text-gray-700">{booking.confirmationNumber}</span>
      </p>

      {/* Appointment details card */}
      <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-6 mb-8 text-left">
        <h3 className="font-medium text-gray-900 mb-4">Appointment Details</h3>

        <div className="space-y-4">
          {/* Date & Time */}
          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-primary-900 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-gray-900">{booking.displayDate}</p>
              <p className="text-gray-600">{booking.displayTime}</p>
              <p className="text-sm text-gray-500">{getTimezoneDisplay()}</p>
            </div>
          </div>

          {/* Location */}
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-primary-900 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-gray-900">{booking.location}</p>
            </div>
          </div>

          {/* Clergy */}
          <div className="flex items-center gap-3">
            <User className="w-5 h-5 text-primary-900 flex-shrink-0" />
            <p className="text-gray-900">{booking.clergName}</p>
          </div>
        </div>

        <hr className="my-4 border-gray-100" />

        <h3 className="font-medium text-gray-900 mb-4">Your Information</h3>

        <div className="space-y-3">
          {/* Name */}
          <div className="flex items-center gap-3">
            <User className="w-5 h-5 text-gray-400 flex-shrink-0" />
            <p className="text-gray-700">{booking.firstName} {booking.lastName}</p>
          </div>

          {/* Email */}
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-gray-400 flex-shrink-0" />
            <p className="text-gray-700">{booking.email}</p>
          </div>

          {/* Phone */}
          <div className="flex items-center gap-3">
            <Phone className="w-5 h-5 text-gray-400 flex-shrink-0" />
            <p className="text-gray-700">{booking.phone}</p>
          </div>
        </div>
      </div>

      {/* Confirmation email notice */}
      <p className="text-gray-600 mb-8">
        You'll receive a confirmation email shortly with these details.
      </p>

      {/* Actions */}
      <Button onClick={onBookAnother} variant="secondary">
        Book Another Appointment
      </Button>
    </div>
  )
}

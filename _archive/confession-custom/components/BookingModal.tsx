'use client'

import { useState } from 'react'
import { MapPin, Calendar, Clock, AlertCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import type { TimeSlot } from '@/lib/confession/types'
import {
  formatFullDate,
  getTimeRangeDisplay,
  getTimezoneDisplay
} from '@/lib/confession/utils'
import { CONFESSION_CONFIG } from '@/lib/constants'

interface BookingFormData {
  firstName: string
  lastName: string
  email: string
  phone: string
}

interface BookingModalProps {
  onClose: () => void
  selectedSlot: TimeSlot
  onSubmit: (data: BookingFormData) => Promise<void>
  isLoading: boolean
  error: string | null
}

const initialFormData: BookingFormData = {
  firstName: '',
  lastName: '',
  email: '',
  phone: ''
}

export function BookingModal({
  onClose,
  selectedSlot,
  onSubmit,
  isLoading,
  error
}: BookingModalProps) {
  const [formData, setFormData] = useState<BookingFormData>(initialFormData)
  const [formErrors, setFormErrors] = useState<Partial<BookingFormData>>({})

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (formErrors[name as keyof BookingFormData]) {
      setFormErrors(prev => ({ ...prev, [name]: undefined }))
    }
  }

  const validateForm = (): boolean => {
    const errors: Partial<BookingFormData> = {}

    if (!formData.firstName.trim()) {
      errors.firstName = 'First name is required'
    }

    if (!formData.lastName.trim()) {
      errors.lastName = 'Last name is required'
    }

    if (!formData.email.trim()) {
      errors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email'
    }

    if (!formData.phone.trim()) {
      errors.phone = 'Phone number is required'
    } else {
      const digits = formData.phone.replace(/\D/g, '')
      if (digits.length < 10) {
        errors.phone = 'Please enter a valid phone number'
      }
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return
    await onSubmit(formData)
  }

  const handleClose = () => {
    setFormData(initialFormData)
    setFormErrors({})
    onClose()
  }

  const displayDate = formatFullDate(selectedSlot.date)
  const displayTime = getTimeRangeDisplay(selectedSlot.time, CONFESSION_CONFIG.appointmentDuration)
  const timezone = getTimezoneDisplay()

  return (
    <div className="bg-white rounded-2xl shadow-soft-xl border border-gray-100 p-6 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-serif text-heading-3 text-gray-900">
          Confession/Appointments
        </h2>
        <button
          onClick={handleClose}
          className={cn(
            'p-2 rounded-full text-gray-400 hover:text-gray-600',
            'hover:bg-gray-100 transition-colors',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-900'
          )}
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Appointment details */}
        <div className="space-y-3 mb-6 pb-6 border-b border-gray-200">
          <div className="flex items-center gap-3 text-gray-700">
            <Calendar className="w-5 h-5 text-gray-400 flex-shrink-0" />
            <span>{displayDate}</span>
          </div>

          <div className="flex items-center gap-3 text-gray-700">
            <Clock className="w-5 h-5 text-gray-400 flex-shrink-0" />
            <div>
              <span>{displayTime}</span>
              <span className="text-sm text-gray-500 ml-2">{timezone}</span>
            </div>
          </div>

          <div className="flex items-start gap-3 text-gray-700">
            <MapPin className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p>{CONFESSION_CONFIG.location.name}</p>
              <p>{CONFESSION_CONFIG.location.street}</p>
              <p>{CONFESSION_CONFIG.location.cityStateZip}</p>
            </div>
          </div>
        </div>

        {/* Contact form */}
        <div className="space-y-4">
          <h3 className="font-medium text-gray-900">Your contact info</h3>

          <div className="grid grid-cols-2 gap-4">
            {/* First Name */}
            <div>
              <label htmlFor="firstName" className="label">
                First name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                className={cn('input', formErrors.firstName && 'border-red-500 focus:ring-red-500')}
                placeholder="John"
                disabled={isLoading}
              />
              {formErrors.firstName && (
                <p className="text-sm text-red-500 mt-1">{formErrors.firstName}</p>
              )}
            </div>

            {/* Last Name */}
            <div>
              <label htmlFor="lastName" className="label">
                Last name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                className={cn('input', formErrors.lastName && 'border-red-500 focus:ring-red-500')}
                placeholder="Doe"
                disabled={isLoading}
              />
              {formErrors.lastName && (
                <p className="text-sm text-red-500 mt-1">{formErrors.lastName}</p>
              )}
            </div>
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="label">
              Email address <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={cn('input', formErrors.email && 'border-red-500 focus:ring-red-500')}
              placeholder="john@example.com"
              disabled={isLoading}
            />
            {formErrors.email && (
              <p className="text-sm text-red-500 mt-1">{formErrors.email}</p>
            )}
          </div>

          {/* Phone */}
          <div>
            <label htmlFor="phone" className="label">
              Phone number <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className={cn('input', formErrors.phone && 'border-red-500 focus:ring-red-500')}
              placeholder="(555) 123-4567"
              disabled={isLoading}
            />
            {formErrors.phone && (
              <p className="text-sm text-red-500 mt-1">{formErrors.phone}</p>
            )}
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-lg mt-4">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-4 mt-6 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            className="text-gray-600 hover:text-gray-900 font-medium transition-colors"
          >
            Cancel
          </button>
          <Button
            type="submit"
            variant="primary"
            disabled={isLoading}
          >
            {isLoading ? 'Booking...' : 'Book'}
          </Button>
        </div>
      </form>
    </div>
  )
}

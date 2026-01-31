'use client'

import { useState } from 'react'
import { Send, CheckCircle, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FormData {
  name: string
  email: string
  phone: string
  subject: string
  message: string
}

const initialFormData: FormData = {
  name: '',
  email: '',
  phone: '',
  subject: '',
  message: '',
}

const subjects = [
  'General Inquiry',
  'First Visit Questions',
  'Sacrament Request (Baptism, Wedding, etc.)',
  'Pastoral Appointment',
  'Volunteer Interest',
  'Other',
]

export function ContactForm() {
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    setErrorMessage('')

    try {
      // Simulate form submission
      // Replace this with actual form handling (Formspree, email service, etc.)
      await new Promise((resolve) => setTimeout(resolve, 1500))

      // In production, you would send the form data here:
      // const response = await fetch('https://formspree.io/f/your-form-id', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(formData),
      // })

      console.log('Form submitted:', formData)
      setStatus('success')
      setFormData(initialFormData)
    } catch (error) {
      setStatus('error')
      setErrorMessage('Something went wrong. Please try again or contact us by phone.')
    }
  }

  if (status === 'success') {
    return (
      <div className="text-center py-8">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h3 className="font-serif text-xl font-semibold text-gray-900 mb-2">
          Message Sent!
        </h3>
        <p className="text-gray-600 mb-6">
          Thank you for reaching out. We'll get back to you as soon as possible.
        </p>
        <button
          onClick={() => setStatus('idle')}
          className="text-primary-900 font-medium hover:underline"
        >
          Send Another Message
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Name */}
      <div>
        <label htmlFor="name" className="label">
          Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
          className="input"
          placeholder="Your full name"
        />
      </div>

      {/* Email */}
      <div>
        <label htmlFor="email" className="label">
          Email <span className="text-red-500">*</span>
        </label>
        <input
          type="email"
          id="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          required
          className="input"
          placeholder="your@email.com"
        />
      </div>

      {/* Phone */}
      <div>
        <label htmlFor="phone" className="label">
          Phone <span className="text-gray-400">(optional)</span>
        </label>
        <input
          type="tel"
          id="phone"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          className="input"
          placeholder="(555) 123-4567"
        />
      </div>

      {/* Subject */}
      <div>
        <label htmlFor="subject" className="label">
          Subject <span className="text-red-500">*</span>
        </label>
        <select
          id="subject"
          name="subject"
          value={formData.subject}
          onChange={handleChange}
          required
          className="input"
        >
          <option value="">Select a subject...</option>
          {subjects.map((subject) => (
            <option key={subject} value={subject}>
              {subject}
            </option>
          ))}
        </select>
      </div>

      {/* Message */}
      <div>
        <label htmlFor="message" className="label">
          Message <span className="text-red-500">*</span>
        </label>
        <textarea
          id="message"
          name="message"
          value={formData.message}
          onChange={handleChange}
          required
          rows={5}
          className="input resize-none"
          placeholder="How can we help you?"
        />
      </div>

      {/* Error Message */}
      {status === 'error' && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-lg">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{errorMessage}</p>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={status === 'loading'}
        className={cn(
          'w-full btn-primary',
          status === 'loading' && 'opacity-70 cursor-not-allowed'
        )}
      >
        {status === 'loading' ? (
          'Sending...'
        ) : (
          <>
            Send Message
            <Send className="w-4 h-4" />
          </>
        )}
      </button>

      <p className="text-gray-500 text-sm text-center">
        For urgent matters, please call us at{' '}
        <a href="tel:" className="text-primary-900 font-medium">
          [PHONE NUMBER]
        </a>
      </p>
    </form>
  )
}

'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

interface SubscribeFormProps {
  variant?: 'light' | 'dark'
  className?: string
}

export function SubscribeForm({ variant = 'light', className }: SubscribeFormProps) {
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')

    // Simulate form submission - replace with actual Mailchimp or other integration
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      setStatus('success')
      setMessage('Thanks for subscribing! Please check your email to confirm.')
      setEmail('')
      setFirstName('')
    } catch {
      setStatus('error')
      setMessage('Something went wrong. Please try again.')
    }
  }

  const isDark = variant === 'dark'

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-3', className)}>
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="First name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          className={cn(
            'flex-1 px-4 py-3 rounded-lg text-base transition-colors',
            'focus:outline-none focus:ring-2',
            isDark
              ? 'bg-white/10 border border-white/20 text-white placeholder:text-gray-400 focus:ring-gold focus:border-transparent'
              : 'bg-white border border-gray-300 text-gray-900 placeholder:text-gray-500 focus:ring-primary-900 focus:border-transparent'
          )}
          required
        />
        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={cn(
            'flex-1 px-4 py-3 rounded-lg text-base transition-colors',
            'focus:outline-none focus:ring-2',
            isDark
              ? 'bg-white/10 border border-white/20 text-white placeholder:text-gray-400 focus:ring-gold focus:border-transparent'
              : 'bg-white border border-gray-300 text-gray-900 placeholder:text-gray-500 focus:ring-primary-900 focus:border-transparent'
          )}
          required
        />
      </div>
      <button
        type="submit"
        disabled={status === 'loading'}
        className={cn(
          'w-full sm:w-auto px-6 py-3 rounded-lg font-semibold text-base transition-all',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          isDark
            ? 'bg-gold text-white hover:bg-gold-dark'
            : 'bg-primary-900 text-white hover:bg-primary-950'
        )}
      >
        {status === 'loading' ? 'Subscribing...' : 'Subscribe'}
      </button>
      {status === 'success' && (
        <p className={cn('text-sm', isDark ? 'text-green-400' : 'text-green-600')}>
          {message}
        </p>
      )}
      {status === 'error' && (
        <p className={cn('text-sm', isDark ? 'text-red-400' : 'text-red-600')}>
          {message}
        </p>
      )}
      <p className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>
        We respect your privacy. Unsubscribe anytime.
      </p>
    </form>
  )
}

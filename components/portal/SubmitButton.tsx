'use client'

import { useFormStatus } from 'react-dom'
import { buttonClass } from './ui'
import { cn } from '@/lib/utils'

export function SubmitButton({ children, pendingText, variant = 'primary', className }: { children: React.ReactNode; pendingText?: string; variant?: 'primary' | 'secondary' | 'danger'; className?: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className={cn(buttonClass(variant), className)}>
      {pending ? pendingText ?? 'Saving…' : children}
    </button>
  )
}

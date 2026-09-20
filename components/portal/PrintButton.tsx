'use client'

import { Printer } from 'lucide-react'
import { buttonClass } from './ui'
import { cn } from '@/lib/utils'

/** Triggers the browser's print dialog; hidden from the printed page itself. */
export function PrintButton({ label = 'Print', className }: { label?: string; className?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={cn(buttonClass('secondary'), 'print:hidden', className)}>
      <Printer className="h-4 w-4" aria-hidden /> {label}
    </button>
  )
}

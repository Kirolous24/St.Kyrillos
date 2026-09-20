'use client'

import { Download } from 'lucide-react'
import { buttonClass } from './ui'
import { cn } from '@/lib/utils'

/**
 * Saves text the server already produced as a file, without a round trip.
 * Used by CSV exports and the JSON backup.
 */
export function DownloadButton({
  filename,
  content,
  mime = 'text/csv;charset=utf-8',
  label = 'Download CSV',
  variant = 'secondary',
  className,
}: {
  filename: string
  content: string
  mime?: string
  label?: string
  variant?: 'primary' | 'secondary' | 'gold'
  className?: string
}) {
  function save() {
    const blob = new Blob([content.startsWith('﻿') ? content : `﻿${content}`], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return (
    <button type="button" onClick={save} className={cn(buttonClass(variant), 'print:hidden', className)}>
      <Download className="h-4 w-4" aria-hidden /> {label}
    </button>
  )
}

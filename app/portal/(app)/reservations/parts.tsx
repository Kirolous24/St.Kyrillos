import { Bus } from 'lucide-react'
import { colorOf } from '@/lib/portal/reservations'
import { cn } from '@/lib/utils'

// The pieces every reservation screen draws a van with (2026-11-02). Plain
// markup, so the form (a client component) and the pages share them.

/** A van's color as a dot: how the calendar tells the vans apart. */
export function VanSwatch({ color, className }: { color: string; className?: string }) {
  const c = colorOf(color)
  return (
    <span
      aria-hidden
      className={cn('inline-block h-3 w-3 shrink-0 rounded-full border', className)}
      style={{ backgroundColor: c.bg, borderColor: c.border }}
    />
  )
}

/** The van's name in its own colors, with anything else that belongs beside it. */
export function VanChip({ name, color, children, className }: { name: string; color: string; children?: React.ReactNode; className?: string }) {
  const c = colorOf(color)
  return (
    <span
      className={cn('inline-flex max-w-full items-center gap-1 rounded-[8px] border px-2 py-0.5 text-[11.5px] font-bold', className)}
      style={{ backgroundColor: c.bg, color: c.fg, borderColor: c.border }}
    >
      <span className="truncate">{name}</span>
      {children}
    </span>
  )
}

/**
 * A van's picture, or its color with a bus on it until it has one. Shaped like
 * a van photo (wider than tall), and decorative: its name is always beside it.
 */
export function VanPicture({ color, photo, size = 'md' }: { color: string; photo: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const box = size === 'lg' ? 'h-24 w-[152px]' : size === 'sm' ? 'h-10 w-16' : 'h-16 w-[104px]'
  if (photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photo} alt="" className={cn(box, 'shrink-0 rounded-[10px] border border-parch-200 bg-white object-contain')} />
  }
  const c = colorOf(color)
  return (
    <span
      aria-hidden
      className={cn(box, 'flex shrink-0 items-center justify-center rounded-[10px] border')}
      style={{ backgroundColor: c.bg, color: c.fg, borderColor: c.border }}
    >
      <Bus className={size === 'lg' ? 'h-9 w-9' : size === 'sm' ? 'h-[18px] w-[18px]' : 'h-6 w-6'} />
    </span>
  )
}

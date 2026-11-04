import { Bus, Clock3 } from 'lucide-react'
import { Badge } from '@/components/portal/ui'
import { colorOf, reservationStatusLabel, type ReservationStatus } from '@/lib/portal/reservations'
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

/**
 * The van's name in its own colors, with anything else that belongs beside it.
 * A request still waiting for approval (2026-11-04) is drawn hollow, with a
 * dashed edge and a clock.
 */
export function VanChip({
  name,
  color,
  waiting = false,
  clock = true,
  children,
  className,
}: {
  name: string
  color: string
  waiting?: boolean
  /** False where there is no room for it: a calendar square, where the dashed edge says enough. */
  clock?: boolean
  children?: React.ReactNode
  className?: string
}) {
  const c = colorOf(color)
  const style = waiting
    ? { backgroundColor: '#FFFFFF', color: c.bg === '#FFFFFF' ? c.fg : c.bg, borderColor: c.border, borderStyle: 'dashed' as const }
    : { backgroundColor: c.bg, color: c.fg, borderColor: c.border }
  return (
    <span className={cn('inline-flex max-w-full items-center gap-1 rounded-[8px] border px-2 py-0.5 text-[11.5px] font-bold', className)} style={style}>
      {waiting && clock && <Clock3 className="h-3 w-3 shrink-0" aria-hidden />}
      <span className="truncate">{name}</span>
      {waiting && <span className="sr-only">, waiting for approval</span>}
      {children}
    </span>
  )
}

/** Where a reservation stands (2026-11-04): waiting, approved, not approved, or never answered. */
export function StatusBadge({ status, endsAt, now }: { status: ReservationStatus; endsAt: Date; now: Date }) {
  const tone = status === 'APPROVED' ? 'good' : status === 'REJECTED' ? 'bad' : endsAt <= now ? 'neutral' : 'warn'
  return <Badge tone={tone}>{reservationStatusLabel(status, endsAt, now)}</Badge>
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

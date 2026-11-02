'use client'

import { cn } from '@/lib/utils'

export type SessionOption = { key: string; label: string; points?: number }

/**
 * Attendance for several sessions at once (2026-11-01: "Sometimes vespers &
 * hymns"): the other sessions the same check-in also records, as on/off chips.
 * Used by the register, QR codes, card scanning and servants' meeting codes.
 */
export function AlsoSessions({
  options,
  primary,
  value,
  onChange,
  label = 'Also record for',
  disabled = false,
}: {
  options: readonly SessionOption[]
  /** The session being taken, never offered here. */
  primary: string
  value: readonly string[]
  onChange: (keys: string[]) => void
  label?: string
  disabled?: boolean
}) {
  const others = options.filter((o) => o.key !== primary)
  if (others.length === 0) return null
  const on = new Set(value.filter((k) => k !== primary))
  return (
    <div className="flex flex-wrap items-center gap-1.5 print:hidden" data-testid="also-sessions">
      <span className="mr-0.5 text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">{label}</span>
      {others.map((o) => {
        const pressed = on.has(o.key)
        return (
          <button
            key={o.key}
            type="button"
            disabled={disabled}
            aria-pressed={pressed}
            data-also-session={o.key}
            onClick={() => onChange(pressed ? Array.from(on).filter((k) => k !== o.key) : [...Array.from(on), o.key])}
            className={cn(
              'min-h-[36px] rounded-[10px] px-3 py-1.5 text-[12px] font-bold transition-colors',
              pressed
                ? 'bg-brand-wash text-brand-800 ring-1 ring-brand-gold/60'
                : 'border border-parch-200 bg-parch-50 text-parch-600 hover:border-brand-gold/50 hover:text-brand-800',
            )}
          >
            {pressed ? '✓ ' : '+ '}
            {o.label}
            {o.points ? <span className="font-semibold text-parch-500"> +{o.points}</span> : null}
          </button>
        )
      })}
    </div>
  )
}

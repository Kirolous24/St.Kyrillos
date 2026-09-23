'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Printer } from 'lucide-react'
import { buttonClass, checkboxClass } from '@/components/portal/ui'
import { cn } from '@/lib/utils'

export interface CardData {
  id: string
  name: string
  loginId: string
  inactive: boolean
  /** Rendered on the server: `qrcode` is server-only. */
  qr: string
}

/**
 * The printable card sheet, with a way to pick who gets printed.
 *
 * The port always printed every card in the class, so reprinting one lost card
 * meant a full sheet of thirty. Selection filters the *printout* — unselected
 * cards stay on screen so you can see what you did not pick.
 */
export function CardSheet({ cards, className, accent }: { cards: CardData[]; className: string; accent: string }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const some = selected.size > 0
  const all = cards.length > 0 && cards.every((c) => selected.has(c.id))

  return (
    <>
      <div className="mb-3.5 flex flex-wrap items-center gap-2 print:hidden">
        <label className="flex min-h-[36px] cursor-pointer items-center gap-2 text-[12px] font-bold text-parch-700">
          <input
            type="checkbox"
            className={checkboxClass}
            checked={all}
            aria-label="Select every card"
            onChange={(e) => setSelected(e.target.checked ? new Set(cards.map((c) => c.id)) : new Set())}
          />
          Select all
        </label>
        <button type="button" onClick={() => window.print()} className={cn(buttonClass('secondary', 'sm'), 'min-h-[36px]')}>
          <Printer className="h-4 w-4" aria-hidden />
          {some ? `Print selected (${selected.size})` : 'Print all cards'}
        </button>
        {some && (
          <button type="button" onClick={() => setSelected(new Set())} className={buttonClass('secondary', 'sm')}>
            Clear
          </button>
        )}
        {/* F0344 — the class total sat in the server-rendered subtitle and the
            selected count only existed inside the print button's label, which
            reads "Print all cards" at zero. A servant ticking their way down a
            class of thirty had no running number to check before printing. */}
        <span aria-live="polite" className="ml-auto text-[11.5px] font-semibold text-parch-600">
          {cards.length} student{cards.length === 1 ? '' : 's'} · {selected.size} selected
        </span>
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {cards.map((s) => (
          <li
            key={s.id}
            className={cn(
              'relative flex break-inside-avoid flex-col items-center gap-2 rounded-[12px] border-[1.5px] border-dashed bg-parch-50 p-3 text-center',
              s.inactive && 'opacity-60',
              selected.has(s.id) ? 'border-brand-gold' : 'border-parch-300',
              // Unselected cards drop out of the printout, not the screen.
              some && !selected.has(s.id) && 'print:hidden',
            )}
          >
            <label className="absolute left-1.5 top-1.5 cursor-pointer p-1 print:hidden">
              <input
                type="checkbox"
                className={checkboxClass}
                checked={selected.has(s.id)}
                aria-label={`Select ${s.name}`}
                onChange={() =>
                  setSelected((prev) => {
                    const next = new Set(prev)
                    if (next.has(s.id)) next.delete(s.id)
                    else next.add(s.id)
                    return next
                  })
                }
              />
            </label>

            <span className="flex items-center gap-1.5">
              <Image src="/images/Logo.png" alt="" width={18} height={18} className="h-[18px] w-[18px] rounded-full object-cover" />
              <span className="text-[8.5px] font-bold uppercase tracking-[0.8px] text-brand-gold-dark">St. Kyrillos VI</span>
            </span>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={s.qr}
              alt=""
              width={128}
              height={128}
              className="rounded-[14px] bg-parch-50"
            />

            <p className="w-full truncate font-serif text-[13px] font-bold leading-tight text-parch-900">{s.name}</p>
            <p className="w-full truncate text-[9.5px] font-bold uppercase tracking-[0.8px]" style={{ color: accent }}>
              {className}
            </p>
            <p className="text-[19px] font-bold leading-none tracking-[0.28em] text-brand-800 tabular-nums">
              {s.loginId}
            </p>
          </li>
        ))}
      </ul>
    </>
  )
}

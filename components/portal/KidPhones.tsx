import { Phone } from 'lucide-react'
import { kidPhoneList, type KidPhone } from '@/lib/portal/phones'
import { cn } from '@/lib/utils'

const WHOSE: Record<KidPhone['label'], string> = {
  Father: 'father',
  Mother: 'mother',
  Parents: 'parents',
  Student: 'own number',
}

/**
 * A child's phone numbers on every card a servant sees (2026-10-19), each one
 * tap to call. Staff pages only: a child never sees another child's family's
 * numbers.
 */
export function KidPhones({
  name,
  fatherPhone,
  motherPhone,
  ownPhone,
  center = false,
  className,
}: {
  name: string
  fatherPhone?: string | null
  motherPhone?: string | null
  ownPhone?: string | null
  center?: boolean
  className?: string
}) {
  const phones = kidPhoneList({ fatherPhone, motherPhone, ownPhone })
  if (phones.length === 0) {
    return (
      <p data-testid="kid-phones" className={cn('text-[11px] text-parch-500', center && 'text-center', className)}>
        No phone number on file
      </p>
    )
  }
  return (
    <ul data-testid="kid-phones" className={cn('flex flex-wrap gap-x-3 gap-y-1 text-[11.5px]', center && 'justify-center', className)}>
      {phones.map((p) => (
        <li key={p.label}>
          <a
            href={p.tel}
            className="inline-flex items-center gap-1 font-semibold tabular-nums text-brand-800 hover:text-brand-gold-dark"
            aria-label={`Call ${name}’s ${WHOSE[p.label]}, ${p.display}`}
          >
            <Phone className="h-3 w-3 shrink-0" aria-hidden />
            <span className="font-bold text-parch-500">{p.label}</span>
            {p.display}
          </a>
        </li>
      ))}
    </ul>
  )
}

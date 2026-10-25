import { Phone, MessageSquare, MessageCircle } from 'lucide-react'
import { formatPhone, normalizePhone, waLink } from '@/lib/portal/phones'
import { cn } from '@/lib/utils'

/**
 * A Fellowship member's own number (2026-10-24): one tap to call, and on their
 * page to text or WhatsApp too. A member is an adult, so there is no family
 * to label; it is simply their phone.
 */
export function MemberPhone({
  name,
  phone,
  full = false,
  center = false,
  className,
}: {
  name: string
  phone: string | null | undefined
  /** Text and WhatsApp beside Call. */
  full?: boolean
  center?: boolean
  className?: string
}) {
  const digits = normalizePhone(phone)
  if (!digits) {
    return (
      <p data-testid="member-phone" className={cn('text-[11px] text-parch-500', center && 'text-center', className)}>
        No phone number on file
      </p>
    )
  }
  const display = formatPhone(digits)
  const wa = waLink(digits)
  const link = 'inline-flex items-center gap-1 font-semibold tabular-nums text-brand-800 hover:text-brand-gold-dark'
  return (
    <ul data-testid="member-phone" className={cn('flex flex-wrap gap-x-3 gap-y-1 text-[11.5px]', center && 'justify-center', className)}>
      <li>
        <a href={`tel:${digits}`} className={link} aria-label={`Call ${name}, ${display}`}>
          <Phone className="h-3 w-3 shrink-0" aria-hidden />
          {display}
        </a>
      </li>
      {full && (
        <li>
          <a href={`sms:+${digits.length === 10 ? `1${digits}` : digits}`} className={link} aria-label={`Text ${name}`}>
            <MessageSquare className="h-3 w-3 shrink-0" aria-hidden />
            Text
          </a>
        </li>
      )}
      {full && wa && (
        <li>
          <a href={wa} target="_blank" rel="noopener noreferrer" className={link} aria-label={`WhatsApp ${name}`}>
            <MessageCircle className="h-3 w-3 shrink-0" aria-hidden />
            WhatsApp
          </a>
        </li>
      )}
    </ul>
  )
}

import Link from '@/components/portal/Link'
import { Phone, MessageCircle, Cake, HeartHandshake } from 'lucide-react'
import type { KidCardData } from '@/lib/portal/data/group-cards'
import { ageOn, daysUntilBirthday } from '@/lib/portal/dates'
import { kidPhoneList, waLink } from '@/lib/portal/phones'
import { Card, Badge, Avatar, buttonClass } from './ui'
import { CheckInButton } from './CheckInButton'
import { ExcuseControl } from './ExcuseControl'
import { ExcuseNote } from './ExcuseNote'
import { KidPhones } from './KidPhones'
import { cn } from '@/lib/utils'

/**
 * One child on My Group or Class Groups (2026-09-26; Class Groups and excuses
 * 2026-10-19): everything a servant needs before a phone call. The last few
 * Sundays, whether a case is open, when somebody last reached the family and
 * who, the family's numbers, and a way to log the call or excuse the child.
 * Any servant of the class may do both, whoever's group the child is in.
 */
export function KidCard({ card, today, canWrite }: { card: KidCardData; today: string; canWrite: boolean }) {
  const primary = kidPhoneList({ fatherPhone: card.fatherPhone, motherPhone: card.motherPhone, ownPhone: card.ownPhone })[0] ?? null
  const wa = waLink(primary?.digits)
  const birthdayIn = card.dob ? daysUntilBirthday(card.dob, today) : null
  const last = card.lastContact
  return (
    <div data-kid-card={card.id}>
    <Card>
      <div className="flex items-start gap-3" data-testid="my-group-kid" data-student={card.id}>
        <Avatar name={card.name} photo={card.photo} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Link href={`/portal/students/${card.id}`} className="font-serif text-[14px] font-bold text-parch-900 hover:text-brand-800">
              {card.name}
            </Link>
            {card.dob && <span className="text-[11.5px] text-parch-500">· {ageOn(card.dob, today)}</span>}
            {card.openCase && (
              <Link href={`/portal/follow-ups/${card.openCase.id}`}>
                <Badge tone={card.excusedNow ? 'neutral' : 'warn'}>
                  <HeartHandshake className="h-3 w-3" aria-hidden /> Open case
                </Badge>
              </Link>
            )}
            {birthdayIn !== null && birthdayIn <= 7 && (
              <Badge tone="gold">
                <Cake className="h-3 w-3" aria-hidden /> {birthdayIn === 0 ? 'Birthday today' : `Birthday in ${birthdayIn}d`}
              </Badge>
            )}
          </div>
          {/* The last few Sundays the class held, oldest first. */}
          <div className="mt-1.5 flex items-center gap-1" aria-label="Recent Sundays">
            {card.dots.map((dot) => (
              <span
                key={dot.date}
                title={`${dot.date}: ${dot.status === null ? 'before they joined' : dot.excused ? 'excused from follow-up' : dot.status.toLowerCase()}`}
                className={cn(
                  'inline-block h-2.5 w-2.5 rounded-full',
                  dot.status === 'PRESENT' && 'bg-[#16A34A]',
                  (dot.status === 'EXCUSED' || dot.excused) && 'bg-parch-300',
                  dot.status === 'ABSENT' && !dot.excused && 'border-[1.5px] border-[#DC2626]',
                  dot.status === null && 'bg-parch-100',
                )}
              />
            ))}
            <span className="ml-1.5 text-[11.5px] text-parch-600">
              {card.dots.length === 0
                ? 'No Sundays recorded yet'
                : card.streak === 0
                  ? card.excusedNow
                    ? 'Excused'
                    : 'Came last Sunday'
                  : `Missed ${card.streak} in a row`}
            </span>
          </div>
          <p className="mt-1 text-[11.5px] text-parch-600" data-testid="last-contacted">
            {last === null
              ? 'Not contacted yet'
              : `${last.daysAgo === 0 ? 'Contacted today' : `Last contacted ${last.daysAgo} day${last.daysAgo === 1 ? '' : 's'} ago`}${last.by ? ` by ${last.by}` : ''}${last.forGroup ? ` for ${last.forGroup}’s group` : ''}`}
            {' · '}
            {card.points.toLocaleString()} pts
          </p>
          <KidPhones name={card.name} fatherPhone={card.fatherPhone} motherPhone={card.motherPhone} ownPhone={card.ownPhone} className="mt-1.5" />
        </div>
      </div>
      {card.excuse && <ExcuseNote excuse={card.excuse} today={today} className="mt-3" />}
      {canWrite && (
        <div className="mt-3 flex flex-wrap items-start gap-1.5">
          {primary && (
            <a href={primary.tel} className={cn(buttonClass('secondary', 'sm'), 'min-h-[36px] px-2.5')} aria-label={`Call ${card.name}’s family`}>
              <Phone className="h-3.5 w-3.5 text-[#DC2626]" aria-hidden />
            </a>
          )}
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer" className={cn(buttonClass('secondary', 'sm'), 'min-h-[36px] px-2.5')} aria-label={`WhatsApp ${card.name}’s family`}>
              <MessageCircle className="h-3.5 w-3.5 text-[#16A34A]" aria-hidden />
            </a>
          )}
          <CheckInButton studentId={card.id} studentName={card.name} />
          <ExcuseControl studentId={card.id} studentName={card.name} today={today} excuse={card.excuse} />
        </div>
      )}
    </Card>
    </div>
  )
}

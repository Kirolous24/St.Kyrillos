import Link from 'next/link'
import { BellRing, ChevronRight } from 'lucide-react'
import { loadNotifications } from '@/lib/portal/data/reports'
import { Card, Badge } from '@/components/portal/ui'
import type { PortalUser } from '@/lib/portal/permissions'
import { cn } from '@/lib/utils'

/** The prototype's status colours, as the dot beside each line. */
const TONE_DOT = {
  bad: 'bg-[#DC2626]',
  warn: 'bg-[#D97706]',
  good: 'bg-[#16A34A]',
  info: 'bg-[#2563EB]',
} as const

const TONE_BADGE = {
  bad: 'bad',
  warn: 'warn',
  good: 'good',
  info: 'info',
} as const

/** Dashboard column: what needs this person today. Nothing to say → nothing shown. */
export async function NotificationsWidget({ user }: { user: PortalUser }): Promise<JSX.Element | null> {
  const items = await loadNotifications(user)
  if (items.length === 0) return null

  return (
    <Card
      title="Needs you"
      icon={<BellRing className="h-4 w-4" />}
      action={<Badge tone={TONE_BADGE[items[0]!.tone]}>{items.length}</Badge>}
      bodyClassName="p-0"
    >
      <ul className="divide-y divide-[#F3F0EB]">
        {items.slice(0, 6).map((n) => (
          <li key={n.key}>
            <Link
              href={n.href}
              className="flex min-h-[44px] items-start gap-2.5 px-[18px] py-2.5 transition-colors hover:bg-brand-wash/60"
            >
              <span aria-hidden className={cn('mt-[7px] h-2 w-2 shrink-0 rounded-full', TONE_DOT[n.tone])} />
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-bold leading-snug text-parch-900">{n.title}</span>
                {n.detail && <span className="mt-0.5 block text-[11px] text-parch-500">{n.detail}</span>}
              </span>
              <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-parch-400" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      {items.length > 6 && (
        <p className="border-t border-[#F3F0EB] px-[18px] py-2 text-[11px] text-parch-500">
          +{items.length - 6} more in the bell.
        </p>
      )}
    </Card>
  )
}

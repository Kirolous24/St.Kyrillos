import Link from 'next/link'
import { Bell, Check, X } from 'lucide-react'
import { requirePortalUser } from '@/lib/portal/session'
import { loadNotifications } from '@/lib/portal/data/reports'
import { dismissNotification, markAllNotificationsRead } from '@/lib/portal/actions/notifications'
import { cn } from '@/lib/utils'

/**
 * The bell, ready to mount anywhere in the portal chrome: `<NotificationBell />`.
 * It loads the signed-in person's undismissed notifications itself, so the
 * layout needs no props and no data fetching.
 *
 * Deliberately a server component: the dropdown is a native <details>, and the
 * two mutations are plain forms, so it costs no client JavaScript and still
 * works with none.
 */
export async function NotificationBell() {
  const user = await requirePortalUser()
  const items = await loadNotifications(user)
  const count = items.length

  const dotTone = items.some((n) => n.tone === 'bad')
    ? 'bg-[#DC2626]'
    : items.some((n) => n.tone === 'warn')
      ? 'bg-[#D97706]'
      : 'bg-brand-gold'

  return (
    <details className="group relative print:hidden">
      <summary
        className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full text-parch-600 transition-colors hover:bg-brand-wash hover:text-brand-800 [&::-webkit-details-marker]:hidden"
        aria-label={count === 0 ? 'Notifications' : `Notifications, ${count} unread`}
      >
        <span className="relative">
          <Bell className="h-5 w-5" aria-hidden />
          {count > 0 && (
            <span
              className={cn(
                'absolute -right-1.5 -top-1.5 grid h-4 min-w-[1rem] place-items-center rounded-full px-1 text-[10px] font-bold text-white',
                dotTone,
              )}
            >
              {count > 9 ? '9+' : count}
            </span>
          )}
        </span>
      </summary>

      <div className="absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-[14px] border border-parch-200 bg-parch-50 shadow-panel">
        <header className="flex items-center justify-between gap-3 border-b border-parch-200 bg-parch-100/60 px-3.5 py-2.5">
          <h2 className="font-serif text-[13px] font-semibold text-brand-950">Notifications</h2>
          {count > 0 && (
            <form
              action={async () => {
                'use server'
                await markAllNotificationsRead(items.map((n) => n.key))
              }}
            >
              <button type="submit" className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand-800 hover:underline">
                <Check className="h-3.5 w-3.5" aria-hidden /> Mark all read
              </button>
            </form>
          )}
        </header>

        {count === 0 ? (
          <p className="px-3.5 py-6 text-center text-[12.5px] text-parch-500">Nothing needs you right now.</p>
        ) : (
          <ul className="max-h-[22rem] divide-y divide-parch-200/70 overflow-y-auto">
            {items.map((n) => (
              <li key={n.key} className="flex items-start gap-2 px-3.5 py-2.5">
                <span
                  aria-hidden
                  className={cn(
                    'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                    n.tone === 'bad' && 'bg-[#DC2626]',
                    n.tone === 'warn' && 'bg-[#D97706]',
                    n.tone === 'good' && 'bg-[#16A34A]',
                    n.tone === 'info' && 'bg-[#2563EB]',
                  )}
                />
                <Link href={n.href} className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-semibold leading-snug text-brand-950">{n.title}</span>
                  {n.detail && <span className="mt-0.5 block text-[11px] text-parch-500">{n.detail}</span>}
                </Link>
                <form
                  action={async () => {
                    'use server'
                    await dismissNotification(n.key)
                  }}
                >
                  <button
                    type="submit"
                    className="grid h-6 w-6 place-items-center rounded-full text-parch-400 transition-colors hover:bg-parch-100 hover:text-brand-800"
                    aria-label={`Dismiss: ${n.title}`}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  )
}

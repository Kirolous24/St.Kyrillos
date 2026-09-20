import Link from 'next/link'
import { Compass } from 'lucide-react'
import { PageHeader, EmptyState, buttonClass } from '@/components/portal/ui'

/**
 * Renders for any `notFound()` call inside this segment — including the role
 * gates on admin/staff-only pages (e.g. `if (user.role !== 'ADMIN') notFound()`)
 * — and for an unmatched `/portal/*` URL. Styled with the portal's own kit
 * instead of falling through to Next's generic 404.
 */
export default function PortalNotFound() {
  return (
    <>
      <PageHeader title="Page not found" icon={<Compass className="h-5 w-5" />} />
      <EmptyState
        title="We couldn't find that page"
        hint="It may have moved, or your account may not have access to it."
        action={
          <Link href="/portal" className={buttonClass('primary')}>
            Back to dashboard
          </Link>
        }
      />
    </>
  )
}

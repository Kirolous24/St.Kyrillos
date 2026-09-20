import type { Metadata } from 'next'
import { Shell } from '@/components/portal/Shell'
import { requirePortalUser } from '@/lib/portal/session'
import { navForUser } from '@/lib/portal/nav'
import { signOutPortal } from '@/lib/portal/actions/auth'
import { ROLE_LABEL, academicYearLabel, greetingFor, formatShortDate } from '@/lib/portal/format'
import { NotificationBell } from '@/components/portal/NotificationBell'
import { BirthdayChip } from '@/components/portal/BirthdayChip'
import { nextBirthdayForTopbar } from '@/lib/portal/data/dashboard'
import { todayInNewYork } from '@/lib/portal/dates'

export const metadata: Metadata = {
  title: { default: 'Sunday School Portal', template: '%s | Sunday School' },
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function PortalAppLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePortalUser()
  const today = todayInNewYork()
  const nextBirthday = await nextBirthdayForTopbar(user, today)
  return (
    <Shell
      nav={navForUser(user)}
      userName={user.displayName}
      roleLabel={ROLE_LABEL[user.role]}
      onSignOut={signOutPortal}
      greeting={greetingFor()}
      academicYear={academicYearLabel(today)}
      topbarChip={
        nextBirthday ? <BirthdayChip name={nextBirthday.name} when={formatShortDate(nextBirthday.on)} /> : null
      }
      headerSlot={<NotificationBell />}
    >
      {children}
    </Shell>
  )
}

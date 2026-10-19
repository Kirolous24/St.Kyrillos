import { Bell, KeyRound, UserRound } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '@/lib/portal/session'
import { PageHeader, Card, Avatar, Badge } from '@/components/portal/ui'
import { ROLE_LABEL } from '@/lib/portal/format'
import { isLiveSite } from '@/lib/portal/login-email'
import { webPushPublicKey } from '@/lib/portal/web-push'
import { NotificationSettings } from '@/components/portal/NotificationSettings'
import { ChangePinForm } from './ChangePinForm'

export const metadata = { title: 'My Settings' }

export default async function SettingsPage() {
  const user = await requirePortalUser()
  // Servant assignment notices (2026-10-19): a servant chooses where they reach them.
  const notices = user.servantId
    ? await Promise.all([
        prisma.account.findUnique({ where: { id: user.accountId }, select: { email: true, noticeEmails: true } }),
        prisma.pushSubscription.count({ where: { accountId: user.accountId, live: isLiveSite(process.env) } }),
      ])
    : null
  return (
    <>
      <PageHeader
        title={user.role === 'STUDENT' ? 'My PIN' : 'My Settings'}
        subtitle={notices ? 'Your notifications and your sign-in code' : 'Keep your sign-in code to yourself'}
        icon={<KeyRound className="h-5 w-5" />}
      />
      <div className="mx-auto max-w-md space-y-4">
        <Card title="Account" icon={<UserRound className="h-4 w-4" />}>
          <div className="flex items-center gap-3.5">
            <Avatar name={user.displayName} size="lg" />
            <div className="min-w-0">
              <span className="mb-0.5 block text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">Signed in as</span>
              <p className="truncate font-serif text-[17px] font-bold text-parch-900">{user.displayName}</p>
              <p className="mt-1.5">
                <Badge tone="brand">{ROLE_LABEL[user.role]}</Badge>
              </p>
            </div>
          </div>
        </Card>
        {notices && (
          <Card title="Notifications" icon={<Bell className="h-4 w-4" aria-hidden />}>
            <NotificationSettings
              publicKey={webPushPublicKey()}
              phonesOn={notices[1]}
              email={notices[0]?.email?.trim() || null}
              emailOn={notices[0]?.noticeEmails ?? true}
            />
          </Card>
        )}
        <ChangePinForm />
      </div>
    </>
  )
}

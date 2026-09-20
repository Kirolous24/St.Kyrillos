import { KeyRound, UserRound } from 'lucide-react'
import { requirePortalUser } from '@/lib/portal/session'
import { PageHeader, Card, Avatar, Badge } from '@/components/portal/ui'
import { ROLE_LABEL } from '@/lib/portal/format'
import { ChangePinForm } from './ChangePinForm'

export const metadata = { title: 'My PIN' }

export default async function SettingsPage() {
  const user = await requirePortalUser()
  return (
    <>
      <PageHeader title="My PIN" subtitle="Keep your sign-in code to yourself" icon={<KeyRound className="h-5 w-5" />} />
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
        <ChangePinForm />
      </div>
    </>
  )
}

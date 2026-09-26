import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '@/lib/portal/session'
import { notFound } from 'next/navigation'
import { UserCog } from 'lucide-react'
import { PageHeader } from '@/components/portal/ui'
import { ServantForm } from '@/components/portal/ServantForm'
import { formatDateOnly } from '@/lib/portal/dates'
import { formatPhone } from '@/lib/portal/phones'
import { formatDateTime } from '@/lib/portal/format'
import { LoginCard } from '@/components/portal/LoginCard'
import { onFileAccountIds } from '@/lib/portal/data/logins'
import { pinVaultEnabled } from '@/lib/portal/pin-vault'

export const metadata = { title: 'Edit servant' }

export default async function EditServantPage({ params }: { params: { id: string } }) {
  const user = await requirePortalUser()
  if (user.role !== 'ADMIN') notFound()
  const [account, classes] = await Promise.all([
    prisma.account.findUnique({
      where: { id: params.id },
      select: {
        id: true, displayName: true, role: true, email: true, phone: true, loginId: true, isActive: true, lastLoginAt: true,
        servant: { select: { birthday: true, address: true, stageOversight: true, classes: { orderBy: { sortOrder: 'asc' }, select: { classId: true, title: true } } } },
      },
    }),
    prisma.schoolClass.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } }),
  ])
  if (!account || account.role === 'STUDENT') notFound()
  const onFile = (await onFileAccountIds([account.id])).has(account.id)

  return (
    <>
      <PageHeader
        title={account.displayName}
        subtitle={`ID ${account.loginId} \u00b7 last sign-in ${account.lastLoginAt ? formatDateTime(account.lastLoginAt) : 'never'}`}
        icon={<UserCog className="h-5 w-5" />}
        back={{ href: '/portal/admin/servants', label: 'Servants' }}
      />
      <div className="mb-3.5">
        <LoginCard
          accountId={account.id}
          loginId={account.loginId}
          name={account.displayName}
          email={account.email}
          phone={account.phone}
          onFile={onFile}
          vaultEnabled={pinVaultEnabled()}
        />
      </div>
      <ServantForm
        mode="edit"
        accountId={account.id}
        isSelf={account.id === user.accountId}
        classes={classes}
        initial={{
          displayName: account.displayName,
          role: account.role as 'SERVANT' | 'ADMIN' | 'PASTOR',
          email: account.email ?? '',
          phone: formatPhone(account.phone),
          birthday: account.servant?.birthday ? formatDateOnly(account.servant.birthday) : '',
          address: account.servant?.address ?? '',
          stageOversight: account.servant?.stageOversight ?? '',
          classes: account.servant?.classes.map((c) => ({ classId: c.classId, title: c.title ?? '' })) ?? [],
          isActive: account.isActive,
        }}
      />
    </>
  )
}

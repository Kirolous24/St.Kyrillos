import { notFound } from 'next/navigation'
import { Settings2 } from 'lucide-react'
import { requirePortalUser } from '@/lib/portal/session'
import { reservationApprovers, reservationItems, reservationServantChoices } from '@/lib/portal/data/reservations'
import { Badge, Card, PageHeader } from '@/components/portal/ui'
import { VanSwatch } from '../parts'
import { AddItemForm, ItemEditor } from './ItemEditor'
import { ApproversEditor } from './ApproversEditor'

export const metadata = { title: 'Manage vans' }

/** The admin's list of vans (2026-11-02): what servants can reserve, and (2026-11-04) who approves the requests. */
export default async function ManageVansPage() {
  const user = await requirePortalUser()
  if (user.role !== 'ADMIN') notFound()
  const [items, approvers, servants] = await Promise.all([reservationItems(true), reservationApprovers(), reservationServantChoices()])

  return (
    <>
      <PageHeader
        title="Manage vans"
        icon={<Settings2 className="h-5 w-5" aria-hidden />}
        back={{ href: '/portal/reservations', label: 'Reservations' }}
        subtitle="The vans servants can reserve: their names, colors on the calendar and pictures, and who approves the requests."
      />
      <Card title="Who approves requests" className="mb-5">
        <p className="mb-3 text-[12.5px] text-parch-600">
          Every van request goes to them, on the phone and by email with all its details, and they approve or reject it. The one who asked is told
          the answer the same way. The admin can approve or reject too.
        </p>
        <ApproversEditor approvers={approvers} servants={servants} />
      </Card>
      <ul className="mb-5 space-y-4">
        {items.map((item) => (
          <li key={item.id}>
            <Card
              title={
                <span className="flex items-center gap-2">
                  <VanSwatch color={item.color} />
                  {item.name}
                  {!item.isActive && <Badge>Retired</Badge>}
                </span>
              }
            >
              <ItemEditor item={item} />
            </Card>
          </li>
        ))}
      </ul>
      <Card title="Add a van">
        <AddItemForm />
      </Card>
    </>
  )
}

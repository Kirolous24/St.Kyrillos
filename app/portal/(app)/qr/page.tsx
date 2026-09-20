import { notFound } from 'next/navigation'
import { QrCode, ScanLine, Printer } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '@/lib/portal/session'
import { listVisibleClasses } from '@/lib/portal/data/classes'
import { listServantActivities } from '@/lib/portal/data/servant-attendance'
import { can } from '@/lib/portal/permissions'
import { PageHeader, Tabs, TabLink, EmptyState, Callout, LinkButton } from '@/components/portal/ui'
import { GroupCodePanel } from './GroupCodePanel'
import { ScanPanel } from './ScanPanel'

export const metadata = { title: 'QR Check-in' }

export default async function QrHubPage({ searchParams }: { searchParams: { tab?: string } }) {
  const user = await requirePortalUser()
  if (user.role !== 'ADMIN' && user.role !== 'SERVANT') notFound()

  const tab = searchParams.tab === 'scan' ? 'scan' : 'group'
  const all = await listVisibleClasses(user)
  const classes = all.filter((c) => can(user, 'attendance.write', { classId: c.id, classStage: c.stage }))
  const classIds = classes.map((c) => c.id)

  const [sessions, activities, servantActivities] = await Promise.all([
    prisma.attendanceSession.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' }, select: { key: true, label: true, points: true } }),
    classIds.length
      ? prisma.pointActivity.findMany({
          where: { isActive: true, points: { gt: 0 }, OR: [{ classId: null }, { classId: { in: classIds } }] },
          orderBy: { label: 'asc' },
          select: { id: true, label: true, points: true, classId: true },
        })
      : Promise.resolve([]),
    listServantActivities(),
  ])

  return (
    <>
      <PageHeader
        eyebrow="Attendance"
        icon={<QrCode className="h-5 w-5" aria-hidden />}
        title="QR Check-in"
        subtitle="Show one code for the class to scan, or scan the students' own cards one by one."
        actions={<LinkButton href="/portal/qr/cards" variant="secondary"><Printer className="h-4 w-4" aria-hidden /> Print QR cards</LinkButton>}
      />

      <Tabs>
        <TabLink href="/portal/qr?tab=group" active={tab === 'group'}>
          <span className="inline-flex items-center gap-1.5"><QrCode className="h-4 w-4" aria-hidden /> Group code</span>
        </TabLink>
        <TabLink href="/portal/qr?tab=scan" active={tab === 'scan'}>
          <span className="inline-flex items-center gap-1.5"><ScanLine className="h-4 w-4" aria-hidden /> Scan students</span>
        </TabLink>
        <TabLink href="/portal/qr/cards" active={false}>
          <span className="inline-flex items-center gap-1.5"><Printer className="h-4 w-4" aria-hidden /> Print QR cards</span>
        </TabLink>
      </Tabs>

      {classes.length === 0 ? (
        <EmptyState
          title="No class to check in"
          hint="QR check-in needs a class you may take attendance for. Ask an admin to assign you to one."
        />
      ) : tab === 'group' ? (
        <>
          <div className="mx-auto mb-4 max-w-[440px]">
            <Callout tone="info" title="How it works">
              A code lives five minutes, works only for the classes you pick, and can be used once per person.
              Students open it from their own phone while signed in to the portal.
            </Callout>
          </div>
          <GroupCodePanel
            classes={classes.map((c) => ({ id: c.id, name: c.name }))}
            sessions={sessions}
            activities={activities}
            servantActivities={servantActivities.map((a) => ({ key: a.key, label: a.label }))}
          />
        </>
      ) : (
        <ScanPanel
          classes={classes.map((c) => ({ id: c.id, name: c.name }))}
          sessions={sessions}
          activities={activities}
        />
      )}
    </>
  )
}

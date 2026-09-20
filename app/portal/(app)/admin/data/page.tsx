import { notFound } from 'next/navigation'
import { Database, Sparkles, UserCog, Users, CalendarCheck } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '@/lib/portal/session'
import { PageHeader, StatCard, Callout } from '@/components/portal/ui'
import { BackupPanel } from './BackupPanel'
import { ImportPanel } from './ImportPanel'
import { RepairPanel } from './RepairPanel'
import { DangerZone } from './DangerZone'

export const metadata = { title: 'Data & backup' }

export default async function AdminDataPage() {
  const user = await requirePortalUser()
  // Admin only — the page simply is not there for anyone else.
  if (user.role !== 'ADMIN') notFound()

  const [classes, studentCount, servantCount, pointCount, attendanceCount] = await Promise.all([
    prisma.schoolClass.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], select: { id: true, name: true } }),
    prisma.student.count(),
    prisma.account.count({ where: { role: { in: ['SERVANT', 'ADMIN', 'PASTOR'] } } }),
    prisma.pointEntry.count(),
    prisma.attendanceRecord.count(),
  ])

  return (
    <>
      <PageHeader
        title="Data & backup"
        icon={<Database className="h-5 w-5" />}
        subtitle="Administration · take a backup before anything here, and before the end of the school year."
      />

      <div className="mb-5 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StatCard label="Students" value={studentCount} icon={<Users className="h-6 w-6" />} accent="#16A34A" />
        <StatCard
          label="Servants & staff"
          value={servantCount}
          icon={<UserCog className="h-6 w-6" />}
          accent="#4F46E5"
        />
        <StatCard
          label="Point entries"
          value={pointCount.toLocaleString()}
          icon={<Sparkles className="h-6 w-6" />}
          accent="#C89B3C"
        />
        <StatCard
          label="Attendance rows"
          value={attendanceCount.toLocaleString()}
          icon={<CalendarCheck className="h-6 w-6" />}
          accent="#2563EB"
        />
      </div>

      <div className="space-y-5">
        <BackupPanel />
        <ImportPanel classes={classes} />
        <RepairPanel />
        {classes.length === 0 ? (
          <Callout tone="info" title="Danger zone">
            The class-level tools appear once there is at least one class.
          </Callout>
        ) : (
          <DangerZone classes={classes} />
        )}
      </div>
    </>
  )
}

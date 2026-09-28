import { prisma } from '@/lib/prisma'
import { rosterWhere } from '@/lib/portal/class-members'
import { requirePortalUser } from '@/lib/portal/session'
import { requireClassAccess } from '@/lib/portal/data/classes'
import { classTotals } from '@/lib/portal/data/dashboard'
import { studentName } from '@/lib/portal/data/students'
import { rankStudents, canUndo } from '@/lib/portal/points-math'
import { Trophy } from 'lucide-react'
import { PageHeader } from '@/components/portal/ui'
import { PointsPanel } from './PointsPanel'

export const metadata = { title: 'Points' }

export default async function PointsPage({ params }: { params: { id: string } }) {
  const user = await requirePortalUser()
  const cls = await requireClassAccess(user, params.id, 'points.write')

  const [students, activities, history] = await Promise.all([
    // Members of a class that takes other classes are on its leaderboard (2026-09-28).
    prisma.student.findMany({
      where: rosterWhere(cls.id),
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      select: { id: true, firstName: true, lastName: true, account: { select: { photo: true } } },
    }),
    // The activities every class has, then this class's own (2026-09-28).
    prisma.pointActivity.findMany({
      where: { isActive: true, points: { gt: 0 }, OR: [{ classId: null }, { classId: cls.id }] },
      orderBy: { label: 'asc' },
    }),
    prisma.pointEntry.findMany({
      where: { classId: cls.id },
      orderBy: { createdAt: 'desc' },
      // Was 60, which made anything older than about a fortnight in an active
      // class unreachable through the UI — the rows were in the database but
      // invisible, and the History tab's own search could not find them.
      take: 500,
      select: {
        id: true, points: true, activityLabel: true, reason: true, source: true, undone: true, undoOfId: true, createdAt: true,
        student: { select: { firstName: true, lastName: true } },
        createdBy: { select: { displayName: true } },
      },
    }),
  ])
  const totals = await classTotals([cls.id])
  const ranked = rankStudents(students.map((s) => ({ studentId: s.id, name: studentName(s), total: totals.get(s.id) ?? 0 })))
  const photo = new Map(students.map((s) => [s.id, s.account.photo]))

  return (
    <>
      <PageHeader
        title="Points"
        subtitle={`${cls.name} \u00b7 tap students on the leaderboard to give or remove points`}
        icon={<Trophy className="h-5 w-5" />}
        back={{ href: `/portal/classes/${cls.id}`, label: cls.name }}
      />
      <PointsPanel
        classId={cls.id}
        classLabel={cls.name}
        isAdmin={user.role === 'ADMIN'}
        students={ranked.map((r) => ({ id: r.studentId, name: r.name, total: r.total, rank: r.rank, photo: photo.get(r.studentId) ?? null }))}
        activities={[...activities]
          .sort((a, b) => Number(a.classId !== null) - Number(b.classId !== null))
          .map((a) => ({ id: a.id, key: a.key, label: a.label, points: a.points, icon: a.icon, own: a.classId === cls.id }))}
        history={history.map((h) => ({
          id: h.id,
          points: h.points,
          label: h.activityLabel,
          reason: h.reason,
          undone: h.undone,
          source: h.source,
          canUndo: canUndo(h),
          student: studentName(h.student),
          by: h.createdBy?.displayName ?? 'System',
          at: h.createdAt.toISOString(),
        }))}
      />
    </>
  )
}

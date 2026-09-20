import Link from 'next/link'
import { notFound } from 'next/navigation'
import { GraduationCap, Layers, UserCog, Users } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '@/lib/portal/session'
import { accentByOrder } from '@/lib/portal/accents'
import { STAGE_LABEL } from '@/lib/portal/format'
import { PageHeader, StatCard, Card, EmptyState, Badge } from '@/components/portal/ui'

export const metadata = { title: 'My Stage' }

/**
 * A coordinator's view across every class in the stage they oversee — the one
 * screen that answers "who is covering what this year". Servant.stageOversight
 * is what grants it; without that field set there is nothing to show, so the
 * page 404s rather than rendering an empty shell.
 */
export default async function MyStagePage() {
  const user = await requirePortalUser()
  const stage = user.stageOversight
  if (!stage) notFound()

  const classes = await prisma.schoolClass.findMany({
    where: { stage, isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      name: true,
      sortOrder: true,
      _count: { select: { students: true } },
      servants: {
        select: {
          title: true,
          servant: { select: { account: { select: { displayName: true } } } },
        },
      },
    },
  })

  const studentTotal = classes.reduce((n, c) => n + c._count.students, 0)
  // One servant may cover two classes in the stage; count people, not rows.
  const servantTotal = new Set(
    classes.flatMap((c) => c.servants.map((s) => s.servant.account.displayName)),
  ).size

  const label = STAGE_LABEL[stage]

  return (
    <>
      <PageHeader
        title={label}
        icon={<Layers className="h-5 w-5" aria-hidden />}
        subtitle={`Every ${label.toLowerCase()} class, who serves in it, and how many students it holds.`}
      />

      <div className="mb-5 grid gap-3.5 sm:grid-cols-3">
        <StatCard label="Classes" value={classes.length} icon={<GraduationCap className="h-[19px] w-[19px]" />} />
        <StatCard label="Students" value={studentTotal} icon={<Users className="h-[19px] w-[19px]" />} />
        <StatCard label="Servants" value={servantTotal} icon={<UserCog className="h-[19px] w-[19px]" />} />
      </div>

      {classes.length === 0 ? (
        <EmptyState
          title={`No ${label.toLowerCase()} classes yet`}
          hint="Once classes are added to this stage they will appear here."
        />
      ) : (
        <ul className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
          {classes.map((c) => {
            const coordinators = c.servants.filter((s) => s.title === 'COORDINATOR')
            const assistants = c.servants.filter((s) => s.title === 'ASSISTANT_COORDINATOR')
            const others = c.servants.filter((s) => !s.title)
            const accent = accentByOrder(c.sortOrder)

            return (
              <li key={c.id}>
                <Card className="h-full" bodyClassName="p-4">
                  <div className="mb-2.5 flex items-center justify-between gap-2 border-b border-[#F0EBE3] pb-2">
                    <Link
                      href={`/portal/classes/${c.id}`}
                      className="truncate text-[14px] font-bold text-parch-900 underline-offset-4 transition-colors hover:text-brand-800 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold"
                      style={{ borderLeft: `3px solid ${accent}`, paddingLeft: 9 }}
                    >
                      {c.name}
                    </Link>
                    <Badge tone="neutral">
                      {c._count.students} student{c._count.students === 1 ? '' : 's'}
                    </Badge>
                  </div>

                  {c.servants.length === 0 ? (
                    <p className="text-[11.5px] text-parch-500">No servants assigned yet.</p>
                  ) : (
                    <dl className="space-y-2">
                      {([
                        ['Coordinator', coordinators],
                        ['Assistant Coordinator', assistants],
                        ['Servants', others],
                      ] as const).map(([heading, list]) =>
                        list.length === 0 ? null : (
                          <div key={heading}>
                            <dt className="mb-0.5 text-[9.5px] font-bold uppercase tracking-[0.4px] text-brand-gold-dark">
                              {heading}
                            </dt>
                            <dd className="text-[12.5px] text-parch-700">
                              {list.map((s) => s.servant.account.displayName).join(', ')}
                            </dd>
                          </div>
                        ),
                      )}
                    </dl>
                  )}
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}

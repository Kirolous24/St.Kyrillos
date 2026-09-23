import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BarChart3, GraduationCap, Layers, UserCog, Users } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '@/lib/portal/session'
import { accentByOrder } from '@/lib/portal/accents'
import { STAGE_LABEL } from '@/lib/portal/format'
import { PageHeader, StatCard, Card, EmptyState, Badge, LinkButton } from '@/components/portal/ui'

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
        actions={
          /* The prototype embedded the whole reports system at the bottom of
             this page, stage-scoped, with its print button relabelled "Print
             Stage Report" (OG L16974-16981, L7433). The scoping survived in
             churchReportScope() but a coordinator landing here had nothing to
             tell them the reports they wanted were behind a generic "Reports"
             item in the sidebar. */
          <LinkButton href="/portal/reports?tab=church" variant="secondary">
            <BarChart3 className="h-4 w-4" aria-hidden /> Print Stage Report
          </LinkButton>
        }
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
                {/* F0640 — the prototype made the whole card the click target
                    (OG :16963). Here only the class name was a link, so a
                    coordinator moving through six classes had to hit a 14px line
                    of text each time, on a phone, in a hall. The overlay is a
                    real full-size link rather than an sr-only one, and nothing
                    else on this card is interactive, so it cannot swallow a
                    control. */}
                <Card className="group relative h-full" bodyClassName="p-4">
                  <Link
                    href={`/portal/classes/${c.id}`}
                    className="absolute inset-0 z-[1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold"
                  >
                    <span className="sr-only">Open {c.name}</span>
                  </Link>
                  <div className="mb-2.5 flex items-center justify-between gap-2 border-b border-[#F0EBE3] pb-2">
                    <span
                      className="truncate text-[14px] font-bold text-parch-900 underline-offset-4 transition-colors group-hover:text-brand-800 group-hover:underline"
                      style={{ borderLeft: `3px solid ${accent}`, paddingLeft: 9 }}
                    >
                      {c.name}
                    </span>
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

      <div className="mt-5">
        <Card
          title={`${label} reports`}
          icon={<BarChart3 className="h-4 w-4" aria-hidden />}
          action={
            <LinkButton href="/portal/reports?tab=church" variant="secondary" size="sm">
              Open
            </LinkButton>
          }
        >
          <p className="text-[12.5px] leading-relaxed text-parch-600">
            The same reports the admin uses, already scoped to your {label.toLowerCase()} classes: attendance, exam
            scores and points per class, with the students behind each number and a printable sheet.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            <li>
              <LinkButton href="/portal/reports?tab=church&mode=attendance" variant="secondary" size="sm">
                Attendance
              </LinkButton>
            </li>
            <li>
              <LinkButton href="/portal/reports?tab=church&mode=exams" variant="secondary" size="sm">
                Exam scores
              </LinkButton>
            </li>
            <li>
              <LinkButton href="/portal/reports?tab=church&mode=points" variant="secondary" size="sm">
                Points
              </LinkButton>
            </li>
            <li>
              <LinkButton href="/portal/reports/cards" variant="secondary" size="sm">
                Report cards
              </LinkButton>
            </li>
          </ul>
        </Card>
      </div>
    </>
  )
}

import { notFound } from 'next/navigation'
import { GraduationCap, Printer, CalendarCheck, QrCode, HeartHandshake } from 'lucide-react'
import { requirePortalUser } from '@/lib/portal/session'
import { listVisibleClasses } from '@/lib/portal/data/classes'
import { PageHeader, EmptyState, LinkButton, ClassCard, Tabs, TabLink, SectionTitle } from '@/components/portal/ui'
import { STAGE_LABEL } from '@/lib/portal/format'
import { accentByOrder } from '@/lib/portal/accents'
import { isFellowship } from '@/lib/portal/fellowship'
import { can } from '@/lib/portal/permissions'

export const metadata = { title: 'Classes' }

export default async function ClassesPage({
  searchParams,
}: {
  searchParams: { tab?: string }
}) {
  const user = await requirePortalUser()
  // Staff area — students reach their own class through their own page only.
  if (user.role === 'STUDENT') notFound()
  // The Fellowship meetings get their own section below the classes (2026-10-24).
  const all = await listVisibleClasses(user, { fellowship: 'include' })
  const classes = all.filter((c) => !isFellowship(c.stage))
  const meetings = all.filter((c) => isFellowship(c.stage))

  /**
   * A stage coordinator who also teaches opened this page and met every class
   * in their stage, their own among them, with nothing to say which was which.
   * The answer is not to take the oversight away — that is the whole point of
   * the role, and without it the coordinators would be back to sharing the
   * admin login — but to land them on their own class and keep the stage one
   * tap away.
   *
   * Only split when there is something on both sides. A servant who only
   * teaches, a coordinator who teaches nothing, and every admin see exactly
   * what they saw before.
   */
  const mine = classes.filter((c) => user.classIds.includes(c.id))
  const rest = classes.filter((c) => !user.classIds.includes(c.id))
  const split = mine.length > 0 && rest.length > 0
  const onStageTab = split && searchParams.tab === 'stage'
  const shown = split ? (onStageTab ? rest : mine) : classes
  const stageLabel = user.stageOversight && !isFellowship(user.stageOversight) ? STAGE_LABEL[user.stageOversight] : 'Other classes'
  // A servant who serves only meetings is not shown an empty classes grid.
  const onlyMeetings = classes.length === 0 && meetings.length > 0

  return (
    <>
      <PageHeader
        title={onlyMeetings ? (meetings.length === 1 ? 'My Meeting' : 'My Meetings') : user.role === 'SERVANT' ? 'My Classes' : 'Classes'}
        subtitle={[
          shown.length > 0 || !onlyMeetings ? `${shown.length} class${shown.length === 1 ? '' : 'es'}` : null,
          meetings.length > 0 ? `${meetings.length} Fellowship meeting${meetings.length === 1 ? '' : 's'}` : null,
        ].filter(Boolean).join(' · ')}
        icon={<GraduationCap className="h-5 w-5" />}
        actions={user.role === 'ADMIN' ? <LinkButton href="/portal/admin/classes">Manage classes</LinkButton> : undefined}
      />
      {split && (
        <Tabs>
          <TabLink href="/portal/classes" active={!onStageTab}>
            My {mine.length === 1 ? 'class' : 'classes'} ({mine.length})
          </TabLink>
          <TabLink href="/portal/classes?tab=stage" active={onStageTab}>
            {stageLabel} ({rest.length})
          </TabLink>
        </Tabs>
      )}
      {onlyMeetings ? null : shown.length === 0 ? (
        <EmptyState title="No classes to show" hint="Classes you serve in will appear here." />
      ) : (
        /* .classes-grid — repeat(auto-fill,minmax(210px,1fr)), gap 14px */
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-[repeat(auto-fill,minmax(210px,1fr))]">
          {shown.map((c) => (
            <ClassCard
              key={c.id}
              href={`/portal/classes/${c.id}`}
              name={c.name}
              accent={accentByOrder(c.sortOrder)}
              icon={<GraduationCap className="h-[19px] w-[19px]" />}
              photo={c.photo}
              /* F0535 — "Ages 9 to 11" under the class name, from the notes an
                 admin already writes on the class. */
              note={c.description}
              rows={[
                { key: 'Servants', value: c.servantCount === 0 ? 'Not assigned' : `${c.servantCount} servant${c.servantCount === 1 ? '' : 's'}` },
                { key: 'Students', value: c.studentCount },
                { key: 'Stage', value: <span className="text-brand-gold-dark">{STAGE_LABEL[c.stage]}</span> },
              ]}
              /* The prototype put a one-click Print on every class row
                 (OG L15478) — no navigating, no filters to set first. */
              actions={
                <LinkButton href={`/portal/reports/class/${c.id}`} variant="secondary" size="sm">
                  <Printer className="h-4 w-4" aria-hidden /> Print
                </LinkButton>
              }
            />
          ))}
        </div>
      )}

      {/* The adults' meetings (2026-10-24): members instead of students, and
          attendance and follow-ups rather than the class printouts. */}
      {meetings.length > 0 && (
        <section className={onlyMeetings ? '' : 'mt-7'} aria-label="Fellowship meetings">
          {!onlyMeetings && <SectionTitle hint="Members, attendance and follow-ups">Fellowship meetings</SectionTitle>}
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-[repeat(auto-fill,minmax(210px,1fr))]">
            {meetings.map((c) => {
              const members = c.studentCount + c.memberCount
              return (
                <ClassCard
                  key={c.id}
                  href={`/portal/classes/${c.id}`}
                  name={c.name}
                  accent={accentByOrder(c.sortOrder)}
                  icon={<HeartHandshake className="h-[19px] w-[19px]" />}
                  photo={c.photo}
                  note={c.description}
                  rows={[
                    { key: 'Servants', value: c.servantCount === 0 ? 'Not assigned' : `${c.servantCount} servant${c.servantCount === 1 ? '' : 's'}` },
                    { key: 'Members', value: members },
                    { key: 'Follow-up after', value: `${c.visitationThreshold} missed` },
                  ]}
                  actions={
                    can(user, 'attendance.write', { classId: c.id, classStage: c.stage }) ? (
                      <>
                        <LinkButton href={`/portal/classes/${c.id}/attendance`} variant="secondary" size="sm">
                          <CalendarCheck className="h-4 w-4" aria-hidden /> Attendance
                        </LinkButton>
                        <LinkButton href={`/portal/classes/${c.id}/checkin`} variant="secondary" size="sm">
                          <QrCode className="h-4 w-4" aria-hidden /> QR
                        </LinkButton>
                      </>
                    ) : undefined
                  }
                />
              )
            })}
          </div>
        </section>
      )}
    </>
  )
}

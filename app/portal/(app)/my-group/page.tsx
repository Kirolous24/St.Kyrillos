import Link from '@/components/portal/Link'
import { notFound } from 'next/navigation'
import { UsersRound } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '@/lib/portal/session'
import { can } from '@/lib/portal/permissions'
import { listVisibleClasses } from '@/lib/portal/data/classes'
import { ensureInitialSplits, loadClassGroups } from '@/lib/portal/data/groups'
import { loadKidCards, type KidCardData } from '@/lib/portal/data/group-cards'
import { effectiveServant } from '@/lib/portal/groups'
import { compareKidCards } from '@/lib/portal/group-cards'
import { churchToday } from '@/lib/portal/dates'
import { PageHeader, EmptyState, SectionTitle, Tabs, TabLink, Badge } from '@/components/portal/ui'
import { ClassPicker } from '@/components/portal/ClassPicker'
import { KidCard } from '@/components/portal/KidCard'
import { isFellowship } from '@/lib/portal/fellowship'
import { FollowUpLogList } from './FollowUpLogList'

export const metadata = { title: 'My Group' }

type Tab = 'mine' | 'class' | 'log'

/** Who needs a call first, the excused last (lib/portal/group-cards.ts). */
function ordered(cards: KidCardData[]): KidCardData[] {
  return [...cards].sort((a, b) =>
    compareKidCards(
      { name: a.name, excusedNow: a.excusedNow, openCase: !!a.openCase, daysSinceContact: a.lastContact?.daysAgo ?? null },
      { name: b.name, excusedNow: b.excusedNow, openCase: !!b.openCase, daysSinceContact: b.lastContact?.daysAgo ?? null },
    ),
  )
}

/**
 * Follow-up groups (2026-09-26): the children a servant follows up, and the
 * page that is about them rather than the whole class.
 *
 * Class Groups and the Follow-up log (2026-10-19): some servants are not at
 * home with the portal, so anybody serving the class can open every group and
 * follow up on a colleague's behalf — the call is logged as theirs, for that
 * colleague's group — and the log shows who followed up on whom.
 */
export default async function MyGroupPage({ searchParams }: { searchParams: { tab?: string; class?: string } }) {
  const user = await requirePortalUser()
  if (user.role === 'STUDENT') notFound()
  await ensureInitialSplits().catch((err) => console.error('Initial group split failed:', err))
  const today = churchToday()

  // The classes this person follows up, their own first. Class Groups and the
  // log are about one of them at a time.
  // Fellowship meetings split their members into groups too (2026-10-24).
  const visible = await listVisibleClasses(user, { fellowship: 'include' })
  const followable = visible
    .filter((c) => can(user, 'followup.write', { classId: c.id, classStage: c.stage }))
    .sort((a, b) => Number(user.classIds.includes(b.id)) - Number(user.classIds.includes(a.id)))
  const hasGroup = !!user.servantId && user.classIds.length > 0
  const tab: Tab = searchParams.tab === 'log' ? 'log' : searchParams.tab === 'class' || !hasGroup ? 'class' : 'mine'
  const chosen = followable.find((c) => c.id === searchParams.class) ?? followable[0] ?? null

  const href = (t: Tab, classId?: string | null) => {
    const q = new URLSearchParams()
    if (t !== 'mine') q.set('tab', t)
    if (t !== 'mine' && classId) q.set('class', classId)
    const s = q.toString()
    return s ? `/portal/my-group?${s}` : '/portal/my-group'
  }

  const header = (subtitle: string) => (
    <>
      <PageHeader title="My Group" icon={<UsersRound className="h-5 w-5" aria-hidden />} subtitle={subtitle} />
      <Tabs>
        {hasGroup && (
          <TabLink href={href('mine')} active={tab === 'mine'}>
            My Group
          </TabLink>
        )}
        <TabLink href={href('class', chosen?.id)} active={tab === 'class'}>
          Class Groups
        </TabLink>
        <TabLink href={href('log', chosen?.id)} active={tab === 'log'}>
          Follow-up log
        </TabLink>
      </Tabs>
    </>
  )

  const classPicker =
    followable.length > 1 && chosen ? (
      <div className="mb-4">
        <ClassPicker
          value={chosen.id}
          options={followable.map((c) => ({ id: c.id, name: c.name }))}
          allowAll={false}
          keep={{ tab }}
        />
      </div>
    ) : null

  /* ── Follow-up log ─────────────────────────────────────────────────────── */
  if (tab === 'log') {
    return (
      <>
        {header('Who followed up on whom: every call, text and visit, with who made it')}
        {!chosen ? (
          <EmptyState title="No class to show" hint="The log belongs to a class; once you serve one, its follow-ups show here." />
        ) : (
          <>
            {classPicker}
            <FollowUpLogList classId={chosen.id} className={chosen.name} />
          </>
        )}
      </>
    )
  }

  /* ── Class Groups ──────────────────────────────────────────────────────── */
  if (tab === 'class') {
    if (!chosen) {
      return (
        <>
          {header('Every group in your class')}
          <EmptyState title="No class to show" hint="Groups belong to the servants of a class. Once you serve one, its groups show here." />
        </>
      )
    }
    const [g] = await loadClassGroups([chosen.id])
    const kids = g?.kids ?? []
    const cards = await loadKidCards(kids.map((k) => ({ id: k.id, name: k.name, classId: chosen.id })), today)
    const active = new Set((g?.servants ?? []).map((s) => s.id))
    const byServant = new Map<string, KidCardData[]>()
    const unassigned: KidCardData[] = []
    for (const k of kids) {
      const card = cards.get(k.id)
      if (!card) continue
      const owner = effectiveServant(k.groupServantId, active)
      if (owner) byServant.set(owner, [...(byServant.get(owner) ?? []), card])
      else unassigned.push(card)
    }
    // Their own group first, then everybody else's in name order.
    const servants = [...(g?.servants ?? [])].sort(
      (a, b) => Number(b.id === user.servantId) - Number(a.id === user.servantId) || a.name.localeCompare(b.name),
    )
    const members = await prisma.classMember.count({ where: { classId: chosen.id } })
    const excused = Array.from(cards.values()).filter((c) => c.excusedNow).length
    // A Fellowship meeting's people are members (2026-10-24).
    const meeting = isFellowship(chosen.stage)
    const one = meeting ? 'member' : 'child'
    const many = meeting ? 'members' : 'children'
    return (
      <>
        {header(`${chosen.name} · every group, so anyone can follow up on a colleague's behalf`)}
        {classPicker}
        <p className="mb-4 rounded-[12px] border border-parch-200 bg-parch-50 px-4 py-2.5 text-[12px] text-parch-700">
          Log a call or text for any {one} here. It is recorded as yours, for their servant&rsquo;s group, and shows on the{' '}
          <Link href={href('log', chosen.id)} className="font-bold text-brand-800 underline decoration-brand-gold underline-offset-2">
            Follow-up log
          </Link>
          .{excused > 0 ? ` ${excused} ${excused === 1 ? `${one} is` : `${many} are`} excused from follow-up for now.` : ''}
        </p>
        {kids.length === 0 ? (
          <EmptyState title={`No ${many} in ${chosen.name} yet`} />
        ) : (
          <div className="space-y-6" data-testid="class-groups">
            {servants.map((s) => {
              const mine = ordered(byServant.get(s.id) ?? [])
              return (
                <section key={s.id} data-testid="class-group" data-servant={s.id}>
                  <SectionTitle hint={`${mine.length} ${mine.length === 1 ? one : many}`}>
                    {s.name}
                    {s.id === user.servantId ? ' (you)' : ''}
                  </SectionTitle>
                  {mine.length === 0 ? (
                    <p className="text-[12px] text-parch-500">No {many} in this group yet.</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
                      {mine.map((card) => (
                        <KidCard key={card.id} card={card} today={today} canWrite />
                      ))}
                    </div>
                  )}
                </section>
              )
            })}
            {unassigned.length > 0 && (
              <section data-testid="class-group-unassigned">
                <SectionTitle hint={<Badge tone="warn">{unassigned.length}</Badge>}>No servant yet</SectionTitle>
                <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
                  {ordered(unassigned).map((card) => (
                    <KidCard key={card.id} card={card} today={today} canWrite />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
        {members > 0 && (
          <p className="mt-5 text-[12px] text-parch-600">
            {meeting
              ? `${members} ${members === 1 ? 'member is' : 'members are'} here from another Fellowship meeting; their groups are in that meeting.`
              : `${members} ${members === 1 ? 'child joins' : 'children join'} ${chosen.name} from their own class; their groups are in that class.`}{' '}
            <Link href={`/portal/classes/${chosen.id}`} className="font-bold text-brand-800 underline decoration-brand-gold underline-offset-2">
              See the roster
            </Link>
          </p>
        )}
      </>
    )
  }

  /* ── My Group ──────────────────────────────────────────────────────────── */
  const groups = await loadClassGroups(user.classIds)
  const mineByClass = groups.map((g) => {
    const active = new Set(g.servants.map((s) => s.id))
    return {
      ...g,
      mine: g.kids.filter((k) => effectiveServant(k.groupServantId, active) === user.servantId),
      unassigned: g.kids.filter((k) => effectiveServant(k.groupServantId, active) === null).length,
    }
  })
  const kidCount = mineByClass.reduce((n, g) => n + g.mine.length, 0)
  // Someone who follows up only Fellowship members (2026-10-24) reads about
  // people and meetings, not children and Sundays.
  const onlyMeetings = mineByClass.length > 0 && mineByClass.every((g) => isFellowship(g.stage))
  const subtitle = onlyMeetings
    ? kidCount
      ? `${kidCount} member${kidCount === 1 ? '' : 's'} you follow up · call, check in, and keep an eye on the meetings`
      : 'The members you follow up'
    : kidCount
      ? `${kidCount} child${kidCount === 1 ? '' : 'ren'} you follow up · call, check in, and keep an eye on the Sundays`
      : 'The children you follow up'

  if (kidCount === 0) {
    return (
      <>
        {header(subtitle)}
        <EmptyState
          title="You don't have a group yet"
          hint={
            onlyMeetings
              ? 'Your meeting has not been split yet, or its coordinators have not given you anyone. You can still follow up any member from Class Groups.'
              : 'Your class has not been split yet, or its coordinators have not given you any children. You can still follow up any child of your class from Class Groups.'
          }
        />
      </>
    )
  }

  const cards = await loadKidCards(
    mineByClass.flatMap((g) => g.mine.map((k) => ({ id: k.id, name: k.name, classId: g.classId }))),
    today,
  )
  return (
    <>
      {header(subtitle)}
      <div className="space-y-6">
        {mineByClass
          .filter((g) => g.mine.length > 0)
          .map((g) => (
            <section key={g.classId} data-testid="my-group-class">
              <SectionTitle hint={`${g.mine.length} of ${g.kids.length} in the ${isFellowship(g.stage) ? 'meeting' : 'class'}`}>
                <Link href={`/portal/classes/${g.classId}`} className="hover:text-brand-800">
                  {g.name}
                </Link>
              </SectionTitle>
              {g.unassigned > 0 && (
                <p className="mb-3 text-[12px] text-[#D97706]">
                  {isFellowship(g.stage)
                    ? `${g.unassigned} ${g.unassigned === 1 ? 'member of this meeting has' : 'members of this meeting have'} no servant yet; your coordinators place them from the meeting's page.`
                    : `${g.unassigned} ${g.unassigned === 1 ? 'child in this class has' : 'children in this class have'} no servant yet; your coordinators place them from the class page.`}
                </p>
              )}
              <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
                {ordered(g.mine.map((k) => cards.get(k.id)).filter((c): c is KidCardData => !!c)).map((card) => (
                  <KidCard key={card.id} card={card} today={today} canWrite />
                ))}
              </div>
            </section>
          ))}
      </div>
    </>
  )
}

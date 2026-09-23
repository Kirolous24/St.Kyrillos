import Link from 'next/link'
import { UserCog, UserPlus, Search } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '@/lib/portal/session'
import { notFound } from 'next/navigation'
import { PageHeader, Badge, LinkButton, Avatar, EmptyState, Card as Panel, inputClass, buttonClass } from '@/components/portal/ui'
import { ROLE_LABEL, TITLE_LABEL, STAGE_LABEL, academicYearLabel } from '@/lib/portal/format'
import { accentFor } from '@/lib/portal/accents'
import { todayInNewYork } from '@/lib/portal/dates'
import { PrintButton } from '@/components/portal/PrintButton'
import { ReportLetterhead } from '../../reports/ReportLetterhead'
import { formatPhone } from '@/lib/portal/phones'

export const metadata = { title: 'Servants' }

const STAGE_ORDER = ['ELEMENTARY', 'MIDDLE_SCHOOL', 'HIGH_SCHOOL'] as const

type Card = {
  id: string
  displayName: string
  photo: string | null
  loginId: string
  phone: string | null
  isActive: boolean
  role: 'SERVANT' | 'ADMIN' | 'PASTOR' | 'STUDENT'
  stageOversight: 'ELEMENTARY' | 'MIDDLE_SCHOOL' | 'HIGH_SCHOOL' | null
  title: 'COORDINATOR' | 'ASSISTANT_COORDINATOR' | null
}

export default async function AdminServantsPage({ searchParams }: { searchParams: { q?: string } }) {
  const user = await requirePortalUser()
  // The pastor reads this roster (see PASTOR_READABLE_ADMIN in lib/auth.config.ts)
  // but writes nothing: every add/edit control below is admin-only.
  if (user.role !== 'ADMIN' && user.role !== 'PASTOR') notFound()
  const canManage = user.role === 'ADMIN'

  // The students page has had a search box since the port; servants never got
  // one, so finding a person among 82 accounts meant scrolling every class group.
  const q = (searchParams.q ?? '').trim()

  const accounts = await prisma.account.findMany({
    where: {
      role: { in: ['SERVANT', 'ADMIN', 'PASTOR'] },
      ...(q
        ? {
            OR: [
              { displayName: { contains: q, mode: 'insensitive' as const } },
              { loginId: { contains: q } },
              { email: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    },
    orderBy: [{ role: 'asc' }, { displayName: 'asc' }],
    select: {
      id: true, displayName: true, role: true, loginId: true, phone: true, email: true, photo: true, isActive: true, lastLoginAt: true,
      servant: { select: { stageOversight: true, classes: { orderBy: { sortOrder: 'asc' }, select: { title: true, class: { select: { id: true, name: true, stage: true, sortOrder: true } } } } } },
    },
  })
  const unassigned = accounts.filter((a) => a.role === 'SERVANT' && (a.servant?.classes.length ?? 0) === 0)

  // The printed roster is built from every active class, not from servant
  // memberships: a class with nobody assigned never appears in the membership
  // map, and a class with no servants is exactly the gap an admin prints a
  // roster to find. Unfiltered by ?q for the same reason — a filtered sheet
  // looks complete.
  const allClasses = await prisma.schoolClass.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, stage: true },
  })
  const rosterAll = await prisma.account.findMany({
    where: { role: { in: ['SERVANT', 'ADMIN', 'PASTOR'] } },
    orderBy: [{ role: 'asc' }, { displayName: 'asc' }],
    select: {
      displayName: true,
      loginId: true,
      phone: true,
      role: true,
      isActive: true,
      servant: { select: { classes: { orderBy: { sortOrder: 'asc' }, select: { title: true, classId: true } } } },
    },
  })

  const toCard = (a: (typeof accounts)[number], title: Card['title']): Card => ({
    id: a.id,
    displayName: a.displayName,
    photo: a.photo,
    loginId: a.loginId,
    phone: a.phone,
    isActive: a.isActive,
    role: a.role,
    stageOversight: a.servant?.stageOversight ?? null,
    title,
  })

  // Group by class, then by that class's stage — as the prototype does.
  const classGroups = new Map<string, { id: string; name: string; stage: string; sortOrder: number; members: Card[] }>()
  for (const a of accounts) {
    for (const m of a.servant?.classes ?? []) {
      const g = classGroups.get(m.class.id) ?? { id: m.class.id, name: m.class.name, stage: m.class.stage as string, sortOrder: m.class.sortOrder, members: [] }
      g.members.push(toCard(a, m.title))
      classGroups.set(m.class.id, g)
    }
  }
  const ordered = Array.from(classGroups.values()).sort((x, y) => x.sortOrder - y.sortOrder || x.name.localeCompare(y.name))
  const leadership = accounts.filter((a) => a.role !== 'SERVANT').map((a) => toCard(a, null))

  return (
    <div className="portal-print-page">
      <PageHeader
        title="Servants"
        subtitle={`${accounts.length} accounts${unassigned.length ? ` · ${unassigned.length} without a class` : ''}`}
        icon={<UserCog className="h-5 w-5" />}
        actions={
          <>
            {/* Printing is read-only, so the pastor gets it too — they are the
                role that prints. Only Add servant is admin-gated. */}
            <PrintButton label="Print roster" />
            {canManage && (
              <>
                {/* F0812 — the prototype's Servants toolbar carried Import CSV
                    and Export. Both moved to Data & Backup and nothing here said
                    where they went, so an admin holding a term's new servants in
                    a spreadsheet had no route to the importer from the page they
                    were standing on. Inside the admin gate on purpose:
                    /portal/admin/data calls notFound() for anyone but ADMIN, and
                    the pastor can read this roster. */}
                <LinkButton href="/portal/admin/data" variant="secondary">
                  Import / export CSV
                </LinkButton>
                <LinkButton href="/portal/admin/servants/new"><UserPlus className="h-[13px] w-[13px]" /> Add servant</LinkButton>
              </>
            )}
          </>
        }
      />

      <ReportLetterhead title="Sunday School servant roster" period={academicYearLabel(todayInNewYork())} />

      {/* The on-screen groups are collapsed <details>, which print collapsed —
          there is no reliable way to force one open for print — so the sheet is
          its own plain markup. */}
      <div className="hidden print:block">
        {allClasses.map((c) => {
          const members = rosterAll.filter((a) => (a.servant?.classes ?? []).some((m) => m.classId === c.id))
          return (
            <section key={`print-${c.id}`} className="mb-3 break-inside-avoid">
              <h2 className="mb-1 border-b border-parch-300 pb-0.5 font-serif text-[12.5px] font-bold text-brand-950">
                {c.name}
                <span className="ml-2 text-[10.5px] font-semibold text-parch-500">{STAGE_LABEL[c.stage as keyof typeof STAGE_LABEL]}</span>
              </h2>
              {members.length === 0 ? (
                <p className="text-[10.5px] italic text-[#B91C1C]">No servants assigned</p>
              ) : (
                <ul className="text-[10.5px]">
                  {members.map((a) => {
                    const title = (a.servant?.classes ?? []).find((m) => m.classId === c.id)?.title
                    return (
                      <li key={`${c.id}-${a.loginId}`} className="flex justify-between gap-3 border-b border-parch-200 py-0.5">
                        <span>
                          {a.displayName}
                          {title ? ` — ${TITLE_LABEL[title]}` : ''}
                          {!a.isActive ? ' (inactive)' : ''}
                        </span>
                        <span className="shrink-0 tabular-nums text-parch-600">
                          ID {a.loginId}{a.phone ? ` · ${formatPhone(a.phone)}` : ''}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          )
        })}
        {(() => {
          const noClass = rosterAll.filter((a) => a.role === 'SERVANT' && (a.servant?.classes.length ?? 0) === 0)
          if (noClass.length === 0) return null
          return (
            <section className="mb-3 break-inside-avoid">
              <h2 className="mb-1 border-b border-parch-300 pb-0.5 font-serif text-[12.5px] font-bold text-brand-950">
                Awaiting a class
              </h2>
              <ul className="text-[10.5px]">
                {noClass.map((a) => (
                  <li key={`none-${a.loginId}`} className="flex justify-between gap-3 border-b border-parch-200 py-0.5">
                    <span>{a.displayName}{!a.isActive ? ' (inactive)' : ''}</span>
                    <span className="shrink-0 tabular-nums text-parch-600">ID {a.loginId}</span>
                  </li>
                ))}
              </ul>
            </section>
          )
        })()}
        <p className="mt-2 border-t border-parch-300 pt-1 text-[10px] text-parch-500">
          {allClasses.length} classes · {rosterAll.length} servant and staff accounts
        </p>
      </div>

      <Panel bodyClassName="p-3.5" className="mb-4 print:hidden">
        <form className="flex items-end gap-2">
          <label className="block w-full max-w-sm">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">Search</span>
            <input name="q" defaultValue={q} className={inputClass} placeholder="Name, ID or email" />
          </label>
          <button type="submit" className={buttonClass('secondary')}>
            <Search className="h-[13px] w-[13px]" /> Search
          </button>
          {q && (
            <Link href="/portal/admin/servants" className={buttonClass('secondary')}>
              Clear
            </Link>
          )}
        </form>
      </Panel>

      {accounts.length === 0 ? (
        <div className="print:hidden"><EmptyState title={q ? `No servants match “${q}”` : 'No servant accounts yet'} hint={q ? 'Try a different name, ID or email.' : 'Add your first servant to get started.'} action={canManage ? <LinkButton href="/portal/admin/servants/new">Add servant</LinkButton> : undefined} /></div>
      ) : (
        <div className="space-y-3.5 print:hidden">
          {STAGE_ORDER.map((stage) => {
            const stageGroups = ordered.filter((g) => g.stage === stage)
            if (stageGroups.length === 0) return null
            const totalServants = stageGroups.reduce((n, g) => n + g.members.length, 0)
            return (
              <StageSection
                key={stage}
                title={STAGE_LABEL[stage]}
                hint={`${stageGroups.length} class${stageGroups.length === 1 ? '' : 'es'} · ${totalServants} servant${totalServants === 1 ? '' : 's'}`}
                grid
              >
                {stageGroups.map((g) => (
                  <ServantGroup key={g.id} label={g.name} accent={accentFor(g.id)} members={g.members} canManage={canManage} />
                ))}
              </StageSection>
            )
          })}

          {leadership.length > 0 && (
            <StageSection title="Leadership" hint={`${leadership.length} account${leadership.length === 1 ? '' : 's'}`}>
              <ServantGroup label="Admins & pastors" accent="#6F1D1B" members={leadership} defaultOpen canManage={canManage} />
            </StageSection>
          )}

          {unassigned.length > 0 && (
            <StageSection title="No class assigned" hint={`${unassigned.length} servant${unassigned.length === 1 ? '' : 's'}`}>
              <ServantGroup label="Awaiting a class" accent="#7C7A7A" members={unassigned.map((a) => toCard(a, null))} defaultOpen canManage={canManage} />
            </StageSection>
          )}
        </div>
      )}
    </div>
  )
}

// F0553 — the class groups inside a stage collapse and the stage itself never
// did, so an admin looking for one high-school servant scrolled past every
// elementary class to reach them. Open by default, so nothing a person sees
// today disappears on them.
function StageSection({ title, hint, children, grid }: { title: string; hint: string; children: React.ReactNode; grid?: boolean }) {
  return (
    <details open className="overflow-hidden rounded-[14px] border-[1.5px] border-[#EFE9DC] bg-parch-50 shadow-panel">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-[18px] pb-3 pt-4">
        <h2 className="font-serif text-[14.5px] font-bold text-brand-800">
          {title}
          <span className="mt-0.5 block text-[10.5px] font-semibold text-brand-gold-dark">{hint}</span>
        </h2>
        <span aria-hidden className="shrink-0 text-[13px] text-parch-500">▾</span>
      </summary>
      <div className={grid ? 'grid gap-3 border-t border-[#F0EBE3] p-4 sm:grid-cols-[repeat(auto-fit,minmax(230px,1fr))]' : 'border-t border-[#F0EBE3] p-4'}>
        {children}
      </div>
    </details>
  )
}

function ServantGroup({ label, accent, members, defaultOpen, canManage }: { label: string; accent: string; members: Card[]; defaultOpen?: boolean; canManage: boolean }) {
  return (
    <details open={defaultOpen} className="overflow-hidden rounded-[10px] border border-[#EFE9DC] bg-[#FDFBF7]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3.5 py-3">
        <span className="flex items-center gap-2">
          <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: accent }} />
          <span>
            <span className="block text-[13px] font-bold text-parch-900">{label}</span>
            <span className="mt-0.5 block text-[10.5px] font-semibold text-brand-gold-dark">
              {members.length} servant{members.length === 1 ? '' : 's'}
            </span>
          </span>
        </span>
        <span aria-hidden className="shrink-0 text-[13px] text-parch-500">▾</span>
      </summary>
      <div className="grid grid-cols-2 gap-2.5 border-t border-[#F0EBE3] p-3 sm:grid-cols-[repeat(auto-fill,minmax(150px,1fr))]">
        {members.map((a) => {
          // The card opens an edit screen, which is admin-only. For the pastor,
          // who reads this roster but manages nobody, it stays a plain tile —
          // a link into a 404 is exactly what this restoration is undoing.
          const tileClass = 'rounded-[12px] border border-[#EFE9DC] bg-parch-50 px-3.5 pb-3 pt-4 text-center'
          const body = (
            <>
            <span className="mx-auto mb-2.5 block w-fit">
              <Avatar name={a.displayName} photo={a.photo} size="lg" />
            </span>
            <span className="block truncate text-[13px] font-bold text-parch-900">{a.displayName}</span>
            <span className="mt-1.5 flex flex-wrap justify-center gap-1">
              {a.title && <Badge tone="gold">{TITLE_LABEL[a.title]}</Badge>}
              {a.role !== 'SERVANT' && a.role !== 'STUDENT' && <Badge tone="brand">{ROLE_LABEL[a.role]}</Badge>}
              {a.stageOversight && <Badge tone="brand">{STAGE_LABEL[a.stageOversight]} coordinator</Badge>}
              {!a.isActive && <Badge tone="bad">Inactive</Badge>}
            </span>
            <span className="mt-1.5 block truncate text-[11px] text-parch-500">
              ID {a.loginId}{a.phone ? ` · ${formatPhone(a.phone)}` : ''}
            </span>
          </>
          )
          return canManage ? (
            <Link key={a.id} href={`/portal/admin/servants/${a.id}`} className={`${tileClass} transition-shadow hover:shadow-card`}>
              {body}
            </Link>
          ) : (
            <div key={a.id} className={tileClass}>{body}</div>
          )
        })}
      </div>
    </details>
  )
}

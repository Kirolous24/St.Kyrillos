import Link from 'next/link'
import { UserCog, UserPlus } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '@/lib/portal/session'
import { notFound } from 'next/navigation'
import { PageHeader, Badge, LinkButton, Avatar, EmptyState } from '@/components/portal/ui'
import { ROLE_LABEL, TITLE_LABEL, STAGE_LABEL } from '@/lib/portal/format'
import { accentFor } from '@/lib/portal/accents'
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

export default async function AdminServantsPage() {
  const user = await requirePortalUser()
  if (user.role !== 'ADMIN') notFound()

  const accounts = await prisma.account.findMany({
    where: { role: { in: ['SERVANT', 'ADMIN', 'PASTOR'] } },
    orderBy: [{ role: 'asc' }, { displayName: 'asc' }],
    select: {
      id: true, displayName: true, role: true, loginId: true, phone: true, email: true, photo: true, isActive: true, lastLoginAt: true,
      servant: { select: { stageOversight: true, classes: { orderBy: { sortOrder: 'asc' }, select: { title: true, class: { select: { id: true, name: true, stage: true, sortOrder: true } } } } } },
    },
  })
  const unassigned = accounts.filter((a) => a.role === 'SERVANT' && (a.servant?.classes.length ?? 0) === 0)

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
    <>
      <PageHeader
        title="Servants"
        subtitle={`${accounts.length} accounts${unassigned.length ? ` · ${unassigned.length} without a class` : ''}`}
        icon={<UserCog className="h-5 w-5" />}
        actions={<LinkButton href="/portal/admin/servants/new"><UserPlus className="h-[13px] w-[13px]" /> Add servant</LinkButton>}
      />

      {accounts.length === 0 ? (
        <EmptyState title="No servant accounts yet" hint="Add your first servant to get started." action={<LinkButton href="/portal/admin/servants/new">Add servant</LinkButton>} />
      ) : (
        <div className="space-y-3.5">
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
                  <ServantGroup key={g.id} label={g.name} accent={accentFor(g.id)} members={g.members} />
                ))}
              </StageSection>
            )
          })}

          {leadership.length > 0 && (
            <StageSection title="Leadership" hint={`${leadership.length} account${leadership.length === 1 ? '' : 's'}`}>
              <ServantGroup label="Admins & pastors" accent="#6F1D1B" members={leadership} defaultOpen />
            </StageSection>
          )}

          {unassigned.length > 0 && (
            <StageSection title="No class assigned" hint={`${unassigned.length} servant${unassigned.length === 1 ? '' : 's'}`}>
              <ServantGroup label="Awaiting a class" accent="#7C7A7A" members={unassigned.map((a) => toCard(a, null))} defaultOpen />
            </StageSection>
          )}
        </div>
      )}
    </>
  )
}

function StageSection({ title, hint, children, grid }: { title: string; hint: string; children: React.ReactNode; grid?: boolean }) {
  return (
    <section className="overflow-hidden rounded-[14px] border-[1.5px] border-[#EFE9DC] bg-parch-50 shadow-panel">
      <header className="px-[18px] pb-3 pt-4">
        <h2 className="font-serif text-[14.5px] font-bold text-brand-800">{title}</h2>
        <p className="mt-0.5 text-[10.5px] font-semibold text-brand-gold-dark">{hint}</p>
      </header>
      <div className={grid ? 'grid gap-3 border-t border-[#F0EBE3] p-4 sm:grid-cols-[repeat(auto-fit,minmax(230px,1fr))]' : 'border-t border-[#F0EBE3] p-4'}>
        {children}
      </div>
    </section>
  )
}

function ServantGroup({ label, accent, members, defaultOpen }: { label: string; accent: string; members: Card[]; defaultOpen?: boolean }) {
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
        {members.map((a) => (
          <Link
            key={a.id}
            href={`/portal/admin/servants/${a.id}`}
            className="rounded-[12px] border border-[#EFE9DC] bg-parch-50 px-3.5 pb-3 pt-4 text-center transition-shadow hover:shadow-card"
          >
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
          </Link>
        ))}
      </div>
    </details>
  )
}

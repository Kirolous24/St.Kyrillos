import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Phone, UserX } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '@/lib/portal/session'
import { listUnassigned, unassignedWhere, type UnassignedChild } from '@/lib/portal/data/unassigned'
import { ageOn, todayInNewYork } from '@/lib/portal/dates'
import { formatDateTime } from '@/lib/portal/format'
import { formatPhone } from '@/lib/portal/phones'
import { PageHeader, Card, EmptyState } from '@/components/portal/ui'
import { UnassignedActions } from './UnassignedActions'

export const metadata = { title: 'Unassigned' }

/**
 * UNASSIGNED (2026-09-26): children a servant took off their class, with the
 * reason they gave, waiting for the class Coordinator, the stage overseer or
 * the admin to put them back, move them or delete them for good. Everyone else
 * gets a 404: the list names children and their parents' numbers.
 */
export default async function UnassignedPage() {
  const user = await requirePortalUser()
  if (!(await unassignedWhere(user))) notFound()

  const [children, classes] = await Promise.all([
    listUnassigned(user),
    prisma.schoolClass.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true },
    }),
  ])
  const today = todayInNewYork()
  const isAdmin = user.role === 'ADMIN'

  return (
    <>
      <PageHeader
        title="Unassigned children"
        icon={<UserX className="h-5 w-5" aria-hidden />}
        subtitle={children.length ? `${children.length} waiting for a decision` : 'Nobody is waiting'}
      />
      <p className="mb-4 max-w-2xl text-[12.5px] text-parch-600">
        A servant took these children off their class and said why. Put each one back, move them to another class, or
        delete them for good. Until then their attendance, points and quizzes are kept.
      </p>

      {children.length === 0 ? (
        <EmptyState title="No children are waiting" hint="When a servant unassigns a child from their class, the child appears here." />
      ) : (
        <ul className="space-y-3">
          {children.map((c) => (
            <li key={c.id}>
              <ChildCard child={c} today={today} isAdmin={isAdmin} classes={classes} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function ChildCard({
  child: c,
  today,
  isAdmin,
  classes,
}: {
  child: UnassignedChild
  today: string
  isAdmin: boolean
  classes: Array<{ id: string; name: string }>
}) {
  const facts = [
    c.grade ? `Grade ${c.grade}` : null,
    c.dob ? `${ageOn(c.dob, today)} years old` : null,
    c.gender,
    `ID ${c.loginId}`,
  ].filter(Boolean)
  const parents = [
    { who: 'Father', name: c.fatherName, phone: c.fatherPhone },
    { who: 'Mother', name: c.motherName, phone: c.motherPhone },
  ].filter((p) => p.name || p.phone)

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-[6px] bg-[#FEE2E2] px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-[0.8px] text-[#DC2626]">
          Unassigned
        </span>
        {isAdmin ? (
          <Link href={`/portal/students/${c.id}`} className="font-serif text-[15px] font-bold text-brand-900 underline-offset-4 hover:underline">
            {c.name}
          </Link>
        ) : (
          <span className="font-serif text-[15px] font-bold text-brand-900">{c.name}</span>
        )}
      </div>
      <p className="mt-1 text-[12px] text-parch-600">{facts.join(' · ')}</p>

      {parents.length > 0 && (
        <ul className="mt-2 space-y-1 text-[12.5px] text-parch-800">
          {parents.map((p) => (
            <li key={p.who} className="flex flex-wrap items-center gap-x-2">
              <span className="font-semibold">{p.who}:</span>
              {p.name && <span>{p.name}</span>}
              {p.phone && (
                <a href={`tel:${p.phone}`} className="inline-flex items-center gap-1 font-semibold text-brand-800 underline-offset-4 hover:underline">
                  <Phone className="h-3.5 w-3.5" aria-hidden /> {formatPhone(p.phone)}
                </a>
              )}
            </li>
          ))}
        </ul>
      )}

      <dl className="mt-3 grid gap-x-6 gap-y-1 text-[12.5px] sm:grid-cols-2">
        <div>
          <dt className="text-[10.5px] font-bold uppercase tracking-[0.8px] text-parch-500">Came from</dt>
          <dd className="font-semibold text-parch-900">
            {c.fromClassName ?? (c.fromClassId ? 'A class that no longer exists' : 'No class on record')}
            {c.fromClassName && !c.fromClassActive ? ' (no longer active)' : ''}
          </dd>
        </div>
        <div>
          <dt className="text-[10.5px] font-bold uppercase tracking-[0.8px] text-parch-500">Unassigned by</dt>
          <dd className="font-semibold text-parch-900">
            {c.at ? `${c.byName ?? 'A former servant'} · ${formatDateTime(new Date(c.at))}` : 'Not recorded'}
          </dd>
        </div>
      </dl>

      <blockquote className="mt-3 rounded-[10px] border-l-[3px] border-[#DC2626] bg-[#FEF2F2] px-3.5 py-2.5 text-[12.5px] text-parch-900">
        {c.reason ?? <span className="text-parch-500">No reason recorded.</span>}
      </blockquote>

      <UnassignedActions
        studentId={c.id}
        name={c.name}
        putBackTo={c.fromClassId && c.fromClassActive ? c.fromClassName : null}
        classes={classes.filter((k) => k.id !== c.fromClassId)}
      />
    </Card>
  )
}

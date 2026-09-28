'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Search, UserPlus, Users } from 'lucide-react'
import { addClassMember, findChildrenToAdd, removeClassMember } from '@/lib/portal/actions/class-members'
import { Card, Callout, buttonClass, inputClass } from '@/components/portal/ui'
import { cn } from '@/lib/utils'

type Found = { id: string; name: string; loginId: string; className: string | null }

/**
 * Children from other classes in a class that takes them (2026-09-28), such as
 * Pre-Servants. They stay in their own class; adding and taking out only
 * changes whether they are in this one.
 */
export function MembersPanel({
  classId,
  classLabel,
  members,
}: {
  classId: string
  classLabel: string
  members: Array<{ id: string; name: string; homeClass: string | null }>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<Found[] | null>(null)
  const [error, setError] = useState('')

  function search(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    startTransition(async () => {
      const r = await findChildrenToAdd({ classId, query })
      if (!r.ok) return setError(r.error)
      setFound(r.data ?? [])
    })
  }

  function add(child: Found) {
    setError('')
    startTransition(async () => {
      const r = await addClassMember({ classId, studentId: child.id })
      if (!r.ok) return setError(r.error)
      setFound((prev) => prev?.filter((f) => f.id !== child.id) ?? null)
      router.refresh()
    })
  }

  function takeOut(member: { id: string; name: string; homeClass: string | null }) {
    if (!window.confirm(`Take ${member.name} out of ${classLabel}? They stay in ${member.homeClass ?? 'their own class'}.`)) return
    setError('')
    startTransition(async () => {
      const r = await removeClassMember({ classId, studentId: member.id })
      if (!r.ok) return setError(r.error)
      router.refresh()
    })
  }

  return (
    <Card title="Children from other classes" icon={<Users className="h-[15px] w-[15px]" />}>
      <div id="members" className="-mt-1 mb-3 text-[12px] text-parch-600">
        They stay in their own class and also come to {classLabel}: its own meeting, points, quizzes and follow-ups.
      </div>
      <form onSubmit={search} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name or 4-digit ID"
          aria-label="Find a child to add"
          className={cn(inputClass, 'min-w-0 flex-1')}
          maxLength={60}
        />
        <button type="submit" disabled={pending || query.trim().length < 2} className={cn(buttonClass('secondary', 'sm'), 'min-h-[40px]')}>
          <Search className="h-3.5 w-3.5" aria-hidden /> Find
        </button>
      </form>
      {found && (
        <ul className="mt-2.5 space-y-1.5" aria-label="Children found">
          {found.length === 0 && <li className="text-[12px] text-parch-500">Nobody found who isn&rsquo;t already here.</li>}
          {found.map((f) => (
            <li key={f.id} className="flex items-center gap-2 rounded-[10px] border border-parch-200 bg-parch-50 px-2.5 py-1.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-semibold text-parch-900">{f.name}</span>
                <span className="block text-[11px] text-parch-500">{f.className ?? 'No class'} · ID {f.loginId}</span>
              </span>
              <button type="button" disabled={pending} onClick={() => add(f)} className={cn(buttonClass('primary', 'sm'), 'min-h-[36px]')}>
                <UserPlus className="h-3.5 w-3.5" aria-hidden /> Add
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <div className="mt-2.5" role="alert"><Callout tone="bad">{error}</Callout></div>}
      <div className="mt-3.5 border-t border-[#F5F2ED] pt-3">
        {members.length === 0 ? (
          <p className="text-[12px] text-parch-500">No children from other classes yet. Find them above, or import the class list.</p>
        ) : (
          <ul className="space-y-1.5" aria-label={`Children from other classes in ${classLabel}`}>
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-semibold text-parch-900">{m.name}</span>
                  <span className="block text-[11px] text-parch-500">Also in {m.homeClass ?? 'no class'}</span>
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => takeOut(m)}
                  aria-label={`Take ${m.name} out of ${classLabel}`}
                  className={cn(buttonClass('ghost', 'sm'), 'min-h-[36px] text-[#B91C1C]')}
                >
                  Take out
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}

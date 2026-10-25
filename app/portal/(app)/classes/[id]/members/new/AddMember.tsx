'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from '@/components/portal/Link'
import { Search, UserPlus, CheckCircle2, Upload } from 'lucide-react'
import { addNewMember, addPersonToMeeting, searchPeopleToAdd, type MemberFormInput } from '@/lib/portal/actions/fellowship'
import type { Addable } from '@/lib/portal/fellowship'
import { Card, Callout, Badge, buttonClass, inputClass } from '@/components/portal/ui'
import { MemberForm, EMPTY_MEMBER, type MemberFields } from '@/components/portal/MemberForm'
import { cn } from '@/lib/utils'

/**
 * Add member (2026-10-24). The user's one emphasis: make it easy for the
 * servants. So the page stays open for the next person, finds anyone already
 * in the portal by the start of a name, and asks before making the same person
 * twice.
 */
export function AddMember({ classId, meetingName }: { classId: string; meetingName: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Addable[] | null>(null)
  const [added, setAdded] = useState<Array<{ id: string; name: string; note?: string }>>([])
  const [error, setError] = useState('')
  const [matches, setMatches] = useState<{ fields: MemberFields; people: Addable[] } | null>(null)
  const [resetKey, setResetKey] = useState(0)
  // What they typed, kept while the same-person question is open.
  const [draft, setDraft] = useState<MemberFields>(EMPTY_MEMBER)
  const searchSeq = useRef(0)

  // Search as they type, a beat after they stop.
  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) {
      setResults(null)
      return
    }
    const seq = ++searchSeq.current
    const t = window.setTimeout(async () => {
      const r = await searchPeopleToAdd(classId, term)
      if (seq !== searchSeq.current) return
      if (!r.ok) return setError(r.error)
      setResults(r.data!)
    }, 250)
    return () => window.clearTimeout(t)
  }, [q, classId])

  function done(id: string, name: string, note?: string) {
    setAdded((a) => [{ id, name, note }, ...a.filter((x) => x.id !== id)])
    router.refresh()
  }

  function addExisting(p: Addable) {
    setError('')
    startTransition(async () => {
      const r = await addPersonToMeeting(classId, { kind: p.kind, id: p.id })
      if (!r.ok) return setError(r.error)
      done(r.data!.studentId, r.data!.name, r.data!.already ? `already in ${meetingName}` : undefined)
      setResults((rs) => rs?.map((x) => (x.id === p.id ? { ...x, blocked: 'Added' } : x)) ?? null)
      setMatches(null)
      setDraft(EMPTY_MEMBER)
      setResetKey((k) => k + 1)
    })
  }

  function addNew(fields: MemberFields, confirmNew = false) {
    setError('')
    setDraft(fields)
    const input: MemberFormInput = { ...fields }
    startTransition(async () => {
      const r = await addNewMember(classId, input, { confirmNew })
      if (!r.ok) return setError(r.error)
      if ('matches' in r.data!) return setMatches({ fields, people: r.data.matches })
      done(r.data!.added.studentId, r.data!.added.name)
      setMatches(null)
      setDraft(EMPTY_MEMBER)
      setResetKey((k) => k + 1)
    })
  }

  return (
    <div className="space-y-5">
      {added.length > 0 && (
        <div role="status" data-testid="added-list">
          <Callout tone="good" title={`Added to ${meetingName}`}>
            <ul className="mt-1 space-y-0.5">
              {added.map((a) => (
                <li key={a.id} className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <Link href={`/portal/members/${a.id}`} className="font-semibold underline decoration-dotted underline-offset-2">
                    {a.name}
                  </Link>
                  {a.note && <span className="text-parch-600">({a.note})</span>}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[12px]">
              Add the next person below, or{' '}
              <Link href={`/portal/classes/${classId}`} className="font-bold underline decoration-brand-gold underline-offset-2">
                go back to {meetingName}
              </Link>
              .
            </p>
          </Callout>
        </div>
      )}

      {error && (
        <div role="alert">
          <Callout tone="bad">{error}</Callout>
        </div>
      )}

      <Card title="Already in the portal?" icon={<Search className="h-4 w-4" aria-hidden />}>
        <p className="mb-3 text-[12px] text-parch-600">
          Servants keep their own login: find them here instead of typing them in. Someone in another Fellowship meeting
          joins this one too.
        </p>
        <label htmlFor="member-search" className="sr-only">
          Search by name
        </label>
        <input
          id="member-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className={inputClass}
          placeholder="Start typing a name…"
          autoComplete="off"
        />
        {results !== null && (
          <ul className="mt-3 divide-y divide-[#F5F2ED]" data-testid="search-results">
            {results.length === 0 ? (
              <li className="py-2 text-[12.5px] text-parch-500">Nobody by that name yet. Add them as someone new below.</li>
            ) : (
              results.map((p) => (
                <li key={`${p.kind}:${p.id}`} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <span className="min-w-0">
                    <span className="block text-[13px] font-bold text-parch-900">{p.name}</span>
                    <span className="block text-[11.5px] text-parch-500">
                      {p.where}
                      {p.phoneEnd && ` · phone ends ${p.phoneEnd}`}
                    </span>
                  </span>
                  {p.blocked ? (
                    <Badge tone="neutral">{p.blocked}</Badge>
                  ) : (
                    <button type="button" disabled={pending} onClick={() => addExisting(p)} className={cn(buttonClass('secondary', 'sm'), 'min-h-[36px]')}>
                      <UserPlus className="h-3.5 w-3.5" aria-hidden /> Add
                    </button>
                  )}
                </li>
              ))
            )}
          </ul>
        )}
      </Card>

      <Card title="Someone new" icon={<UserPlus className="h-4 w-4" aria-hidden />}>
        <p className="mb-3 text-[12px] text-parch-600">
          For someone who doesn&rsquo;t serve. They don&rsquo;t get a login; the servants mark them at the meeting, or they
          tap their name on the meeting&rsquo;s QR check-in.
        </p>
        {matches ? (
          <div data-testid="same-person">
            <Callout tone="warn" title="Is this the same person?">
              <p className="mb-2">
                {[matches.fields.firstName, matches.fields.lastName].filter(Boolean).join(' ')} may already be in the portal:
              </p>
              <ul className="space-y-2">
                {matches.people.map((p) => (
                  <li key={`${p.kind}:${p.id}`} className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      <b>{p.name}</b> · {p.where}
                      {p.phoneEnd && ` · phone ends ${p.phoneEnd}`}
                      {p.dob && ` · born ${p.dob.slice(0, 4)}`}
                    </span>
                    {p.blocked ? (
                      <Badge tone="neutral">{p.blocked}</Badge>
                    ) : (
                      <button type="button" disabled={pending} onClick={() => addExisting(p)} className={cn(buttonClass('primary', 'sm'), 'min-h-[36px]')}>
                        Yes, add them
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" disabled={pending} onClick={() => addNew(matches.fields, true)} className={cn(buttonClass('secondary', 'sm'), 'min-h-[36px]')}>
                  No, add {matches.fields.firstName} as someone new
                </button>
                <button type="button" onClick={() => setMatches(null)} className={cn(buttonClass('ghost', 'sm'), 'min-h-[36px]')}>
                  Back to the form
                </button>
              </div>
            </Callout>
          </div>
        ) : (
          <MemberForm
            key={resetKey}
            initial={draft}
            submitLabel="Add member"
            pending={pending}
            onSubmit={(fields) => addNew(fields)}
            idPrefix="new-member"
          />
        )}
      </Card>

      <Card>
        <p className="flex flex-wrap items-center gap-2 text-[12.5px] text-parch-700">
          <Upload className="h-4 w-4 text-brand-gold-dark" aria-hidden />
          Have a list already?
          <Link href={`/portal/classes/${classId}/import`} className="font-bold text-brand-800 underline decoration-brand-gold underline-offset-2">
            Import members from a spreadsheet
          </Link>
        </p>
      </Card>
    </div>
  )
}

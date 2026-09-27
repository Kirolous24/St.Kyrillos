'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Link as LinkIcon, Unlink } from 'lucide-react'
import { linkClassCurriculum, unlinkClassCurriculum } from '@/lib/portal/actions/agenda'
import { Card, Field, buttonClass, selectClass } from '@/components/portal/ui'
import { cn } from '@/lib/utils'

/**
 * A servant links their own class with another, or unlinks it (2026-09-26).
 * Linked classes can read each other's Lesson Preparation and copy weeks from
 * it; nothing else is shared. This used to be an admin-only setting that
 * granted no access at all.
 */
export function LinkedClasses({
  classId,
  className,
  links,
  canAdd,
  options,
}: {
  classId: string
  className: string
  links: Array<{ id: string; name: string }>
  /** False once this class points at another. Unlink that first to change it. */
  canAdd: boolean
  options: Array<{ id: string; name: string }>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [value, setValue] = useState('')
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  function run(action: () => ReturnType<typeof linkClassCurriculum>, ok: string) {
    setMessage(null)
    startTransition(async () => {
      const r = await action()
      if (!r.ok) return setMessage({ kind: 'err', text: r.error })
      setMessage({ kind: 'ok', text: ok })
      setValue('')
      router.refresh()
    })
  }

  return (
    <Card title="Linked classes" icon={<LinkIcon className="h-4 w-4" aria-hidden />}>
      {links.length === 0 ? (
        <p className="mb-3 text-[12.5px] text-parch-500">{className} is not linked with any class.</p>
      ) : (
        <ul className="mb-3 space-y-2">
          {links.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-2 rounded-[10px] border border-parch-200 bg-parch-50 px-3 py-2">
              <span className="text-[12.5px] font-semibold text-parch-900">{l.name}</span>
              <button
                type="button"
                disabled={pending}
                className={buttonClass('ghost', 'sm')}
                aria-label={`Unlink ${l.name}`}
                onClick={() => {
                  if (!window.confirm(`Unlink ${className} and ${l.name}? Neither class will be able to open the other's plan.`)) return
                  run(() => unlinkClassCurriculum({ classId, otherId: l.id }), `Unlinked ${l.name}.`)
                }}
              >
                <Unlink className="h-3.5 w-3.5" aria-hidden /> Unlink
              </button>
            </li>
          ))}
        </ul>
      )}

      {canAdd ? (
        <>
          <Field label="Link with" htmlFor="link-to">
            <select id="link-to" value={value} onChange={(e) => setValue(e.target.value)} className={selectClass}>
              <option value="">Choose a class…</option>
              {options.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <button
            type="button"
            disabled={pending || !value}
            className={cn(buttonClass('secondary'), 'w-full rounded-[20px]')}
            onClick={() => {
              const name = options.find((o) => o.id === value)?.name ?? 'that class'
              run(() => linkClassCurriculum({ classId, otherId: value }), `Linked ${className} with ${name}.`)
            }}
          >
            <LinkIcon className="h-4 w-4" aria-hidden /> {pending ? 'Saving…' : 'Link'}
          </button>
        </>
      ) : (
        <p className="text-[11.5px] text-parch-500">Unlink first to link {className} with a different class.</p>
      )}
      <p className="mt-2 text-[11px] text-parch-500">
        Linked classes can read each other&rsquo;s lesson prep and copy weeks from it. Nothing else is shared.
      </p>
      {message && (
        <p role="status" className={message.kind === 'ok' ? 'mt-2 text-[12px] font-semibold text-[#15803D]' : 'mt-2 text-[12px] font-semibold text-[#B91C1C]'}>
          {message.text}
        </p>
      )}
    </Card>
  )
}

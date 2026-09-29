'use client'

import { useState, useTransition } from 'react'
import Link from '@/components/portal/Link'
import { useRouter } from 'next/navigation'
import { UsersRound, Shuffle } from 'lucide-react'
import { applySplit, moveKidToGroup, previewSplit } from '@/lib/portal/actions/groups'
import type { GroupHealth } from '@/lib/portal/groups'
import { Badge, Callout, Card, buttonClass, selectClass } from '@/components/portal/ui'
import { cn } from '@/lib/utils'

type Kid = { id: string; name: string }

/**
 * Follow-up groups on the class page (2026-09-26): who follows up whom.
 *
 * Everybody in the class can see it. Only the admin, the stage overseer and the
 * class Coordinator can change it (`group.manage`), with Split evenly, which
 * names every move before anything happens, or by moving one child.
 */
export function GroupsPanel({
  canManage,
  classId,
  servants,
  unassigned,
  health,
}: {
  canManage: boolean
  classId: string
  servants: Array<{ id: string; name: string; kids: Kid[] }>
  unassigned: Kid[]
  health: GroupHealth
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [preview, setPreview] = useState<Array<{ kid: string; from: string | null; to: string }> | null>(null)
  const [arranging, setArranging] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const flags = [
    health.unassigned > 0 ? `${health.unassigned} ${health.unassigned === 1 ? 'child has' : 'children have'} no servant` : null,
    ...health.emptyServants.map((n) => `${n} has no children yet`),
    health.uneven ? 'The groups are uneven' : null,
  ].filter((f): f is string => !!f)

  function askSplit() {
    setMessage(null)
    startTransition(async () => {
      const r = await previewSplit(classId)
      if (!r.ok) return setMessage({ ok: false, text: r.error })
      setPreview(r.data!.moves)
    })
  }

  function confirmSplit() {
    startTransition(async () => {
      const r = await applySplit(classId)
      if (!r.ok) return setMessage({ ok: false, text: r.error })
      setPreview(null)
      setMessage({ ok: true, text: r.data!.moved === 0 ? 'The groups were already even.' : `Moved ${r.data!.moved} ${r.data!.moved === 1 ? 'child' : 'children'}.` })
      router.refresh()
    })
  }

  function move(kidId: string, servantId: string) {
    setMessage(null)
    startTransition(async () => {
      const r = await moveKidToGroup(kidId, servantId)
      if (!r.ok) return setMessage({ ok: false, text: r.error })
      router.refresh()
    })
  }

  const chip = (k: Kid, current: string | null) => (
    <li key={k.id} className="flex flex-wrap items-center gap-1.5">
      <Link href={`/portal/students/${k.id}`} className="text-[12.5px] text-parch-800 hover:text-brand-800 hover:underline">
        {k.name}
      </Link>
      {arranging && (
        <select
          aria-label={`Move ${k.name}`}
          value={current ?? ''}
          disabled={pending}
          onChange={(e) => e.target.value && move(k.id, e.target.value)}
          className={cn(selectClass, 'h-[30px] max-w-[150px] py-0 text-[11.5px]')}
        >
          {current === null && <option value="">Choose…</option>}
          {servants.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      )}
    </li>
  )

  return (
    <div id="groups" className="scroll-mt-24">
      <Card
        title="Groups"
        icon={<UsersRound className="h-[15px] w-[15px]" aria-hidden />}
        action={flags.length > 0 ? <Badge tone="warn">Needs attention</Badge> : <Badge tone="good">Even</Badge>}
      >
        <p className="mb-3 text-[12px] text-parch-600">
          Each child has one servant who follows them up. Servants see their own group on My Group and on Follow-ups.
        </p>
        {flags.length > 0 && (
          <div className="mb-3" data-testid="group-flags">
            <Callout tone="warn" title="Groups need attention">
              {flags.join(' · ')}.{canManage ? ' Split evenly fixes this with the fewest moves.' : ' The class Coordinator can fix this.'}
            </Callout>
          </div>
        )}

        {servants.length === 0 ? (
          <p className="text-[12.5px] text-parch-500">This class has no active servants, so there is nobody to split the children between.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="group-grid">
            {servants.map((s) => (
              <div key={s.id} className="rounded-[12px] border border-parch-200 bg-parch-50 p-3" data-servant={s.id}>
                <p className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="font-serif text-[13px] font-bold text-parch-900">{s.name}</span>
                  <span className="text-[11px] font-bold text-parch-500" data-testid="group-size">
                    {s.kids.length}
                  </span>
                </p>
                {s.kids.length === 0 ? (
                  <p className="text-[11.5px] text-parch-500">No children yet</p>
                ) : (
                  <ul className="space-y-1">{s.kids.map((k) => chip(k, s.id))}</ul>
                )}
              </div>
            ))}
            {unassigned.length > 0 && (
              <div className="rounded-[12px] border border-[#FCD34D] bg-[#FFFBEB] p-3" data-testid="group-unassigned">
                <p className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="font-serif text-[13px] font-bold text-[#92400E]">No servant yet</span>
                  <span className="text-[11px] font-bold text-[#92400E]">{unassigned.length}</span>
                </p>
                <ul className="space-y-1">{unassigned.map((k) => chip(k, null))}</ul>
              </div>
            )}
          </div>
        )}

        {canManage && servants.length > 0 && (
          <div className="mt-3.5 flex flex-wrap gap-2 print:hidden">
            <button type="button" disabled={pending} onClick={askSplit} className={cn(buttonClass('primary', 'sm'), 'min-h-[36px]')}>
              <Shuffle className="h-3.5 w-3.5" aria-hidden /> Split evenly
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setArranging((a) => !a)}
              aria-pressed={arranging}
              className={cn(buttonClass('secondary', 'sm'), 'min-h-[36px]')}
            >
              {arranging ? 'Done arranging' : 'Move children'}
            </button>
          </div>
        )}

        {preview && (
          <div className="mt-3.5" data-testid="split-preview">
            <Callout tone={preview.length === 0 ? 'good' : 'info'} title={preview.length === 0 ? 'Nothing to move' : `${preview.length} ${preview.length === 1 ? 'move' : 'moves'}`}>
              {preview.length === 0 ? (
                'The groups are already as even as they can be.'
              ) : (
                <ul className="mt-1 space-y-0.5">
                  {preview.map((m) => (
                    <li key={`${m.kid}-${m.to}`}>
                      {m.kid} → {m.to}
                      {m.from ? <span className="text-parch-500"> (from {m.from})</span> : <span className="text-parch-500"> (had no servant)</span>}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-2.5 flex gap-2">
                {preview.length > 0 && (
                  <button type="button" disabled={pending} onClick={confirmSplit} className={cn(buttonClass('primary', 'sm'), 'min-h-[36px]')}>
                    {pending ? 'Moving…' : 'Confirm'}
                  </button>
                )}
                <button type="button" onClick={() => setPreview(null)} className={cn(buttonClass('ghost', 'sm'), 'min-h-[36px]')}>
                  {preview.length === 0 ? 'Close' : 'Cancel'}
                </button>
              </div>
            </Callout>
          </div>
        )}

        {message && (
          <p role="status" className={cn('mt-2.5 text-[12px] font-semibold', message.ok ? 'text-[#15803D]' : 'text-[#B91C1C]')}>
            {message.text}
          </p>
        )}
      </Card>
    </div>
  )
}

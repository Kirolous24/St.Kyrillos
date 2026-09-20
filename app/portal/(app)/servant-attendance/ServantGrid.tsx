'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Minus, X } from 'lucide-react'
import { saveServantWeek } from '@/lib/portal/actions/servant-attendance'
import { Card, TableWrap, Th, Td, Avatar, Badge, buttonClass } from '@/components/portal/ui'
import { cn } from '@/lib/utils'

type Cell = 'PRESENT' | 'EXCUSED' | 'ABSENT' | null

const CYCLE: Cell[] = [null, 'PRESENT', 'EXCUSED', 'ABSENT']
const DAY_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** The prototype's three statuses: solid green / amber / red, white glyph. */
const CELL_STYLE: Record<Exclude<Cell, null>, string> = {
  PRESENT: 'border-transparent bg-[#16A34A] text-white',
  EXCUSED: 'border-transparent bg-[#B45309] text-white',
  ABSENT: 'border-transparent bg-[#DC2626] text-white',
}

interface Props {
  weekStart: string
  activities: Array<{ key: string; label: string; dayOfWeek: number }>
  servants: Array<{ id: string; name: string; photo: string | null; classNames: string[]; isSelf: boolean }>
  marks: Array<{ servantId: string; activityKey: string; status: 'PRESENT' | 'EXCUSED' | 'ABSENT' }>
  /** Servant ids this user may write. Empty means the grid is read-only. */
  writableIds: string[]
}

const key = (servantId: string, activityKey: string) => `${servantId}|${activityKey}`

export function ServantGrid({ weekStart, activities, servants, marks, writableIds }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const initial = useMemo(() => {
    const map: Record<string, Cell> = {}
    for (const m of marks) map[key(m.servantId, m.activityKey)] = m.status
    return map
  }, [marks])
  const [cells, setCells] = useState<Record<string, Cell>>(initial)
  const [dirty, setDirty] = useState<string[]>([])
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const writable = useMemo(() => new Set(writableIds), [writableIds])

  function cycle(servantId: string, activityKey: string) {
    if (!writable.has(servantId)) return
    const k = key(servantId, activityKey)
    const current = cells[k] ?? null
    const next = CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length] ?? null
    setCells((prev) => ({ ...prev, [k]: next }))
    setDirty((prev) => (prev.includes(k) ? prev : [...prev, k]))
    setMessage(null)
  }

  function save() {
    if (dirty.length === 0) return
    setMessage(null)
    startTransition(async () => {
      const payload = dirty.map((k) => {
        const [servantId, activityKey] = k.split('|') as [string, string]
        const value = cells[k] ?? null
        return { servantId, activityKey, status: value ?? ('CLEAR' as const) }
      })
      const result = await saveServantWeek({ weekStart, marks: payload })
      if (!result.ok) return setMessage({ kind: 'err', text: result.error })
      setDirty([])
      setMessage({ kind: 'ok', text: `Saved ${result.data?.saved ?? 0} mark${result.data?.saved === 1 ? '' : 's'}.` })
      router.refresh()
    })
  }

  const readOnly = writableIds.length === 0

  return (
    <Card
      title="Weekly grid"
      action={
        readOnly ? null : (
          <div className="flex items-center gap-2">
            {message && (
              <span
                role="status"
                className={cn('text-[11px] font-bold', message.kind === 'ok' ? 'text-[#16A34A]' : 'text-[#DC2626]')}
              >
                {message.text}
              </span>
            )}
            <button type="button" onClick={save} disabled={pending || dirty.length === 0} className={buttonClass('primary', 'sm')}>
              {pending ? 'Saving…' : dirty.length > 0 ? `Save ${dirty.length} change${dirty.length === 1 ? '' : 's'}` : 'Saved'}
            </button>
          </div>
        )
      }
    >
      {/* legend, in the prototype's 11px uppercase label voice */}
      <p className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="grid h-4 w-4 place-items-center rounded-[5px] bg-[#16A34A] text-white">
            <Check className="h-2.5 w-2.5" />
          </span>
          Attended
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="grid h-4 w-4 place-items-center rounded-[5px] bg-[#B45309] text-white">
            <Minus className="h-2.5 w-2.5" />
          </span>
          Excused
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="grid h-4 w-4 place-items-center rounded-[5px] bg-[#DC2626] text-white">
            <X className="h-2.5 w-2.5" />
          </span>
          Absent
        </span>
        {!readOnly && <span className="font-normal normal-case tracking-normal">Tap a cell to cycle.</span>}
      </p>

      <TableWrap>
        <thead>
          <tr>
            <Th className="sticky left-0 z-10 bg-parch-50">Servant</Th>
            {activities.map((a) => (
              <Th key={a.key} align="center" className="whitespace-nowrap">
                <span className="block">{a.label}</span>
                <span className="block font-normal normal-case tracking-normal text-parch-400">{DAY_LABEL[a.dayOfWeek]}</span>
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {servants.map((s) => (
            <tr key={s.id} className={s.isSelf ? 'bg-brand-wash' : undefined}>
              <Td className={cn('sticky left-0 z-10', s.isSelf ? 'bg-brand-wash' : 'bg-parch-50')}>
                <div className="flex min-w-[9.5rem] items-center gap-2">
                  <Avatar name={s.name} photo={s.photo} size="sm" />
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate text-[12.5px] font-bold text-parch-900">
                      {s.name} {s.isSelf && <Badge tone="brand">you</Badge>}
                    </p>
                    {s.classNames.length > 0 && (
                      <p className="truncate text-[11px] text-parch-500">{s.classNames.join(', ')}</p>
                    )}
                  </div>
                </div>
              </Td>
              {activities.map((a) => {
                const value = cells[key(s.id, a.key)] ?? null
                const editable = writable.has(s.id)
                return (
                  <Td key={a.key} align="center" className="px-1.5">
                    <button
                      type="button"
                      onClick={() => cycle(s.id, a.key)}
                      disabled={!editable}
                      aria-label={`${s.name} — ${a.label}: ${value ? value.toLowerCase() : 'not recorded'}`}
                      className={cn(
                        'inline-flex h-10 w-10 items-center justify-center rounded-[9px] border text-[13px] font-extrabold transition-colors',
                        value === null ? 'border-parch-200 bg-parch-50 text-parch-400' : CELL_STYLE[value],
                        editable ? 'hover:border-brand-gold/70' : 'cursor-not-allowed opacity-70',
                      )}
                    >
                      {value === 'PRESENT' ? (
                        <Check className="h-4 w-4" aria-hidden />
                      ) : value === 'EXCUSED' ? (
                        <Minus className="h-4 w-4" aria-hidden />
                      ) : value === 'ABSENT' ? (
                        <X className="h-4 w-4" aria-hidden />
                      ) : (
                        '·'
                      )}
                    </button>
                  </Td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </TableWrap>

      {message && (
        <p
          role="status"
          className={cn('mt-3 text-[12.5px] font-semibold', message.kind === 'ok' ? 'text-[#16A34A]' : 'text-[#DC2626]')}
        >
          {message.text}
        </p>
      )}
    </Card>
  )
}

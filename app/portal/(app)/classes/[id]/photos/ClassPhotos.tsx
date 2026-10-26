'use client'

import { useRef, useState, useTransition } from 'react'
import { Camera, Check, Trash2 } from 'lucide-react'
import Link from '@/components/portal/Link'
import { removeStudentPhoto, setStudentPhoto } from '@/lib/portal/actions/photos'
import { downscalePhoto } from '@/components/portal/photo-resize'
import { Avatar, Card, buttonClass } from '@/components/portal/ui'
import { cn } from '@/lib/utils'

type Kid = { id: string; name: string; photo: string | null }

/**
 * Class photos (2026-10-25): one tile per child, each saving the moment a
 * photo is taken or chosen. The tiles keep their places while a servant works
 * down the class, so a child does not jump away the moment their photo saves:
 * saving refreshes the page, whose order puts the children with a photo last,
 * so the order on opening is kept here and the refresh only adds anybody new.
 */
export function ClassPhotos({ kids }: { kids: Kid[] }) {
  const [order] = useState(() => kids.map((k) => k.id))
  const [photos, setPhotos] = useState<Record<string, string | null>>(() => Object.fromEntries(kids.map((k) => [k.id, k.photo])))
  const byId = new Map(kids.map((k) => [k.id, k]))
  const shown = [...order.filter((id) => byId.has(id)), ...kids.map((k) => k.id).filter((id) => !order.includes(id))].map((id) => byId.get(id)!)
  const done = shown.filter((k) => photos[k.id] ?? k.photo).length

  return (
    <>
      <p className="mb-3 text-[12.5px] text-parch-700" data-testid="photo-count">
        <b>{done}</b> of {shown.length} {shown.length === 1 ? 'child has' : 'children have'} a photo. Tap <b>Take or choose</b> under a
        child: your phone offers its camera or its photos. Each photo is shrunk on your phone and saved straight away.
      </p>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" data-testid="class-photos">
        {shown.map((k) => (
          <PhotoTile
            key={k.id}
            kid={k}
            photo={k.id in photos ? photos[k.id]! : k.photo}
            onChange={(p) => setPhotos((all) => ({ ...all, [k.id]: p }))}
          />
        ))}
      </ul>
    </>
  )
}

function PhotoTile({ kid, photo, onChange }: { kid: Kid; photo: string | null; onChange: (photo: string | null) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [pending, startTransition] = useTransition()
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)

  async function pick(file: File | undefined) {
    setStatus(null)
    if (!file) return
    let dataUrl: string
    try {
      dataUrl = await downscalePhoto(file)
    } catch (err) {
      if (input.current) input.current.value = ''
      setStatus({ ok: false, text: err instanceof Error ? err.message : 'That photo could not be used.' })
      return
    }
    startTransition(async () => {
      const r = await setStudentPhoto(kid.id, dataUrl)
      if (input.current) input.current.value = ''
      if (!r.ok) return setStatus({ ok: false, text: r.error })
      onChange(dataUrl)
      setStatus({ ok: true, text: 'Saved' })
    })
  }

  function remove() {
    if (!window.confirm(`Remove ${kid.name}’s photo?`)) return
    setStatus(null)
    startTransition(async () => {
      const r = await removeStudentPhoto(kid.id)
      if (!r.ok) return setStatus({ ok: false, text: r.error })
      onChange(null)
      setStatus({ ok: true, text: 'Removed' })
    })
  }

  return (
    <li data-photo-kid={kid.id} data-has-photo={photo ? 'yes' : 'no'}>
      <Card bodyClassName="flex flex-col items-center gap-2 p-3 text-center">
        <Avatar name={kid.name} photo={photo} size="xl" />
        <Link href={`/portal/students/${kid.id}`} className="line-clamp-2 text-[12.5px] font-bold text-parch-900 hover:text-brand-800">
          {kid.name}
        </Link>
        <label
          className={cn(
            buttonClass(photo ? 'secondary' : 'gold', 'sm'),
            'min-h-[40px] w-full cursor-pointer',
            pending && 'pointer-events-none opacity-60',
          )}
        >
          <Camera className="h-3.5 w-3.5" aria-hidden />
          {pending ? 'Saving…' : photo ? 'Change' : 'Take or choose'}
          <input
            ref={input}
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={pending}
            aria-label={`Photo for ${kid.name}`}
            onChange={(e) => void pick(e.target.files?.[0])}
          />
        </label>
        {photo && (
          <button type="button" onClick={remove} disabled={pending} className={cn(buttonClass('ghost', 'sm'), 'min-h-[36px] text-[11.5px]')}>
            <Trash2 className="h-3.5 w-3.5" aria-hidden /> Remove
          </button>
        )}
        {status && (
          <p role="status" className={cn('flex items-center gap-1 text-[11.5px] font-semibold', status.ok ? 'text-[#15803D]' : 'text-[#B91C1C]')}>
            {status.ok && <Check className="h-3.5 w-3.5" aria-hidden />}
            {status.text}
          </p>
        )}
      </Card>
    </li>
  )
}

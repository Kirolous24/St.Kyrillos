'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Trash2 } from 'lucide-react'
import { Avatar, buttonClass, Callout } from './ui'
import { cn } from '@/lib/utils'
import type { ActionResult } from '@/lib/portal/action-result'

/**
 * Photos are stored as small data URLs on the row itself — there is no object
 * storage — so the browser does the shrinking: at most 256×256, re-encoded as
 * JPEG and squeezed under ~60 KB before it is ever posted. The server checks
 * the prefix and the length again; this is a courtesy, not a control.
 */
const MAX_EDGE = 256
const TARGET_CHARS = 60_000
const ACCEPTED = ['image/jpeg', 'image/png']

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('That file could not be read as an image.'))
    img.src = src
  })
}

async function downscale(file: File): Promise<string> {
  if (!ACCEPTED.includes(file.type)) throw new Error('Choose a JPEG or PNG photo.')
  if (file.size > 20 * 1024 * 1024) throw new Error('That photo is very large. Try one under 20 MB.')

  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    const longest = Math.max(img.naturalWidth, img.naturalHeight) || MAX_EDGE
    const scale = Math.min(1, MAX_EDGE / longest)
    const width = Math.max(1, Math.round(img.naturalWidth * scale))
    const height = Math.max(1, Math.round(img.naturalHeight * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('This browser cannot resize images.')
    // JPEG has no alpha: flatten onto the cream page ground rather than black.
    ctx.fillStyle = '#FFFDF8'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(img, 0, 0, width, height)

    let quality = 0.82
    let out = canvas.toDataURL('image/jpeg', quality)
    while (out.length > TARGET_CHARS && quality > 0.35) {
      quality -= 0.12
      out = canvas.toDataURL('image/jpeg', quality)
    }
    if (!out.startsWith('data:image/jpeg;base64,')) throw new Error('That photo could not be converted.')
    if (out.length > TARGET_CHARS * 1.5) throw new Error('That photo is still too large. Try cropping it first.')
    return out
  } finally {
    URL.revokeObjectURL(url)
  }
}

interface Props {
  /** The photo currently saved, if any. */
  current: string | null
  /** Whose photo this is — used for the fallback initials and the alt text. */
  name: string
  /** Server action that validates and stores the data URL. */
  action: (dataUrl: string) => Promise<ActionResult>
  /** Optional server action that clears the stored photo. */
  removeAction?: () => Promise<ActionResult>
  saveLabel?: string
}

export function PhotoUpload({ current, name, action, removeAction, saveLabel = 'Save photo' }: Props) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  async function choose(file: File | undefined) {
    setError(null)
    setDone(null)
    if (!file) return
    try {
      setPreview(await downscale(file))
    } catch (err) {
      setPreview(null)
      setError(err instanceof Error ? err.message : 'That photo could not be used.')
    }
  }

  function save() {
    if (!preview) return
    setError(null)
    startTransition(async () => {
      const result = await action(preview)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setDone('Photo saved.')
      setPreview(null)
      if (fileRef.current) fileRef.current.value = ''
      router.refresh()
    })
  }

  function remove() {
    if (!removeAction) return
    setError(null)
    startTransition(async () => {
      const result = await removeAction()
      if (!result.ok) {
        setError(result.error)
        return
      }
      setDone('Photo removed.')
      setPreview(null)
      if (fileRef.current) fileRef.current.value = ''
      router.refresh()
    })
  }

  const shown = preview ?? current

  return (
    <div className="flex flex-col items-center gap-5 text-center">
      {/* Large circular preview — the prototype's photo modal, centred. */}
      <span className="grid h-28 w-28 place-items-center rounded-full bg-brand-wash p-1 ring-1 ring-brand-gold/40">
        <Avatar name={name} photo={shown} size="xl" />
      </span>

      <div className="flex flex-col items-center gap-2">
        <label className={cn(buttonClass('gold'), 'min-h-[40px] cursor-pointer')}>
          <Camera className="h-4 w-4" aria-hidden />
          {shown ? 'Choose a different photo' : 'Choose a photo'}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png"
            className="sr-only"
            onChange={(e) => void choose(e.target.files?.[0])}
          />
        </label>
        <p className="text-[11px] leading-relaxed text-parch-500">
          JPEG or PNG · up to 20 MB · shrunk to {MAX_EDGE}&times;{MAX_EDGE} in your browser before it is sent.
        </p>
      </div>

      {preview && (
        <p className="text-[12.5px] font-semibold text-parch-700">
          Ready to save — about {Math.round((preview.length * 3) / 4 / 1024)} KB.
        </p>
      )}

      {error && (
        <div className="w-full text-left">
          <Callout tone="bad">{error}</Callout>
        </div>
      )}
      {done && !preview && (
        <div className="w-full text-left">
          <Callout tone="good">{done}</Callout>
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" onClick={save} disabled={!preview || pending} className={buttonClass('primary')}>
          {pending ? 'Saving…' : saveLabel}
        </button>
        {preview && (
          <button
            type="button"
            onClick={() => {
              setPreview(null)
              if (fileRef.current) fileRef.current.value = ''
            }}
            disabled={pending}
            className={buttonClass('secondary')}
          >
            Cancel
          </button>
        )}
        {removeAction && current && !preview && (
          <button type="button" onClick={remove} disabled={pending} className={buttonClass('danger')}>
            <Trash2 className="h-4 w-4" aria-hidden /> Remove photo
          </button>
        )}
      </div>
    </div>
  )
}

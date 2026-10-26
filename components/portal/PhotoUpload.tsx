'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Trash2 } from 'lucide-react'
import { Avatar, buttonClass, Callout } from './ui'
import { cn } from '@/lib/utils'
import { downscalePhoto, PHOTO_MAX_EDGE } from './photo-resize'
import type { ActionResult } from '@/lib/portal/action-result'

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
      setPreview(await downscalePhoto(file))
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
            accept="image/*"
            className="sr-only"
            onChange={(e) => void choose(e.target.files?.[0])}
          />
        </label>
        <p className="text-[11px] leading-relaxed text-parch-500">
          Any photo · up to 20 MB · shrunk to {PHOTO_MAX_EDGE}&times;{PHOTO_MAX_EDGE} in your browser before it is sent.
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

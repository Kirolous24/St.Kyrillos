'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteReservationItem, saveReservationItem, setReservationItemActive } from '@/lib/portal/actions/reservations'
import { removeReservationItemPhoto, setReservationItemPhoto } from '@/lib/portal/actions/photos'
import { PhotoUpload } from '@/components/portal/PhotoUpload'
import { Field, InlineNotice, buttonClass, inputClass } from '@/components/portal/ui'
import { RESERVATION_COLORS, type ReservationColor } from '@/lib/portal/reservations'
import { cn } from '@/lib/utils'

export interface EditableItem {
  id: string
  name: string
  details: string | null
  color: string
  photo: string | null
  isActive: boolean
  reservations: number
}

function ColorPicker({ value, onChange, name }: { value: string; onChange: (c: ReservationColor) => void; name: string }) {
  return (
    <fieldset className="mb-3.5">
      <legend className="mb-1.5 text-[12px] font-bold text-parch-700">Color on the calendar</legend>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(RESERVATION_COLORS) as ReservationColor[]).map((key) => {
          const c = RESERVATION_COLORS[key]
          return (
            <label
              key={key}
              className={cn(
                'inline-flex cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] py-1 pl-1 pr-2.5 text-[12px] font-semibold text-parch-800',
                value === key ? 'border-brand-gold bg-brand-wash' : 'border-parch-200 bg-parch-50',
              )}
            >
              <input type="radio" name={name} value={key} checked={value === key} onChange={() => onChange(key)} className="sr-only" />
              <span aria-hidden className="h-5 w-5 rounded-full border" style={{ backgroundColor: c.bg, borderColor: c.border }} />
              {c.label}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

/** One van on the admin's list (2026-11-02): its name, details, color and picture, and retiring it. */
export function ItemEditor({ item }: { item: EditableItem }) {
  const router = useRouter()
  const [name, setName] = useState(item.name)
  const [details, setDetails] = useState(item.details ?? '')
  const [color, setColor] = useState(item.color)
  const [message, setMessage] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pending, startTransition] = useTransition()

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, done: string) {
    setMessage(null)
    startTransition(async () => {
      const result = await fn()
      if (!result.ok) {
        setMessage({ tone: 'bad', text: result.error ?? 'Something went wrong.' })
        return
      }
      setMessage({ tone: 'good', text: done })
      setConfirmDelete(false)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4" data-testid={`van-${item.id}`}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          run(() => saveReservationItem({ id: item.id, name, details, color }), 'Saved.')
        }}
      >
        <div className="grid gap-x-3 sm:grid-cols-2">
          <Field label="Name" htmlFor={`van-name-${item.id}`}>
            <input id={`van-name-${item.id}`} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} maxLength={60} required />
          </Field>
          <Field label="Details (optional)" htmlFor={`van-details-${item.id}`} hint="Seats, where the keys are, anything a driver should know.">
            <input id={`van-details-${item.id}`} value={details} onChange={(e) => setDetails(e.target.value)} className={inputClass} maxLength={200} />
          </Field>
        </div>
        <ColorPicker value={color} onChange={setColor} name={`van-color-${item.id}`} />
        <button type="submit" className={buttonClass('primary', 'sm')} disabled={pending}>
          Save
        </button>
      </form>

      <div>
        <p className="mb-1.5 text-[12px] font-bold text-parch-700">Picture</p>
        <PhotoUpload
          current={item.photo}
          name={item.name}
          action={(dataUrl) => setReservationItemPhoto(item.id, dataUrl)}
          removeAction={() => removeReservationItemPhoto(item.id)}
          saveLabel="Save picture"
          shape="wide"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-[#F0EEE8] pt-3">
        {item.isActive ? (
          <button type="button" className={buttonClass('secondary', 'sm')} disabled={pending} onClick={() => run(() => setReservationItemActive(item.id, false), 'Retired: it can no longer be reserved.')}>
            Retire
          </button>
        ) : (
          <button type="button" className={buttonClass('secondary', 'sm')} disabled={pending} onClick={() => run(() => setReservationItemActive(item.id, true), 'It can be reserved again.')}>
            Bring it back
          </button>
        )}
        {item.reservations === 0 &&
          (confirmDelete ? (
            <>
              <button type="button" className={buttonClass('danger', 'sm')} disabled={pending} onClick={() => run(() => deleteReservationItem(item.id), 'Deleted.')}>
                Yes, delete the {item.name}
              </button>
              <button type="button" className={buttonClass('ghost', 'sm')} disabled={pending} onClick={() => setConfirmDelete(false)}>
                Keep it
              </button>
            </>
          ) : (
            <button type="button" className={buttonClass('ghost', 'sm')} disabled={pending} onClick={() => setConfirmDelete(true)}>
              Delete
            </button>
          ))}
        <span className="text-[11.5px] text-parch-500">
          {item.reservations === 0 ? 'Never reserved.' : `${item.reservations} reservation${item.reservations === 1 ? '' : 's'}, so it can be retired but not deleted.`}
        </span>
      </div>
      {message && <InlineNotice tone={message.tone}>{message.text}</InlineNotice>}
    </div>
  )
}

/** Add a van to the list. */
export function AddItemForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [details, setDetails] = useState('')
  const [color, setColor] = useState<string>('blue')
  const [message, setMessage] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setMessage(null)
        startTransition(async () => {
          const result = await saveReservationItem({ name, details, color })
          if (!result.ok) {
            setMessage({ tone: 'bad', text: result.error })
            return
          }
          setMessage({ tone: 'good', text: `Added the ${name.trim()}.` })
          setName('')
          setDetails('')
          setColor('blue')
          router.refresh()
        })
      }}
      data-testid="add-van"
    >
      <div className="grid gap-x-3 sm:grid-cols-2">
        <Field label="Name" htmlFor="van-name-new">
          <input id="van-name-new" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} maxLength={60} required placeholder="e.g. Blue Van" />
        </Field>
        <Field label="Details (optional)" htmlFor="van-details-new">
          <input id="van-details-new" value={details} onChange={(e) => setDetails(e.target.value)} className={inputClass} maxLength={200} placeholder="e.g. 15 seats" />
        </Field>
      </div>
      <ColorPicker value={color} onChange={setColor} name="van-color-new" />
      <button type="submit" className={buttonClass('primary', 'sm')} disabled={pending}>
        {pending ? 'Adding…' : 'Add the van'}
      </button>
      {message && <InlineNotice tone={message.tone} className="mt-3">{message.text}</InlineNotice>}
    </form>
  )
}

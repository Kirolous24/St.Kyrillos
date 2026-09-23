'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Music, Pencil, Plus, Trash2, Volume2 } from 'lucide-react'
import { deleteHymn, saveHymn } from '@/lib/portal/actions/hymns'
import {
  Card,
  Callout,
  EmptyState,
  Field,
  IconTile,
  buttonClass,
  inputClass,
  textareaClass,
} from '@/components/portal/ui'
import { cn } from '@/lib/utils'

export interface HymnView {
  id: string
  title: string
  lyrics: string | null
  audioUrl: string | null
  notes: string | null
  addedByName: string | null
}

interface Draft {
  id?: string
  title: string
  lyrics: string
  audioUrl: string
  notes: string
}

const emptyDraft: Draft = { title: '', lyrics: '', audioUrl: '', notes: '' }

export function HymnManager({
  hymns,
  canWrite,
  query,
}: {
  hymns: HymnView[]
  canWrite: boolean
  query: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [draft, setDraft] = useState<Draft | null>(null)
  // F0233 — the prototype let several hymns' lyrics stay open at once. An
  // exclusive accordion closes the hymn you were comparing against the moment
  // you open the next one, which is precisely what comparing two tunes needs.
  const [openIds, setOpenIds] = useState<Set<string>>(
    () => new Set(hymns.length === 1 ? [hymns[0]!.id] : []),
  )
  const toggleOpen = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  // F0231 — the confirmation renders at the top of the left column, above the
  // hymn list, while the form that produced it is in the right column: on a
  // phone that is below the entire book, so a servant taps "Add hymn" and
  // nothing appears to happen — and a validation error saying the title is
  // missing is invisible at exactly the moment it is needed. Bring it into view
  // and hand it the focus, so the answer arrives where the question was asked.
  // A fixed toast is not an option here: `.portal-enter`'s transform traps
  // position:fixed inside page content.
  useEffect(() => {
    if (!message) return
    const el = document.getElementById('hymn-message')
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    el?.focus()
  }, [message])

  function submit() {
    if (!draft) return
    if (!draft.title.trim()) return setMessage({ kind: 'err', text: 'Give the hymn a title.' })
    startTransition(async () => {
      const result = await saveHymn({
        id: draft.id,
        title: draft.title.trim(),
        lyrics: draft.lyrics.trim() || undefined,
        audioUrl: draft.audioUrl.trim() || undefined,
        notes: draft.notes.trim() || undefined,
      })
      if (!result.ok) return setMessage({ kind: 'err', text: result.error })
      setMessage({ kind: 'ok', text: draft.id ? 'Hymn updated.' : 'Hymn added.' })
      setDraft(null)
      router.refresh()
    })
  }

  function remove(hymn: HymnView) {
    startTransition(async () => {
      const result = await deleteHymn(hymn.id)
      setConfirmDelete(null)
      if (!result.ok) return setMessage({ kind: 'err', text: result.error })
      setMessage({ kind: 'ok', text: `"${hymn.title}" removed from the book.` })
      router.refresh()
    })
  }

  return (
    <div className="grid gap-5 lg:grid-cols-5">
      <div className="space-y-4 lg:col-span-3">
        {message && (
          <Callout tone={message.kind === 'ok' ? 'good' : 'bad'}>
            <p role="status">{message.text}</p>
          </Callout>
        )}

        {hymns.length === 0 ? (
          <EmptyState
            title={query ? `No hymn matches “${query}”` : 'The hymn book is empty'}
            hint={
              query
                ? 'Try part of the title, or clear the search.'
                : canWrite
                  ? 'Add the first hymn with its lyrics so the whole church can follow along.'
                  : 'Servants will add hymns here soon.'
            }
            /* F0232 — the prototype put the call to action in the empty state
               itself. Telling somebody to add the first hymn without offering
               them the way to do it sends them looking for the panel. */
            action={
              canWrite && !query ? (
                <button type="button" onClick={() => setDraft({ ...emptyDraft })} className={buttonClass('primary')}>
                  <Plus className="h-[13px] w-[13px]" aria-hidden /> Add a hymn
                </button>
              ) : undefined
            }
          />
        ) : (
          /* One sheet of hairline-ruled hymn rows, exactly as the prototype. */
          <Card title="Hymn book" icon={<Music className="h-4 w-4" aria-hidden />} bodyClassName="p-0">
            <ul>
              {hymns.map((hymn) => {
                const open = openIds.has(hymn.id)
                return (
                  <li key={hymn.id} className="border-b-[0.5px] border-[#F0EEE8] last:border-b-0">
                    <div className="flex items-center gap-2.5 px-[18px] py-3">
                      <IconTile accent="#C89B3C" size="sm">
                        <Music className="h-4 w-4" aria-hidden />
                      </IconTile>
                      <button
                        type="button"
                        onClick={() => toggleOpen(hymn.id)}
                        aria-expanded={open}
                        className="min-w-0 flex-1 py-1 text-left"
                      >
                        <span className="block truncate font-serif text-[14px] font-bold text-parch-900">
                          {hymn.title}
                        </span>
                        {hymn.addedByName && (
                          <span className="block text-[11.5px] text-parch-500">Added by {hymn.addedByName}</span>
                        )}
                      </button>
                      {canWrite && (
                        <div className="flex shrink-0 gap-1.5 print:hidden">
                          <button
                            type="button"
                            onClick={() => {
                              setMessage(null)
                              setDraft({
                                id: hymn.id,
                                title: hymn.title,
                                lyrics: hymn.lyrics ?? '',
                                audioUrl: hymn.audioUrl ?? '',
                                notes: hymn.notes ?? '',
                              })
                            }}
                            disabled={pending}
                            className={buttonClass('secondary', 'sm')}
                          >
                            <Pencil className="h-4 w-4" aria-hidden />
                            <span className="sr-only">Edit {hymn.title}</span>
                          </button>
                          {confirmDelete === hymn.id ? (
                            <>
                              <button type="button" onClick={() => remove(hymn)} disabled={pending} className={buttonClass('danger', 'sm')}>
                                Delete
                              </button>
                              <button type="button" onClick={() => setConfirmDelete(null)} className={buttonClass('ghost', 'sm')}>
                                Keep
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(hymn.id)}
                              disabled={pending}
                              className={buttonClass('secondary', 'sm')}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden />
                              <span className="sr-only">Delete {hymn.title}</span>
                            </button>
                          )}
                        </div>
                      )}
                      <ChevronDown
                        aria-hidden
                        className={cn(
                          'h-4 w-4 shrink-0 text-parch-500 transition-transform',
                          open && 'rotate-180',
                        )}
                      />
                    </div>

                    {open && (
                      <div className="pb-4 pl-[18px] pr-[18px] sm:pl-[68px]">
                        {hymn.audioUrl && (
                          <p className="mb-3">
                            <a
                              href={hymn.audioUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-gold bg-brand-wash px-3 py-1.5 text-[11.5px] font-bold text-brand-gold-dark"
                            >
                              <Volume2 className="h-3.5 w-3.5" aria-hidden /> Listen
                            </a>
                          </p>
                        )}
                        {hymn.lyrics ? (
                          <p className="whitespace-pre-line font-body text-[13px] leading-[1.9] text-parch-900">
                            {hymn.lyrics}
                          </p>
                        ) : (
                          <p className="text-[12.5px] text-parch-500">No lyrics have been added yet.</p>
                        )}
                        {hymn.notes && (
                          <p className="mt-3 border-t border-[#F0EEE8] pt-3 text-[12px] text-parch-600">{hymn.notes}</p>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </Card>
        )}
      </div>

      {/* id anchors the page header's "Add hymn" button to this card. */}
      {canWrite && (
        <div id="add-hymn" className="lg:col-span-2 scroll-mt-24">
          <Card
            tone="brand"
            title={draft ? (draft.id ? 'Edit hymn' : 'New hymn') : 'Add a hymn'}
            icon={<Music className="h-4 w-4" aria-hidden />}
            action={
              draft ? (
                <button
                  type="button"
                  onClick={() => setDraft(null)}
                  className="text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500 hover:text-brand-800"
                >
                  Cancel
                </button>
              ) : null
            }
          >
            {!draft ? (
              <button
                type="button"
                onClick={() => {
                  setMessage(null)
                  setDraft({ ...emptyDraft })
                }}
                className={cn(buttonClass('primary'), 'w-full')}
              >
                <Plus className="h-4 w-4" aria-hidden /> New hymn
              </button>
            ) : (
              <div>
                <Field label="Title" htmlFor="hymn-title">
                  <input
                    id="hymn-title"
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    className={inputClass}
                    maxLength={140}
                    placeholder="e.g. Ⲧⲉⲛⲟⲩⲱϣⲧ · We worship"
                  />
                </Field>
                <Field label="Lyrics" htmlFor="hymn-lyrics" hint="Line breaks are kept exactly as you type them">
                  <textarea
                    id="hymn-lyrics"
                    value={draft.lyrics}
                    onChange={(e) => setDraft({ ...draft, lyrics: e.target.value })}
                    className={cn(textareaClass, 'min-h-[12rem]')}
                    maxLength={20000}
                  />
                </Field>
                <Field label="Audio link" htmlFor="hymn-audio" hint="Optional · a http or https address">
                  <input
                    id="hymn-audio"
                    value={draft.audioUrl}
                    onChange={(e) => setDraft({ ...draft, audioUrl: e.target.value })}
                    className={inputClass}
                    placeholder="https://…"
                    inputMode="url"
                  />
                </Field>
                <Field label="Notes" htmlFor="hymn-notes" hint="Optional · when it is sung, tune, season">
                  <textarea
                    id="hymn-notes"
                    value={draft.notes}
                    onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                    className={textareaClass}
                    maxLength={2000}
                  />
                </Field>
                <button type="button" onClick={submit} disabled={pending} className={cn(buttonClass('primary'), 'w-full')}>
                  {pending ? 'Saving…' : draft.id ? 'Save changes' : 'Add hymn'}
                </button>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpen, Check, Copy, Link2, Pencil, Plus, Trash2, Undo2, X } from 'lucide-react'
import {
  copyLessonsFromClass,
  listCopyCandidates,
  type CopyCandidate,
  deleteLesson,
  saveLesson,
  setLessonStatus,
  type SaveLessonInput,
} from '@/lib/portal/actions/lessons'
import type { LessonView } from '@/lib/portal/data/lessons'
import type { ServantOption } from '@/lib/portal/data/agenda'
import {
  Avatar,
  Badge,
  Callout,
  Card,
  EmptyState,
  Field,
  SectionTitle,
  buttonClass,
  checkboxClass,
  inputClass,
  selectClass,
  textareaClass,
} from '@/components/portal/ui'
import { formatLongDate } from '@/lib/portal/format'
import { todayInNewYork } from '@/lib/portal/dates'
import { cn } from '@/lib/utils'

interface Props {
  classId: string
  className: string
  planned: LessonView[]
  taught: LessonView[]
  servants: ServantOption[]
  copySources: Array<{ id: string; name: string }>
}

interface Draft {
  id?: string
  title: string
  date: string
  topics: string
  notes: string
  assignedToId: string
  links: Array<{ label: string; url: string }>
}

const emptyDraft: Draft = { title: '', date: '', topics: '', notes: '', assignedToId: '', links: [] }

function toDraft(lesson: LessonView): Draft {
  return {
    id: lesson.id,
    title: lesson.title,
    date: lesson.date ?? '',
    topics: lesson.topics.join(', '),
    notes: lesson.notes ?? '',
    assignedToId: lesson.assignedToId ?? '',
    links: lesson.links.map((l) => ({ label: l.label, url: l.url })),
  }
}

export function LessonManager({ classId, className, planned, taught, servants, copySources }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [copyFrom, setCopyFrom] = useState(copySources[0]?.id ?? '')
  // The prototype copied all-or-nothing. A class usually wants three lessons
  // from another term, not the whole year.
  const [candidates, setCandidates] = useState<{ sourceName: string; lessons: CopyCandidate[] } | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [copyPlannedOnly, setCopyPlannedOnly] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  function open(lesson?: LessonView) {
    setMessage(null)
    setDraft(lesson ? toDraft(lesson) : { ...emptyDraft })
  }

  function submit() {
    if (!draft) return
    if (!draft.title.trim()) return setMessage({ kind: 'err', text: 'Give the lesson a title.' })
    const payload: SaveLessonInput = {
      id: draft.id,
      classId,
      title: draft.title.trim(),
      date: draft.date || undefined,
      topics: draft.topics.split(',').map((t) => t.trim()).filter(Boolean),
      notes: draft.notes.trim() || undefined,
      links: draft.links.filter((l) => l.url.trim()),
      assignedToId: draft.assignedToId || undefined,
    }
    startTransition(async () => {
      const result = await saveLesson(payload)
      if (!result.ok) return setMessage({ kind: 'err', text: result.error })
      setMessage({ kind: 'ok', text: draft.id ? 'Lesson updated.' : 'Lesson added.' })
      setDraft(null)
      router.refresh()
    })
  }

  function toggleStatus(lesson: LessonView) {
    startTransition(async () => {
      const result = await setLessonStatus({
        id: lesson.id,
        status: lesson.status === 'TAUGHT' ? 'PLANNED' : 'TAUGHT',
      })
      if (!result.ok) return setMessage({ kind: 'err', text: result.error })
      setMessage({
        kind: 'ok',
        text: `"${lesson.title}" marked ${lesson.status === 'TAUGHT' ? 'planned' : 'taught'}.`,
      })
      router.refresh()
    })
  }

  function remove(lesson: LessonView) {
    startTransition(async () => {
      const result = await deleteLesson(lesson.id)
      setConfirmDelete(null)
      if (!result.ok) return setMessage({ kind: 'err', text: result.error })
      setMessage({ kind: 'ok', text: `"${lesson.title}" deleted.` })
      router.refresh()
    })
  }

  /** Load the source's lessons so the servant can choose. */
  function browseSource() {
    if (!copyFrom) return
    setMessage(null)
    setCandidates(null)
    startTransition(async () => {
      const result = await listCopyCandidates(copyFrom, classId)
      if (!result.ok) return setMessage({ kind: 'err', text: result.error })
      setCandidates(result.data!)
      // Pre-tick everything this class does not already have — the common case
      // is "give me the ones I am missing".
      setPicked(new Set(result.data!.lessons.filter((l) => !l.alreadyThere).map((l) => l.id)))
    })
  }

  function copy() {
    if (!copyFrom) return
    startTransition(async () => {
      const result = await copyLessonsFromClass({
        fromClassId: copyFrom,
        toClassId: classId,
        onlyPlanned: copyPlannedOnly,
        lessonIds: candidates ? Array.from(picked) : undefined,
      })
      if (!result.ok) return setMessage({ kind: 'err', text: result.error })
      const n = result.data?.copied ?? 0
      setMessage({ kind: 'ok', text: `Copied ${n} lesson${n === 1 ? '' : 's'} into ${className}. The other class keeps its own.` })
      setCandidates(null)
      setPicked(new Set())
      router.refresh()
    })
  }

  return (
    <div className="grid gap-5 lg:grid-cols-5">
      <div className="space-y-5 lg:col-span-3">
        {message && (
          <Callout tone={message.kind === 'ok' ? 'good' : 'bad'}>
            <p role="status">{message.text}</p>
          </Callout>
        )}

        <div>
          <SectionTitle hint={`${planned.length} lesson${planned.length === 1 ? '' : 's'}`}>Planned</SectionTitle>
          {planned.length === 0 ? (
            <EmptyState
              title="Nothing planned yet"
              hint="Add the next lesson, or copy a term's worth from another class."
              action={
                <button type="button" onClick={() => open()} className={buttonClass('primary')}>
                  <Plus className="h-4 w-4" aria-hidden /> Add a lesson
                </button>
              }
            />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {planned.map((lesson) => (
                <LessonCard
                  key={lesson.id}
                  lesson={lesson}
                  pending={pending}
                  confirming={confirmDelete === lesson.id}
                  onEdit={() => open(lesson)}
                  onToggle={() => toggleStatus(lesson)}
                  onAskDelete={() => setConfirmDelete(lesson.id)}
                  onCancelDelete={() => setConfirmDelete(null)}
                  onDelete={() => remove(lesson)}
                />
              ))}
            </ul>
          )}
        </div>

        <div>
          <SectionTitle hint={`${taught.length} lesson${taught.length === 1 ? '' : 's'}`}>Taught</SectionTitle>
          {taught.length === 0 ? (
            <p className="rounded-[14px] border border-dashed border-parch-300 px-4 py-6 text-center text-[12.5px] text-parch-500">
              Lessons move here once you mark them taught.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {taught.map((lesson) => (
                <LessonCard
                  key={lesson.id}
                  lesson={lesson}
                  pending={pending}
                  confirming={confirmDelete === lesson.id}
                  onEdit={() => open(lesson)}
                  onToggle={() => toggleStatus(lesson)}
                  onAskDelete={() => setConfirmDelete(lesson.id)}
                  onCancelDelete={() => setConfirmDelete(null)}
                  onDelete={() => remove(lesson)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="space-y-4 lg:col-span-2">
        <Card
          tone="brand"
          title={draft ? (draft.id ? 'Edit lesson' : 'New lesson') : 'Add a lesson'}
          icon={<BookOpen className="h-4 w-4" aria-hidden />}
          action={
            draft ? (
              <button type="button" onClick={() => setDraft(null)} className="text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500 hover:text-brand-800">
                Cancel
              </button>
            ) : null
          }
        >
          {!draft ? (
            <button type="button" onClick={() => open()} className={cn(buttonClass('primary'), 'w-full')}>
              <Plus className="h-4 w-4" aria-hidden /> New lesson
            </button>
          ) : (
            <div className="space-y-1">
              <Field label="Title" htmlFor="lesson-title">
                <input
                  id="lesson-title"
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  className={inputClass}
                  maxLength={140}
                  placeholder="e.g. The Good Samaritan"
                />
              </Field>
              <div className="grid gap-x-3 sm:grid-cols-2">
                <Field label="Date" htmlFor="lesson-date" hint="Leave blank if undecided">
                  <input
                    id="lesson-date"
                    type="date"
                    value={draft.date}
                    onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                    className={inputClass}
                  />
                </Field>
                <Field label="Servant" htmlFor="lesson-servant">
                  <select
                    id="lesson-servant"
                    value={draft.assignedToId}
                    onChange={(e) => setDraft({ ...draft, assignedToId: e.target.value })}
                    className={selectClass}
                  >
                    <option value="">Unassigned</option>
                    {servants.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Topics" htmlFor="lesson-topics" hint="Separate with commas">
                <input
                  id="lesson-topics"
                  value={draft.topics}
                  onChange={(e) => setDraft({ ...draft, topics: e.target.value })}
                  className={inputClass}
                  placeholder="Mercy, Loving your neighbour"
                />
              </Field>
              <Field label="Notes" htmlFor="lesson-notes">
                <textarea
                  id="lesson-notes"
                  value={draft.notes}
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                  className={textareaClass}
                  maxLength={5000}
                  placeholder="Opening question, craft, memory verse…"
                />
              </Field>

              <div className="mb-3.5">
                <p className="mb-1.5 block text-[12px] font-bold text-parch-700">Links</p>
                <ul className="space-y-2">
                  {draft.links.map((link, idx) => (
                    <li key={idx} className="flex gap-2">
                      <input
                        value={link.label}
                        onChange={(e) => {
                          const links = [...draft.links]
                          links[idx] = { ...link, label: e.target.value }
                          setDraft({ ...draft, links })
                        }}
                        className={cn(inputClass, 'w-1/3')}
                        placeholder="Slides"
                        aria-label={`Link ${idx + 1} label`}
                        maxLength={80}
                      />
                      <input
                        value={link.url}
                        onChange={(e) => {
                          const links = [...draft.links]
                          links[idx] = { ...link, url: e.target.value }
                          setDraft({ ...draft, links })
                        }}
                        className={cn(inputClass, 'flex-1')}
                        placeholder="https://…"
                        aria-label={`Link ${idx + 1} address`}
                        inputMode="url"
                      />
                      <button
                        type="button"
                        onClick={() => setDraft({ ...draft, links: draft.links.filter((_, i) => i !== idx) })}
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] text-parch-500 hover:bg-brand-wash hover:text-red-700"
                        aria-label={`Remove link ${idx + 1}`}
                      >
                        <X className="h-4 w-4" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
                {draft.links.length < 12 && (
                  <button
                    type="button"
                    onClick={() => setDraft({ ...draft, links: [...draft.links, { label: '', url: '' }] })}
                    className={cn(buttonClass('secondary', 'sm'), 'mt-2')}
                  >
                    <Link2 className="h-4 w-4" aria-hidden /> Add link
                  </button>
                )}
              </div>

              {/* F0268 — recording the lesson you have just given took two
                  actions: add it, then find its card and flip the status, and it
                  still ended up undated. It is the one thing every servant does
                  every week, so it gets its own save. A blank date becomes today
                  in church time, not the browser's — a Central-time phone at
                  11pm on Saturday would otherwise file Sunday's lesson under
                  Saturday. */}
              <div className="flex flex-col gap-2 sm:flex-row">
                <button type="button" onClick={submit} disabled={pending} className={cn(buttonClass('primary'), 'w-full')}>
                  {pending ? 'Saving…' : draft.id ? 'Save changes' : 'Add to plan'}
                </button>
                {!draft.id && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      if (!draft.title.trim()) return setMessage({ kind: 'err', text: 'Give the lesson a title.' })
                      startTransition(async () => {
                        const result = await saveLesson({
                          classId,
                          title: draft.title.trim(),
                          date: draft.date || todayInNewYork(),
                          topics: draft.topics.split(',').map((t) => t.trim()).filter(Boolean),
                          notes: draft.notes.trim() || undefined,
                          links: draft.links.filter((l) => l.url.trim()),
                          assignedToId: draft.assignedToId || undefined,
                          status: 'TAUGHT',
                        })
                        if (!result.ok) return setMessage({ kind: 'err', text: result.error })
                        setMessage({ kind: 'ok', text: 'Lesson logged as taught.' })
                        setDraft(null)
                        router.refresh()
                      })
                    }}
                    className={cn(buttonClass('secondary'), 'w-full')}
                  >
                    <Check className="h-4 w-4" aria-hidden /> Log as taught
                  </button>
                )}
              </div>
            </div>
          )}
        </Card>

        <Card title="Copy from another class" icon={<Copy className="h-4 w-4" aria-hidden />}>
          {copySources.length === 0 ? (
            <p className="text-[12.5px] text-parch-500">There is no other class you can copy from.</p>
          ) : (
            <div>
              <p className="mb-3 text-[12.5px] text-parch-600">
                Copies lessons into <span className="font-bold text-brand-950">{className}</span> as new
                planned rows. The other class is never changed.
              </p>
              <Field label="Copy from" htmlFor="copy-from">
                <select id="copy-from" value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)} className={selectClass}>
                  {copySources.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </Field>
              <label className="mb-3 flex min-h-[40px] items-center gap-2 text-[12.5px] text-parch-700">
                <input
                  type="checkbox"
                  checked={copyPlannedOnly}
                  onChange={(e) => setCopyPlannedOnly(e.target.checked)}
                  className={checkboxClass}
                />
                Planned lessons only
              </label>
              {candidates === null ? (
                <button type="button" onClick={browseSource} disabled={pending} className={cn(buttonClass('secondary'), 'w-full')}>
                  <Copy className="h-4 w-4" aria-hidden /> {pending ? 'Loading…' : 'Choose lessons'}
                </button>
              ) : candidates.lessons.length === 0 ? (
                <p className="text-[12.5px] text-parch-500">{candidates.sourceName} has no lessons to copy.</p>
              ) : (
                <>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">
                      {picked.size} of {candidates.lessons.length} chosen
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setPicked(
                          picked.size === candidates.lessons.length
                            ? new Set()
                            : new Set(candidates.lessons.map((l) => l.id)),
                        )
                      }
                      className="text-[11px] font-bold text-brand-800 underline"
                    >
                      {picked.size === candidates.lessons.length ? 'Clear' : 'Select all'}
                    </button>
                  </div>
                  <ul className="mb-3 max-h-[240px] space-y-1 overflow-y-auto rounded-[10px] border border-parch-200 bg-parch-50 p-2">
                    {candidates.lessons
                      .filter((l) => !copyPlannedOnly || l.status === 'PLANNED')
                      .map((l) => (
                        <li key={l.id}>
                          <label className="flex min-h-[36px] cursor-pointer items-start gap-2 px-1 py-1 text-[12.5px]">
                            <input
                              type="checkbox"
                              className={cn(checkboxClass, 'mt-0.5')}
                              checked={picked.has(l.id)}
                              onChange={() =>
                                setPicked((prev) => {
                                  const next = new Set(prev)
                                  if (next.has(l.id)) next.delete(l.id)
                                  else next.add(l.id)
                                  return next
                                })
                              }
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-semibold text-parch-800">{l.title}</span>
                              <span className="block text-[11px] text-parch-500">
                                {l.date ?? 'No date'} · {l.status === 'TAUGHT' ? 'Taught' : 'Planned'}
                                {l.alreadyThere && <span className="text-[#B45309]"> · already here</span>}
                              </span>
                            </span>
                          </label>
                        </li>
                      ))}
                  </ul>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={copy}
                      disabled={pending || picked.size === 0}
                      className={cn(buttonClass('primary'), 'flex-1')}
                    >
                      <Copy className="h-4 w-4" aria-hidden /> {pending ? 'Copying…' : `Copy ${picked.size}`}
                    </button>
                    <button type="button" onClick={() => { setCandidates(null); setPicked(new Set()) }} className={buttonClass('secondary')}>
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

/**
 * The prototype's lesson card: a gold uppercase date line, a Playfair title,
 * topic chips, the servant as an avatar row, then the links as gold pills.
 */
function LessonCard({
  lesson,
  pending,
  confirming,
  onEdit,
  onToggle,
  onAskDelete,
  onCancelDelete,
  onDelete,
}: {
  lesson: LessonView
  pending: boolean
  confirming: boolean
  onEdit: () => void
  onToggle: () => void
  onAskDelete: () => void
  onCancelDelete: () => void
  onDelete: () => void
}) {
  const taught = lesson.status === 'TAUGHT'
  return (
    <li className="flex flex-col rounded-[16px] border border-parch-200 border-l-[3px] border-l-brand-gold bg-parch-50 p-4 shadow-card">
      <div className="mb-1 flex items-start justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.5px] text-brand-gold-dark">
          {lesson.date ? formatLongDate(lesson.date) : 'No date yet'}
        </p>
        <Badge tone={taught ? 'good' : 'gold'}>{taught ? 'Taught' : 'Planned'}</Badge>
      </div>

      <h3 className="mb-2 font-serif text-[16px] font-bold leading-snug text-parch-900">{lesson.title}</h3>

      {lesson.topics.length > 0 && (
        <ul className="mb-2.5 flex flex-wrap gap-1.5">
          {lesson.topics.map((topic, i) => (
            <li
              key={i}
              className="rounded-[10px] bg-brand-wash px-2.5 py-[3px] text-[11px] font-bold text-brand-gold-dark"
            >
              {topic}
            </li>
          ))}
        </ul>
      )}

      <div className="mb-2.5 flex items-center gap-2">
        {lesson.assignedToName ? (
          <>
            <Avatar name={lesson.assignedToName} size="sm" />
            <span className="truncate text-[12px] font-semibold text-parch-700">{lesson.assignedToName}</span>
          </>
        ) : (
          <span className="text-[12px] text-parch-400">Unassigned</span>
        )}
      </div>

      {lesson.notes && (
        <p className="mb-2.5 whitespace-pre-line text-[12.5px] leading-relaxed text-parch-700">{lesson.notes}</p>
      )}

      {lesson.links.length > 0 && (
        <ul className="mb-2.5 flex flex-wrap gap-2">
          {lesson.links.map((link, i) => (
            <li key={i}>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-gold bg-brand-wash px-3 py-1.5 text-[11.5px] font-bold text-brand-gold-dark transition-colors hover:bg-brand-gold hover:text-parch-50"
              >
                <Link2 className="h-3.5 w-3.5" aria-hidden /> {link.label}
              </a>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto flex flex-wrap gap-1.5 border-t border-[#F5F2ED] pt-2.5 print:hidden">
        <button
          type="button"
          onClick={onToggle}
          disabled={pending}
          className={buttonClass(taught ? 'ghost' : 'gold', 'sm')}
          title={taught ? 'Move back to planned' : 'Mark as taught'}
        >
          {taught ? <Undo2 className="h-4 w-4" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
          <span>{taught ? 'Planned' : 'Taught'}</span>
        </button>
        <button type="button" onClick={onEdit} disabled={pending} className={buttonClass('secondary', 'sm')}>
          <Pencil className="h-4 w-4" aria-hidden />
          <span className="sr-only">Edit {lesson.title}</span>
        </button>
        {confirming ? (
          <>
            <button type="button" onClick={onDelete} disabled={pending} className={buttonClass('danger', 'sm')}>
              Delete
            </button>
            <button type="button" onClick={onCancelDelete} className={buttonClass('ghost', 'sm')}>
              Keep
            </button>
          </>
        ) : (
          <button type="button" onClick={onAskDelete} disabled={pending} className={buttonClass('secondary', 'sm')}>
            <Trash2 className="h-4 w-4" aria-hidden />
            <span className="sr-only">Delete {lesson.title}</span>
          </button>
        )}
      </div>
    </li>
  )
}

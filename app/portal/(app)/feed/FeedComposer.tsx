'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'
import { createPost, updatePost } from '@/lib/portal/actions/feed'
import { FEED_TAGS, type FeedTagKey } from '@/lib/portal/data/feed'
import { Card, Field, inputClass, selectClass, textareaClass, buttonClass } from '@/components/portal/ui'
import { cn } from '@/lib/utils'

export interface ComposerPost {
  id: string
  title: string
  body: string | null
  imageUrl: string | null
  link: string | null
  linkLabel: string | null
  tag: FeedTagKey
}

interface Props {
  classId: string
  /** Present when editing an existing post. */
  post?: ComposerPost
  onDone?: () => void
  onCancel?: () => void
}

export function FeedComposer({ classId, post, onDone, onCancel }: Props) {
  const editing = !!post
  const router = useRouter()
  const [open, setOpen] = useState(editing)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    title: post?.title ?? '',
    body: post?.body ?? '',
    imageUrl: post?.imageUrl ?? '',
    link: post?.link ?? '',
    linkLabel: post?.linkLabel ?? '',
    tag: (post?.tag ?? 'ANNOUNCEMENT') as FeedTagKey,
  })

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function close() {
    setOpen(false)
    setError('')
    onCancel?.()
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const payload = {
      title: form.title,
      body: form.body || undefined,
      imageUrl: form.imageUrl || undefined,
      link: form.link || undefined,
      linkLabel: form.linkLabel || undefined,
      tag: form.tag,
    }
    startTransition(async () => {
      const result = editing
        ? await updatePost({ ...payload, postId: post!.id })
        : await createPost({ ...payload, classId })
      if (!result.ok) {
        setError(result.error)
        return
      }
      if (!editing) {
        setForm({ title: '', body: '', imageUrl: '', link: '', linkLabel: '', tag: 'ANNOUNCEMENT' })
        setOpen(false)
      }
      onDone?.()
      router.refresh()
    })
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={cn(buttonClass('primary'), 'w-full sm:w-auto')}>
        <Plus className="h-4 w-4" aria-hidden /> Write a post
      </button>
    )
  }

  const body = (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_11rem]">
        <Field label="Title" htmlFor="post-title">
          <input
            id="post-title"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            className={inputClass}
            maxLength={120}
            required
            placeholder="e.g. This Sunday's lesson"
          />
        </Field>
        <Field label="Tag" htmlFor="post-tag">
          <select id="post-tag" value={form.tag} onChange={(e) => set('tag', e.target.value as FeedTagKey)} className={selectClass}>
            {FEED_TAGS.map((t) => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Message" htmlFor="post-body">
        <textarea
          id="post-body"
          value={form.body}
          onChange={(e) => set('body', e.target.value)}
          className={textareaClass}
          rows={4}
          maxLength={4000}
          placeholder="What do you want the class to know?"
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Image URL" htmlFor="post-image" hint="Optional. Must start with https://">
          <input id="post-image" value={form.imageUrl} onChange={(e) => set('imageUrl', e.target.value)} className={inputClass} maxLength={500} inputMode="url" placeholder="https://…" />
        </Field>
        <Field label="Link" htmlFor="post-link" hint="Optional. Slides, a video, a form…">
          <input id="post-link" value={form.link} onChange={(e) => set('link', e.target.value)} className={inputClass} maxLength={500} inputMode="url" placeholder="https://…" />
        </Field>
      </div>

      {form.link && (
        <Field label="Link label" htmlFor="post-link-label" hint="Shown on the button. Defaults to “Open link”.">
          <input id="post-link-label" value={form.linkLabel} onChange={(e) => set('linkLabel', e.target.value)} className={inputClass} maxLength={60} placeholder="Open link" />
        </Field>
      )}

      {error && <p role="alert" className="text-[12px] font-bold text-red-700">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending || !form.title.trim()} className={buttonClass('primary')}>
          {pending ? 'Saving…' : editing ? 'Save changes' : 'Post to the class'}
        </button>
        <button type="button" onClick={close} disabled={pending} className={buttonClass('secondary')}>
          <X className="h-4 w-4" aria-hidden /> Cancel
        </button>
      </div>
    </form>
  )

  return editing ? (
    <div className="rounded-[12px] border border-parch-200 bg-parch-100/60 p-3.5">{body}</div>
  ) : (
    <Card title="New post" tone="brand" icon={<Plus className="h-3.5 w-3.5" aria-hidden />}>
      {body}
    </Card>
  )
}

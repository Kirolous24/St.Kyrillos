'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { BookOpen, ExternalLink, Link2, Megaphone, PartyPopper, Pencil, Pin, PinOff, Play, Trash2 } from 'lucide-react'
import { deletePost, togglePin, toggleReaction } from '@/lib/portal/actions/feed'
import { REACTIONS, FEED_TAGS, FEED_TAG_TONE, type FeedTagKey, type FeedPostView } from '@/lib/portal/data/feed'
import { formatDateTime } from '@/lib/portal/format'
import { youtubeId, youtubeThumbnail } from '@/lib/portal/links'
import { Card, Badge, Avatar } from '@/components/portal/ui'
import { cn } from '@/lib/utils'
import { FeedComposer } from './FeedComposer'

/** The prototype tagged every post with a small glyph beside its label. */
const TAG_ICON: Record<FeedTagKey, typeof BookOpen> = {
  LESSON: BookOpen,
  ANNOUNCEMENT: Megaphone,
  RESOURCE: Link2,
  EVENT: PartyPopper,
}

/**
 * Church time on both sides of the comparison, not the server's. On the evening
 * of 31 December the server clock is already in the new year while the church
 * is not, and a post would sprout a year label hours early.
 */
const CHURCH_YEAR = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric' })
const CHURCH_DATE_WITH_YEAR = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

/**
 * "12m ago" / "3h ago" / "Yesterday", exactly as the prototype's feed read.
 *
 * F0284 — anything older than a day used to fall through to formatDateTime,
 * which prints month, day and time and no year at all: a lesson posted in
 * September 2024 read "Sep 20, 9:15 AM" and sat in the feed looking like last
 * week's. A post from any other year now says which year it came from.
 */
function relativeTime(iso: string): string {
  const then = new Date(iso)
  const mins = Math.floor((Date.now() - then.getTime()) / 60_000)
  if (!Number.isFinite(mins)) return ''
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'Yesterday'
  if (CHURCH_YEAR.format(then) !== CHURCH_YEAR.format(new Date())) return CHURCH_DATE_WITH_YEAR.format(then)
  return formatDateTime(then)
}

export function PostCard({ post, classId, canManage }: { post: FeedPostView; classId: string; canManage: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError('')
    startTransition(async () => {
      const result = await fn()
      if (!result.ok) setError(result.error ?? 'Something went wrong.')
      router.refresh()
    })
  }

  const tagLabel = FEED_TAGS.find((t) => t.key === post.tag)?.label ?? post.tag
  const TagIcon = TAG_ICON[post.tag]
  const total = REACTIONS.reduce((n, r) => n + post.counts[r.kind], 0)

  return (
    <Card
      /* F0277 — the prototype's 3px coloured left edge, keyed to the tag: green
         lesson, blue announcement, amber resource, purple event. Scrolling a
         class feed, the bar is what tells a student "this one is a lesson"
         before a word is read; the small badge up in the byline only says so
         afterwards. Card's own gold left edge is overridden here — the pinned
         classes come first deliberately, so twMerge keeps the tag colour on a
         pinned post instead of dropping it. */
      className={cn(
        post.pinned && 'border-brand-gold/60 shadow-panel',
        'border-l-[3px]',
        {
          LESSON: 'border-l-[#1D9E75]',
          ANNOUNCEMENT: 'border-l-[#2F6FB0]',
          RESOURCE: 'border-l-[#C89B3C]',
          EVENT: 'border-l-[#7C5CBF]',
        }[post.tag],
      )}
      bodyClassName="p-0"
    >
      <article>
        {/* Pinned banner (.feed pinned strip) — burgundy with gold lettering. */}
        {post.pinned && (
          <p className="flex items-center gap-1.5 bg-brand-950 px-4 py-[7px] text-[11px] font-bold uppercase tracking-[0.8px] text-brand-gold">
            <Pin className="h-3.5 w-3.5" aria-hidden /> Pinned
          </p>
        )}

        {post.imageUrl && !editing && (
          <div className="px-[18px] pt-3.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.imageUrl}
              alt=""
              loading="lazy"
              className="block h-[158px] w-full max-w-[280px] rounded-[10px] border border-parch-200 object-cover"
            />
          </div>
        )}

        <div className="px-[18px] py-3.5">
          {/* Byline row: avatar, author, relative time, tag pill. */}
          <div className="mb-2.5 flex items-center gap-2.5">
            <Avatar name={post.authorName || 'Sunday School'} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-bold text-parch-900">{post.authorName || 'Sunday School'}</p>
              <p className="truncate text-[11px] text-parch-500">
                {relativeTime(post.createdAt)}
                {post.edited && ' · edited'}
              </p>
            </div>
            <span className="shrink-0">
              <Badge tone={FEED_TAG_TONE[post.tag]}>
                <TagIcon className="h-3 w-3" aria-hidden /> {tagLabel}
              </Badge>
            </span>
          </div>

          {editing ? (
            <FeedComposer
              classId={classId}
              post={{ id: post.id, title: post.title, body: post.body, imageUrl: post.imageUrl, link: post.link, linkLabel: post.linkLabel, tag: post.tag }}
              onDone={() => setEditing(false)}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <>
              <h3 className="font-serif text-[15px] font-bold leading-snug text-parch-900">{post.title}</h3>
              {post.body && (
                <p className="mt-1.5 whitespace-pre-line text-[12.5px] leading-[1.65] text-parch-700">{post.body}</p>
              )}
              {/* F0272 / F0503 — every link was the same grey "Open link" pill,
                  so a child scrolling the feed could not tell which post held
                  the hymn recording the servant had talked about without
                  opening each one. A YouTube link now opens as the video's own
                  still with a play badge, the way the prototype drew it.
                  The pill stays underneath in both cases on purpose: the link
                  is then never only a picture, which keeps it reachable if the
                  still fails to load or the reader is using a screen reader. */}
              {post.link &&
                (() => {
                  // Captured so TypeScript keeps the narrowing inside the IIFE.
                  const link = post.link
                  const ytId = youtubeId(link)
                  return (
                    <>
                      {ytId && (
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          data-youtube={ytId}
                          aria-label={`Watch on YouTube: ${post.linkLabel || post.title}`}
                          className="group relative mt-2.5 block w-[280px] max-w-full overflow-hidden rounded-[10px] border border-parch-200"
                        >
                          <Image
                            src={youtubeThumbnail(ytId)}
                            alt=""
                            width={480}
                            height={360}
                            className="block h-[158px] w-full object-cover"
                          />
                          <span
                            aria-hidden
                            className="absolute inset-0 grid place-items-center bg-black/25 transition-colors group-hover:bg-black/10"
                          >
                            <span className="grid h-[46px] w-[46px] place-items-center rounded-full bg-[#FF0000] shadow-[0_3px_12px_rgba(0,0,0,.4)]">
                              <Play className="h-[18px] w-[18px] translate-x-[1px] fill-white text-white" />
                            </span>
                          </span>
                        </a>
                      )}
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2.5 inline-flex min-h-[40px] items-center gap-1.5 rounded-[10px] border border-parch-200 bg-parch-100 px-3.5 text-[12px] font-bold text-brand-800 transition-colors hover:border-brand-gold/60 hover:bg-brand-wash"
                      >
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                        {post.linkLabel || (ytId ? 'Watch on YouTube' : 'Open link')}
                      </a>
                    </>
                  )
                })()}
            </>
          )}
        </div>

        <footer className="flex flex-wrap items-center gap-1.5 border-t border-[#F3F0EB] px-[18px] py-2.5">
          {REACTIONS.map((r) => {
            const mine = post.mine.includes(r.kind)
            const count = post.counts[r.kind]
            /* F0286 — each reaction lights up in its own colour again: red
               heart, gold prayer, green thumb, the prototype's own values. All
               three shared one gold state, so a student glancing back at a post
               could not tell which of the three they had already pressed
               without stopping to read the counts. */
            const active = {
              HEART: 'border-[#E24B4A] bg-[#FFF0F0] font-bold text-[#E24B4A]',
              PRAY: 'border-[#C89B3C] bg-[#FEF3E0] font-bold text-[#C89B3C]',
              LIKE: 'border-[#1D9E75] bg-[#EDFAF5] font-bold text-[#1D9E75]',
            }[r.kind]
            return (
              <button
                key={r.kind}
                type="button"
                disabled={pending}
                aria-pressed={mine}
                aria-label={`${r.label}${count ? ` (${count})` : ''}`}
                onClick={() => run(() => toggleReaction({ postId: post.id, kind: r.kind }))}
                className={cn(
                  'inline-flex min-h-[40px] items-center gap-1.5 rounded-[20px] border px-3 text-[12px] transition-colors disabled:opacity-60',
                  mine
                    ? active
                    : 'border-parch-200 bg-parch-50 font-semibold text-parch-500 hover:border-brand-gold/50 hover:text-brand-800',
                )}
              >
                <span aria-hidden>{r.emoji}</span>
                <span className="tabular-nums">{count}</span>
              </button>
            )
          })}
          {total > 0 && (
            <span className="ml-0.5 text-[11px] text-parch-500">
              {total} reaction{total === 1 ? '' : 's'}
            </span>
          )}

          {canManage && !editing && (
            <div className="ml-auto flex items-center gap-1 print:hidden">
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => togglePin(post.id))}
                className="inline-flex min-h-[40px] items-center gap-1 rounded-[10px] px-2.5 text-[11px] font-bold uppercase tracking-[0.5px] text-parch-500 transition-colors hover:bg-brand-wash hover:text-brand-800"
              >
                {post.pinned ? <PinOff className="h-3.5 w-3.5" aria-hidden /> : <Pin className="h-3.5 w-3.5" aria-hidden />}
                {post.pinned ? 'Unpin' : 'Pin'}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setEditing(true)}
                className="inline-flex min-h-[40px] items-center gap-1 rounded-[10px] px-2.5 text-[11px] font-bold uppercase tracking-[0.5px] text-parch-500 transition-colors hover:bg-brand-wash hover:text-brand-800"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
              </button>
              {confirming ? (
                <span className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => deletePost(post.id))}
                    className="inline-flex min-h-[40px] items-center rounded-[10px] bg-red-700 px-2.5 text-[11px] font-bold text-parch-50 hover:bg-red-800"
                  >
                    {pending ? 'Deleting…' : 'Delete for good'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    className="inline-flex min-h-[40px] items-center rounded-[10px] px-2.5 text-[11px] font-bold text-parch-500 hover:text-brand-800"
                  >
                    Keep
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setConfirming(true)}
                  className="inline-flex min-h-[40px] items-center gap-1 rounded-[10px] px-2.5 text-[11px] font-bold uppercase tracking-[0.5px] text-parch-500 transition-colors hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete
                </button>
              )}
            </div>
          )}
        </footer>

        {error && (
          <p role="alert" className="border-t border-red-200 bg-red-50 px-[18px] py-2 text-[12.5px] font-semibold text-red-800">
            {error}
          </p>
        )}
      </article>
    </Card>
  )
}

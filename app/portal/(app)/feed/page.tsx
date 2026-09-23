import Link from 'next/link'
import { MessageSquare } from 'lucide-react'
import { requirePortalUser } from '@/lib/portal/session'
import { listVisibleClasses, requireClassAccess } from '@/lib/portal/data/classes'
import { listClassFeedPage, canAuthorClassContent, FEED_TAGS } from '@/lib/portal/data/feed'
import { PageHeader, EmptyState, Callout, buttonClass } from '@/components/portal/ui'
import { cn } from '@/lib/utils'
import { ClassPicker } from '@/components/portal/ClassPicker'
import { FeedComposer } from './FeedComposer'
import { PostCard } from './PostCard'

export const metadata = { title: 'Class Posts' }

export default async function FeedPage({
  searchParams,
}: {
  searchParams: { class?: string; tag?: string }
}) {
  const user = await requirePortalUser()
  const classes = await listVisibleClasses(user)

  if (classes.length === 0) {
    return (
      <>
        <PageHeader title="Class Posts" subtitle="Updates from your class." />
        <EmptyState
          title="No class yet"
          hint="Once you are assigned to a class, its posts appear here."
        />
      </>
    )
  }

  const requested = searchParams.class
  const classId = classes.some((c) => c.id === requested) ? requested! : classes[0].id
  // Not a rendering decision: this 404s when the class is out of reach.
  const cls = await requireClassAccess(user, classId, 'class.read')

  const FEED_LIMIT = 40
  const { posts, total } = await listClassFeedPage(cls.id, user.accountId, FEED_LIMIT)
  const canPost = canAuthorClassContent(user, cls.id)
  // F0273 — the prototype's tag chips. `tag` already rides on every post; the
  // page just never let anyone filter by it, so finding "that resource link
  // from a month ago" meant scrolling the whole feed.
  const activeTag = FEED_TAGS.some((t) => t.key === searchParams.tag) ? searchParams.tag! : null
  const shown = activeTag ? posts.filter((p) => p.tag === activeTag) : posts
  const pinned = shown.filter((p) => p.pinned)
  const rest = shown.filter((p) => !p.pinned)
  const tagHref = (key: string | null) =>
    `/portal/feed?class=${encodeURIComponent(cls.id)}${key ? `&tag=${key}` : ''}`

  return (
    <>
      {/* F0327 — the prototype kept 📰 Posts and 📖 Today's Readings side by side
          on the same screen. Here the readings live only in the sidebar, so a
          servant who had the feed open to check what was posted had to leave it
          and hunt for Readings to read the day's Gospel to the class. The
          readings page has no role gate beyond requirePortalUser, so this
          resolves for every role that can open a feed — student, servant, admin
          and pastor alike. */}
      <PageHeader
        title="Class Posts"
        subtitle={`Lessons, resources and news for ${cls.name}.`}
        actions={
          <Link href="/portal/readings" className={buttonClass('secondary')}>
            Today’s Readings
          </Link>
        }
      />

      {(classes.length > 1 || canPost) && (
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between print:hidden">
          {classes.length > 1 ? (
            <ClassPicker value={cls.id} options={classes.map((c) => ({ id: c.id, name: c.name }))} allowAll={false} />
          ) : (
            <span />
          )}
          {canPost && <FeedComposer classId={cls.id} />}
        </div>
      )}

      {/* One chip per tag that actually appears in this feed, so no chip ever
          filters to nothing. */}
      {posts.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5 print:hidden">
          {[{ key: null as string | null, label: 'All' }, ...FEED_TAGS.filter((t) => posts.some((p) => p.tag === t.key))].map(
            (t) => {
              const active = t.key === activeTag
              return (
                <Link
                  key={t.key ?? 'all'}
                  href={tagHref(t.key)}
                  aria-current={active ? 'true' : undefined}
                  className={cn(
                    'rounded-[20px] border px-3 py-1 text-[11.5px] font-bold transition-colors',
                    active
                      ? 'border-brand-gold bg-brand-wash text-brand-800'
                      : 'border-parch-200 text-parch-600 hover:border-brand-gold hover:text-brand-800',
                  )}
                >
                  {t.label}
                </Link>
              )
            },
          )}
        </div>
      )}

      {shown.length === 0 && activeTag ? (
        <EmptyState
          title="Nothing tagged that yet"
          action={
            <Link href={tagHref(null)} className="text-[12.5px] font-semibold text-brand-800 underline">
              Show every post
            </Link>
          }
        />
      ) : posts.length === 0 ? (
        <EmptyState
          title="Nothing posted yet"
          hint={canPost ? 'Share this week’s lesson, a photo, or a link to start the feed.' : 'Your servants will post lessons and news here.'}
        />
      ) : (
        <div className="space-y-3">
          {pinned.map((p) => (
            <PostCard key={p.id} post={p} classId={cls.id} canManage={canPost} />
          ))}

          {pinned.length > 0 && rest.length > 0 && (
            <p className="flex items-center gap-2 pt-1 text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">
              <MessageSquare className="h-3.5 w-3.5 text-brand-gold-dark" aria-hidden />
              Earlier posts
              <span aria-hidden className="h-px flex-1 bg-parch-200" />
            </p>
          )}

          {rest.map((p) => (
            <PostCard key={p.id} post={p} classId={cls.id} canManage={canPost} />
          ))}

          {/* F0276 — the feed stopped at 40 and said nothing, so older posts
              were both unreachable and unmentioned. There is still no paging;
              at least the page no longer pretends this is all of it. */}
          {total > posts.length && (
            <p className="pt-1 text-center text-[12px] text-parch-500">
              Showing the {posts.length} most recent of {total} posts.
            </p>
          )}
        </div>
      )}

      {!canPost && posts.length > 0 && (
        <div className="mt-5">
          <Callout tone="info">Tap a reaction to let your servants know you read a post.</Callout>
        </div>
      )}
    </>
  )
}

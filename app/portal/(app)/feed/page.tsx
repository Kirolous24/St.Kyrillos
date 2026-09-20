import { MessageSquare } from 'lucide-react'
import { requirePortalUser } from '@/lib/portal/session'
import { listVisibleClasses, requireClassAccess } from '@/lib/portal/data/classes'
import { listClassFeed, canAuthorClassContent } from '@/lib/portal/data/feed'
import { PageHeader, EmptyState, Callout } from '@/components/portal/ui'
import { ClassPicker } from '@/components/portal/ClassPicker'
import { FeedComposer } from './FeedComposer'
import { PostCard } from './PostCard'

export const metadata = { title: 'Class Posts' }

export default async function FeedPage({ searchParams }: { searchParams: { class?: string } }) {
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

  const posts = await listClassFeed(cls.id, user.accountId)
  const canPost = canAuthorClassContent(user, cls.id)
  const pinned = posts.filter((p) => p.pinned)
  const rest = posts.filter((p) => !p.pinned)

  return (
    <>
      <PageHeader
        title="Class Posts"
        subtitle={`Lessons, resources and news for ${cls.name}.`}
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

      {posts.length === 0 ? (
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

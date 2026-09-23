import { prisma } from '@/lib/prisma'
import type { PortalUser } from '../permissions'
import { PortalError } from '../action-result'
import { assertClassAction } from './classes'

export type FeedTagKey = 'LESSON' | 'ANNOUNCEMENT' | 'RESOURCE' | 'EVENT'
export type ReactionKindKey = 'HEART' | 'PRAY' | 'LIKE'

export const FEED_TAGS: ReadonlyArray<{ key: FeedTagKey; label: string }> = [
  { key: 'LESSON', label: 'Lesson' },
  { key: 'ANNOUNCEMENT', label: 'Announcement' },
  { key: 'RESOURCE', label: 'Resource' },
  { key: 'EVENT', label: 'Event' },
]

export const REACTIONS: ReadonlyArray<{ kind: ReactionKindKey; emoji: string; label: string }> = [
  { kind: 'HEART', emoji: '❤️', label: 'Love' },
  { kind: 'PRAY', emoji: '🙏', label: 'Pray' },
  { kind: 'LIKE', emoji: '👍', label: 'Like' },
]

export const FEED_TAG_TONE: Record<FeedTagKey, 'brand' | 'gold' | 'info' | 'good'> = {
  LESSON: 'brand',
  ANNOUNCEMENT: 'gold',
  RESOURCE: 'info',
  EVENT: 'good',
}

/**
 * Who may write into a class feed: a servant assigned to that class, or an
 * admin. The permission table has no feed-specific action, and the three
 * class-write actions it does have all mean exactly "assigned servant or
 * admin" — rather than borrow one of them and blur its meaning, class content
 * authoring gets this named predicate. Pastors read feeds but do not post to
 * them (they have their own announcement and event powers).
 */
export function canAuthorClassContent(user: PortalUser, classId: string): boolean {
  if (user.role === 'ADMIN') return true
  return user.role === 'SERVANT' && user.classIds.includes(classId)
}

/**
 * Server-action guard for feed writes: the class must be one the user can see
 * at all (this throws when it is not), and then they must be allowed to author
 * in it.
 */
export async function assertClassContentWrite(user: PortalUser, classId: string) {
  const cls = await assertClassAction(user, classId, 'class.read')
  if (!canAuthorClassContent(user, classId)) {
    throw new PortalError('Only servants of this class can post here.')
  }
  return cls
}

export interface FeedPostView {
  id: string
  title: string
  body: string | null
  imageUrl: string | null
  link: string | null
  linkLabel: string | null
  tag: FeedTagKey
  pinned: boolean
  /**
   * The stored author name. The prototype wrote `createdByName` and rendered
   * `authorName`, so every post showed a blank byline (ANALYSIS §6). We store
   * and read the same field.
   */
  authorName: string
  createdAt: string
  updatedAt: string
  edited: boolean
  counts: Record<ReactionKindKey, number>
  mine: ReactionKindKey[]
}

const POST_SELECT = {
  id: true,
  title: true,
  body: true,
  imageUrl: true,
  link: true,
  linkLabel: true,
  tag: true,
  pinned: true,
  authorName: true,
  createdAt: true,
  updatedAt: true,
  reactions: { select: { kind: true, accountId: true } },
} as const

type PostRow = {
  id: string
  title: string
  body: string | null
  imageUrl: string | null
  link: string | null
  linkLabel: string | null
  tag: FeedTagKey
  pinned: boolean
  authorName: string
  createdAt: Date
  updatedAt: Date
  reactions: Array<{ kind: ReactionKindKey; accountId: string }>
}

function toView(post: PostRow, accountId: string): FeedPostView {
  const counts: Record<ReactionKindKey, number> = { HEART: 0, PRAY: 0, LIKE: 0 }
  const mine: ReactionKindKey[] = []
  for (const r of post.reactions) {
    counts[r.kind] += 1
    if (r.accountId === accountId) mine.push(r.kind)
  }
  return {
    id: post.id,
    title: post.title,
    body: post.body,
    imageUrl: post.imageUrl,
    link: post.link,
    linkLabel: post.linkLabel,
    tag: post.tag,
    pinned: post.pinned,
    authorName: post.authorName,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    edited: post.updatedAt.getTime() - post.createdAt.getTime() > 60_000,
    counts,
    mine,
  }
}

/** Pinned first, then newest. Caller must already have proved class access. */
export async function listClassFeed(classId: string, accountId: string, take = 40): Promise<FeedPostView[]> {
  const posts = await prisma.feedPost.findMany({
    where: { classId },
    orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
    take,
    select: POST_SELECT,
  })
  return posts.map((p) => toView(p as PostRow, accountId))
}

/**
 * The class's feed together with how many posts exist in total (F0276).
 *
 * The list stops at `take` and said nothing, so a class past that many posts had
 * older ones that were simply unreachable and unmentioned. The count lets the
 * page say so rather than quietly ending.
 */
export async function listClassFeedPage(
  classId: string,
  accountId: string,
  take = 40,
): Promise<{ posts: FeedPostView[]; total: number }> {
  const [posts, total] = await Promise.all([
    listClassFeed(classId, accountId, take),
    prisma.feedPost.count({ where: { classId } }),
  ])
  return { posts, total }
}

/** Newest posts across several classes — used by the dashboard widget. */
export async function countRecentPosts(classIds: string[], since: Date): Promise<number> {
  if (classIds.length === 0) return 0
  return prisma.feedPost.count({ where: { classId: { in: classIds }, pinned: false, createdAt: { gte: since } } })
}

export async function latestPostFor(classIds: string[]): Promise<{ id: string; classId: string; title: string; authorName: string; createdAt: Date } | null> {
  if (classIds.length === 0) return null
  return prisma.feedPost.findFirst({
    where: { classId: { in: classIds } },
    orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
    select: { id: true, classId: true, title: true, authorName: true, createdAt: true },
  })
}

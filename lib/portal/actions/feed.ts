'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '../session'
import { assertClassAction } from '../data/classes'
import { assertClassContentWrite } from '../data/feed'
import { optionalHttpUrl } from '../data/community'
import { runAction, PortalError, type ActionResult } from '../action-result'
import { audit } from '../audit'

const PostSchema = z.object({
  classId: z.string().min(1),
  title: z.string().trim().min(1, 'Give the post a title.').max(120),
  body: z.string().trim().max(4000).optional(),
  imageUrl: optionalHttpUrl,
  link: optionalHttpUrl,
  linkLabel: z.string().trim().max(60).optional(),
  tag: z.enum(['LESSON', 'ANNOUNCEMENT', 'RESOURCE', 'EVENT']),
  pinned: z.boolean().optional(),
})

export type CreatePostInput = z.input<typeof PostSchema>

export async function createPost(raw: CreatePostInput): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const input = PostSchema.parse(raw)
    const cls = await assertClassContentWrite(user, input.classId)

    const post = await prisma.feedPost.create({
      data: {
        classId: cls.id,
        title: input.title,
        body: input.body || null,
        imageUrl: input.imageUrl,
        link: input.link,
        linkLabel: input.link ? input.linkLabel || 'Open link' : null,
        tag: input.tag,
        pinned: input.pinned ?? false,
        authorId: user.accountId,
        // Stored here AND read back from here. The prototype wrote
        // `createdByName` and rendered `authorName`, so no post ever showed
        // its author (ANALYSIS §6).
        authorName: user.displayName,
      },
      select: { id: true },
    })

    await audit(user, 'feed.create', 'post', post.id, `${cls.name}: posted "${input.title}"`)
    revalidatePath('/portal/feed')
    revalidatePath('/portal')
    return { id: post.id }
  })
}

const UpdateSchema = PostSchema.omit({ classId: true, pinned: true }).extend({ postId: z.string().min(1) })

export type UpdatePostInput = z.input<typeof UpdateSchema>

async function loadPost(postId: string) {
  const post = await prisma.feedPost.findUnique({
    where: { id: postId },
    select: { id: true, classId: true, title: true, pinned: true },
  })
  if (!post) throw new PortalError('That post is no longer there.')
  return post
}

export async function updatePost(raw: UpdatePostInput): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const input = UpdateSchema.parse(raw)
    const post = await loadPost(input.postId)
    const cls = await assertClassContentWrite(user, post.classId)

    await prisma.feedPost.update({
      where: { id: post.id },
      data: {
        title: input.title,
        body: input.body || null,
        imageUrl: input.imageUrl,
        link: input.link,
        linkLabel: input.link ? input.linkLabel || 'Open link' : null,
        tag: input.tag,
      },
    })

    await audit(user, 'feed.update', 'post', post.id, `${cls.name}: edited "${input.title}"`)
    revalidatePath('/portal/feed')
    return undefined
  })
}

export async function deletePost(postId: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const post = await loadPost(z.string().min(1).parse(postId))
    const cls = await assertClassContentWrite(user, post.classId)

    await prisma.feedPost.delete({ where: { id: post.id } })

    await audit(user, 'feed.delete', 'post', post.id, `${cls.name}: deleted "${post.title}"`)
    revalidatePath('/portal/feed')
    revalidatePath('/portal')
    return undefined
  })
}

export async function togglePin(postId: string): Promise<ActionResult<{ pinned: boolean }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const post = await loadPost(z.string().min(1).parse(postId))
    const cls = await assertClassContentWrite(user, post.classId)

    // The current value comes from the row, never from the client.
    const pinned = !post.pinned
    /**
     * F0282 — pinning must not mark the notice "edited".
     *
     * `edited` is worked out from `updatedAt` against `createdAt`, and
     * `@updatedAt` moves on every Prisma `update` — so moving a notice to the
     * top of the feed stamped it as rewritten when nobody had changed a word.
     * On a feed that carries church notices to children and parents, being able
     * to tell whether a notice was altered after it was posted is worth keeping,
     * so the fix is to write the pin without touching the stamp rather than to
     * drop the label. Raw SQL is the only way past `@updatedAt`; the id comes
     * from a row already loaded and permission-checked above.
     */
    await prisma.$executeRaw`UPDATE "FeedPost" SET "pinned" = ${pinned} WHERE "id" = ${post.id}`

    await audit(user, 'feed.pin', 'post', post.id, `${cls.name}: ${pinned ? 'pinned' : 'unpinned'} "${post.title}"`)
    revalidatePath('/portal/feed')
    revalidatePath('/portal')
    return { pinned }
  })
}

const ReactionSchema = z.object({
  postId: z.string().min(1),
  kind: z.enum(['HEART', 'PRAY', 'LIKE']),
})

/**
 * Toggles the signed-in account's own reaction — identity comes from the
 * session, never from the form, so nobody can react as someone else.
 */
export async function toggleReaction(raw: z.infer<typeof ReactionSchema>): Promise<ActionResult<{ on: boolean }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const input = ReactionSchema.parse(raw)
    const post = await loadPost(input.postId)
    // Reading the class is enough to react: students in the class may react.
    const cls = await assertClassAction(user, post.classId, 'class.read')

    const key = { postId_accountId_kind: { postId: post.id, accountId: user.accountId, kind: input.kind } }
    const existing = await prisma.feedReaction.findUnique({ where: key, select: { id: true } })
    if (existing) await prisma.feedReaction.delete({ where: { id: existing.id } })
    else await prisma.feedReaction.create({ data: { postId: post.id, accountId: user.accountId, kind: input.kind } })

    await audit(
      user,
      'feed.react',
      'post',
      post.id,
      `${cls.name}: ${existing ? 'removed' : 'added'} ${input.kind.toLowerCase()} on "${post.title}"`,
    )
    revalidatePath('/portal/feed')
    return { on: !existing }
  })
}

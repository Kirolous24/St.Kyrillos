'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '../session'
import { runAction, PortalError, type ActionResult } from '../action-result'
import { safeUrl } from '../agenda'
import { audit } from '../audit'
import type { PortalUser } from '../permissions'

/**
 * Hymns are church-wide, not class-scoped, so there is no class permission to
 * lean on: servants and admins maintain the book, everyone else reads it.
 */
function assertHymnWriter(user: PortalUser): void {
  if (user.role !== 'SERVANT' && user.role !== 'ADMIN') {
    throw new PortalError('Only servants and admins can change the hymn book.')
  }
}

const HymnSchema = z.object({
  id: z.string().min(1).optional(),
  title: z.string().trim().min(1, 'Give the hymn a title.').max(140),
  lyrics: z.string().trim().max(20_000).optional(),
  audioUrl: z.string().trim().max(2000).optional(),
  notes: z.string().trim().max(2000).optional(),
})

export type SaveHymnInput = z.infer<typeof HymnSchema>

export async function saveHymn(raw: SaveHymnInput): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    assertHymnWriter(user)
    const input = HymnSchema.parse(raw)

    const audioUrl = input.audioUrl ? safeUrl(input.audioUrl) : null
    if (input.audioUrl && !audioUrl) throw new PortalError('The audio link must be a http or https address.')

    const data = {
      title: input.title,
      lyrics: input.lyrics || null,
      audioUrl,
      notes: input.notes || null,
    }

    let id: string
    if (input.id) {
      const existing = await prisma.hymn.findUnique({ where: { id: input.id }, select: { id: true } })
      if (!existing) throw new PortalError('Hymn not found.')
      // The same one-title-one-hymn rule as the create path: without it a hymn
      // could be added under a temporary name and then renamed onto another's.
      const clash = await prisma.hymn.findFirst({
        where: { title: { equals: input.title, mode: 'insensitive' }, NOT: { id: existing.id } },
        select: { id: true },
      })
      if (clash) throw new PortalError('A hymn with that title is already in the book.')
      const updated = await prisma.hymn.update({ where: { id: existing.id }, data, select: { id: true } })
      id = updated.id
      await audit(user, 'hymn.update', 'hymn', id, `Edited "${input.title}"`)
    } else {
      const clash = await prisma.hymn.findFirst({
        where: { title: { equals: input.title, mode: 'insensitive' } },
        select: { id: true },
      })
      if (clash) throw new PortalError('A hymn with that title is already in the book.')
      const created = await prisma.hymn.create({
        data: { ...data, addedById: user.accountId },
        select: { id: true },
      })
      id = created.id
      await audit(user, 'hymn.create', 'hymn', id, `Added "${input.title}"`)
    }

    revalidatePath('/portal/hymns')
    return { id }
  })
}

export async function deleteHymn(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePortalUser()
    assertHymnWriter(user)
    const hymnId = z.string().min(1).parse(id)
    const hymn = await prisma.hymn.findUnique({ where: { id: hymnId }, select: { id: true, title: true } })
    if (!hymn) throw new PortalError('Hymn not found.')

    await prisma.hymn.delete({ where: { id: hymn.id } })
    await audit(user, 'hymn.delete', 'hymn', hymn.id, `Deleted "${hymn.title}"`)
    revalidatePath('/portal/hymns')
    return undefined
  })
}

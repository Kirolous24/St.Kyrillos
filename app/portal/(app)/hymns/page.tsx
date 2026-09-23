import { Music, Search, Plus, BookOpen } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '@/lib/portal/session'
import { safeUrl } from '@/lib/portal/agenda'
import { PageHeader, Card, buttonClass, inputClass, LinkButton, IconTile } from '@/components/portal/ui'
import { cn } from '@/lib/utils'
import { HymnManager } from './HymnManager'

export const metadata = { title: 'Hymns' }

export default async function HymnsPage({ searchParams }: { searchParams: { q?: string } }) {
  const user = await requirePortalUser()
  const canWrite = user.role === 'SERVANT' || user.role === 'ADMIN'
  const query = (searchParams.q ?? '').trim().slice(0, 80)

  const hymns = await prisma.hymn.findMany({
    where: query ? { title: { contains: query, mode: 'insensitive' } } : undefined,
    orderBy: { title: 'asc' },
    // F0235 — the list was silently capped at 300. A hymn book that stops
    // there gives no sign it has stopped, so a hymn that exists reads as one
    // that was never added. The church's book is nowhere near this size; the
    // bound only exists so a runaway import cannot render forever.
    take: 2000,
    select: { id: true, title: true, lyrics: true, audioUrl: true, notes: true, addedBy: { select: { displayName: true } } },
  })

  return (
    <>
      <PageHeader
        title="Hymns"
        icon={<Music className="h-5 w-5" aria-hidden />}
        subtitle={
          canWrite
            ? 'The church-wide hymn book. Everyone can read it; servants keep it up to date.'
            : 'The church-wide hymn book.'
        }
        actions={
          canWrite ? (
            // The only add control sat below the entire hymn list, so on a phone
            // adding a hymn meant scrolling past every one already there.
            <LinkButton href="#add-hymn" variant="secondary">
              <Plus className="h-4 w-4" aria-hidden /> Add hymn
            </LinkButton>
          ) : undefined
        }
      />

      {/* The prototype's "Looking for more hymns?" strip, above the book itself. */}
      <Card className="mb-4 print:hidden" bodyClassName="flex flex-wrap items-center gap-3 py-3.5">
        {/* F0238 — the prototype's icon tile. Without it the strip reads as a
            paragraph rather than a card you can act on. */}
        <IconTile accent="#C89B3C">
          <BookOpen className="h-5 w-5" aria-hidden />
        </IconTile>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-parch-900">Looking for more hymns?</p>
          <p className="text-[12px] text-parch-500">Browse the Tasbeha.org hymn library for lyrics, tunes and recordings.</p>
        </div>
        <a
          href="https://tasbeha.org/hymn_library/index.php"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 whitespace-nowrap rounded-[20px] border-[1.5px] border-brand-gold px-4 py-2 text-[12px] font-bold text-brand-800 transition-colors hover:bg-brand-wash"
        >
          Tasbeha.org ↗
        </a>
      </Card>

      <form method="get" className="mb-4 flex flex-wrap items-end gap-2 print:hidden">
        <label className="block max-w-sm flex-1">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">
            Search by title
          </span>
          <span className="relative block">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-parch-500"
              aria-hidden
            />
            <input
              type="search"
              name="q"
              defaultValue={query}
              className={cn(inputClass, 'pl-[38px]')}
              placeholder="e.g. Ten Thynou"
              maxLength={80}
            />
          </span>
        </label>
        <button type="submit" className={cn(buttonClass('secondary'), 'rounded-[20px]')}>
          <Search className="h-4 w-4" aria-hidden /> Search
        </button>
        {query && (
          <a href="/portal/hymns" className={buttonClass('ghost')}>
            Clear
          </a>
        )}
      </form>

      <HymnManager
        canWrite={canWrite}
        query={query}
        hymns={hymns.map((h) => ({
          id: h.id,
          title: h.title,
          lyrics: h.lyrics,
          audioUrl: safeUrl(h.audioUrl),
          notes: h.notes,
          addedByName: h.addedBy?.displayName ?? null,
        }))}
      />
    </>
  )
}

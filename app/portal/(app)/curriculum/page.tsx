import { notFound } from 'next/navigation'
import { BookOpen, ExternalLink, FileText, Presentation } from 'lucide-react'
import { requirePortalUser } from '@/lib/portal/session'
import {
  CURRICULUM_CORE,
  CURRICULUM_EXTRAS,
  CURRICULUM_GRADES,
  CURRICULUM_HOME,
  paletteFor,
} from '@/lib/portal/curriculum'
import { PageHeader, Card, SectionTitle } from '@/components/portal/ui'

export const metadata = { title: 'Curriculum Resources' }

/** A Coptic cross, drawn rather than imported so it inherits currentColor. */
function CopticCross({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" className={className} aria-hidden>
      <path d="M12 3v18M5 9h14M8 6h8M8 12h8" />
    </svg>
  )
}

function LinkRow({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-[12px] font-bold text-brand-gold-dark underline-offset-4 transition-colors hover:text-brand-800 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold"
    >
      <ExternalLink className="h-[13px] w-[13px] shrink-0" aria-hidden />
      {children}
    </a>
  )
}

export default async function CurriculumPage() {
  const user = await requirePortalUser()
  // Students have their own Learning section; this is teaching material.
  if (user.role === 'STUDENT') notFound()

  return (
    <>
      <PageHeader
        title="Curriculum Resources"
        icon={<BookOpen className="h-5 w-5" aria-hidden />}
        subtitle="Children of Light, Version 2 — the official Diocese curriculum. Every link opens the Google Drive file in a new tab."
        actions={<LinkRow href={CURRICULUM_HOME}>ssc.suscopts.org</LinkRow>}
      />

      <Card className="mb-5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-[12px] border border-brand-gold/35 bg-brand-wash px-4 py-3.5">
          {[...CURRICULUM_CORE, ...CURRICULUM_EXTRAS].map((l) => (
            <LinkRow key={l.url} href={l.url}>
              {l.label}
            </LinkRow>
          ))}
        </div>
      </Card>

      <SectionTitle hint={`${CURRICULUM_GRADES.length} grades`}>Books by grade</SectionTitle>

      <ul className="mt-3.5 grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {CURRICULUM_GRADES.map((g, i) => {
          const [from, to] = paletteFor(i)
          return (
            <li key={g.label} className="flex flex-col items-center gap-3">
              <a
                href={g.bookUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${g.label} book — ${g.title}`}
                className="group block w-full max-w-[220px] rounded-[14px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-gold"
              >
                <div
                  className="flex aspect-[118/154] flex-col items-center justify-between rounded-[14px] border-2 border-brand-gold/55 p-4 shadow-card transition-transform duration-200 group-hover:-translate-y-1"
                  style={{ backgroundImage: `linear-gradient(160deg, ${from} 0%, ${to} 100%)` }}
                >
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 border-brand-gold/80">
                    <CopticCross className="h-[22px] w-[22px] text-white/90" />
                  </span>
                  <span className="flex flex-1 flex-col items-center justify-center text-center">
                    <span className="mb-2 block font-body text-[10.5px] uppercase tracking-[0.8px] text-white/70">
                      Sunday School
                    </span>
                    <span className="block font-serif text-[17px] font-bold leading-snug text-white">{g.title}</span>
                  </span>
                  <span className="block font-body text-[11px] uppercase tracking-[0.8px] text-white/70">{g.label}</span>
                </div>
              </a>

              <a
                href={g.bookUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full max-w-[220px] items-center justify-center gap-1.5 truncate rounded-[24px] border-[1.5px] border-brand-gold px-3.5 py-2 text-[13px] font-bold text-brand-800 transition-colors hover:bg-brand-wash focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold"
              >
                <FileText className="h-[13px] w-[13px] shrink-0" aria-hidden />
                {g.pill}
              </a>

              {g.slidesUrl && (
                <a
                  href={g.slidesUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="-mt-1 inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-parch-600 transition-colors hover:text-brand-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold"
                >
                  <Presentation className="h-[12px] w-[12px] shrink-0" aria-hidden />
                  Slides
                </a>
              )}
            </li>
          )
        })}
      </ul>
    </>
  )
}

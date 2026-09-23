import { BookOpen, ChevronDown, ExternalLink, Flame, Sparkles } from 'lucide-react'
import { requirePortalUser } from '@/lib/portal/session'
import { listVisibleClasses } from '@/lib/portal/data/classes'
import { loadDailyReadings, readingStateFor, classCheckInsToday } from '@/lib/portal/data/community'
import { todayInNewYork } from '@/lib/portal/dates'
import { formatLongDate } from '@/lib/portal/format'
import { accentFor } from '@/lib/portal/accents'
import { groupReadingsByService } from '@/lib/portal/readings'
import { PageHeader, Card, Badge, Callout, EmptyState, StatCard } from '@/components/portal/ui'
import { RefreshReadings } from './RefreshReadings'
import { PrintButton } from '@/components/portal/PrintButton'
import { ReadingCheckIn } from './ReadingCheckIn'

export const metadata = { title: 'Daily Readings' }

export default async function ReadingsPage() {
  const user = await requirePortalUser()
  const today = todayInNewYork()

  const day = await loadDailyReadings(today)

  // A student sees their own streak; a servant sees who in their classes has
  // checked in today. Both come from the session, never from the URL.
  const reading = user.studentId ? await readingStateFor(user.studentId, today) : null
  const classes = user.role === 'STUDENT' ? [] : await listVisibleClasses(user)
  const checkIns = classes.length > 0 ? await classCheckInsToday(classes.map((c) => ({ id: c.id, name: c.name })), today) : []

  return (
    <div className="portal-print-page">
      <PageHeader
        title="Daily Readings"
        subtitle={formatLongDate(today)}
        actions={
          <>
            {reading && (
              /* The prototype's gold streak pill, parked in the banner. */
              <span className="inline-flex items-center gap-2.5 rounded-[14px] border border-brand-gold/40 bg-[linear-gradient(135deg,#FDF5E4,#FBEFD8)] px-[18px] py-2.5">
                <Flame className="h-5 w-5 text-brand-gold" aria-hidden />
                <span className="leading-none">
                  <span className="block font-serif text-[22px] font-bold leading-none text-brand-800 tabular-nums">
                    {reading.streak}
                  </span>
                  <span className="mt-0.5 block text-[9.5px] font-bold uppercase tracking-[0.6px] text-brand-gold-dark">
                    Day streak
                  </span>
                </span>
              </span>
            )}
            <PrintButton label="Print readings" />
          </>
        }
      />

      {/* Coptic date and season, on the burgundy strip the prototype used. */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-[14px] bg-brand-800 px-5 py-4">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[1px] text-brand-gold">Coptic date</p>
          <p className="mt-0.5 font-serif text-[21px] font-bold leading-tight text-parch-50">
            {day.copticDate ?? 'Coptic calendar'}
          </p>
          {day.seasonDay && <p className="mt-0.5 text-[12px] italic text-white/60">{day.seasonDay}</p>}
        </div>
        {(day.season || day.isFasting || day.feasts.length > 0) && (
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {day.season && <Badge tone="gold">{day.season}</Badge>}
            {day.isFasting && <Badge tone="warn">Fasting day</Badge>}
            {day.feasts.map((f) => (
              <Badge key={f.name} tone="good">{f.name}</Badge>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {!day.available ? (
            <div className="space-y-3">
              <EmptyState
                title="Today’s readings aren’t available yet"
                hint={
                  user.role === 'ADMIN'
                    ? 'The Coptic calendar feed hasn’t been refreshed for today. Fetching again replaces each day in place, so nothing already there is lost.'
                    : 'The Coptic calendar feed hasn’t been refreshed for today. Ask an admin to fetch it again — your reading check-in still works.'
                }
              />
              {/* F0325 — admins only. The endpoint used to clear four weeks
                  before fetching, so a failed retry left the church with
                  nothing; it now replaces each day in place. */}
              {user.role === 'ADMIN' && <RefreshReadings />}
            </div>
          ) : day.sections.length === 0 ? (
            <Callout tone="info" title="No readings listed">
              The calendar has today’s Coptic date but no reading references yet.
            </Callout>
          ) : (
            /* F0751 / F0521 — the readings sit under their three services again (OG
               L13434-13446). A flat grid of "Vespers Gospel", "Matins Gospel" and
               "Liturgy Gospel" cards makes whoever is reading at the altar scan
               every title to find the one about to be read; the church reads by
               service, not by card. Each service keeps the prototype's own glyph
               and colour, which is what F0521 asked for — on the heading, where it
               is read once, rather than repeated on all twelve cards.
               Grouping matches on the section's display label, which is this
               repo's own SECTION_LABELS constant (lib/coptic-api.ts), not on
               anything the upstream feed controls, and it is matched
               case-insensitively because those labels render uppercase. */
            <div className="space-y-5">
              {/* F0520 — the rows open to the full passage now (F0522), but nothing
                  said so: a servant printing a sheet before Matins saw a list of
                  references and no reason to touch one. Only claimed when at
                  least one row actually carries its verses — rows cached before
                  the passage text was carried through have none, and promising a
                  tap that does nothing is worse than saying nothing at all. */}
              {day.sections.some((sec) => sec.entries.some((e) => (e.verses ?? []).length > 0)) && (
                <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500 print:hidden">
                  <BookOpen className="h-3.5 w-3.5 shrink-0 text-brand-gold-dark" aria-hidden />
                  Tap a line to read the passage
                </p>
              )}
              {groupReadingsByService(day.sections).map(({ service, sections }) => (
                <section key={service.label} data-service={service.label}>
                  <p className="mb-2.5 flex items-center gap-2">
                    <span aria-hidden className="text-[13px] leading-none">
                      {service.glyph}
                    </span>
                    <span
                      className="text-[10.5px] font-bold uppercase tracking-[0.7px]"
                      style={{ color: service.colour }}
                    >
                      {service.label}
                    </span>
                    <span aria-hidden className="h-px flex-1 bg-parch-200" />
                  </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {sections.map((section) => (
                          <Card
                            key={section.section}
                            title={section.section}
                            icon={<BookOpen className="h-3.5 w-3.5" aria-hidden />}
                            bodyClassName="px-[18px] py-1"
                          >
                            <dl>
                              {section.entries.map((entry, i) => {
                                const label = entry.bookName && entry.bookName !== entry.reference ? entry.bookName : null
                                const verses = entry.verses ?? []
                                return (
                                  <div
                                    key={`${entry.reference}-${i}`}
                                    className="border-b border-[#F5F2ED] py-[9px] last:border-b-0"
                                  >
                                    {/* Tap to read it here. The port showed the reference
                                        alone, so a child was told to read Ephesians 4 and
                                        left to find a Bible. The text comes from the same
                                        response the reference does. A <details> that has
                                        been opened prints open, which is what a servant
                                        handing out a paper sheet wants. */}
                                    {verses.length > 0 ? (
                                      /* F0525 — list-none kills the native disclosure marker, so a
                                         row that opens to the whole passage looked exactly like one
                                         that does nothing. The chevron is the only thing telling a
                                         servant which of today's references they can actually read
                                         here instead of reaching for a Bible. */
                                      <details className="group">
                                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                                          <dt className="shrink-0 text-[12.5px] text-parch-500">{label ?? 'Reading'}</dt>
                                          <dd className="truncate text-right text-[12.5px] font-bold text-parch-900">
                                            {entry.reference}
                                          </dd>
                                          <ChevronDown
                                            aria-hidden
                                            className="h-3.5 w-3.5 shrink-0 text-brand-gold-dark transition-transform group-open:rotate-180"
                                          />
                                        </summary>
                                        <div className="mt-2 rounded-[10px] bg-parch-100 px-3 py-2.5">
                                          <p className="text-[13px] leading-[1.75] text-parch-800">
                                            {verses.map((v: { num: number; text: string }) => (
                                              <span key={v.num}>
                                                <sup className="mr-0.5 text-[10px] font-bold text-brand-gold-dark">{v.num}</sup>
                                                {v.text}{' '}
                                              </span>
                                            ))}
                                          </p>
                                        </div>
                                      </details>
                                    ) : (
                                      <div className="flex items-center justify-between gap-3">
                                        <dt className="shrink-0 text-[12.5px] text-parch-500">{label ?? 'Reading'}</dt>
                                        <dd className="truncate text-right text-[12.5px] font-bold text-parch-900">
                                          {entry.reference}
                                        </dd>
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </dl>
                          </Card>
                      ))}
                    </div>
                </section>
              ))}
            </div>
          )}

          {day.synaxarium.length > 0 && (
            <>
              <p className="pt-1 text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">
                <Sparkles className="mr-1 inline h-3.5 w-3.5 text-brand-gold-dark" aria-hidden />
                Saint of the day
              </p>
              <ul className="space-y-2">
                {day.synaxarium.map((s) => (
                  <li
                    key={s.name}
                    className="flex items-center justify-between gap-3 rounded-[12px] border border-parch-200 border-l-4 border-l-brand-gold bg-parch-50 px-4 py-3 shadow-card"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-bold text-parch-900">{s.name}</span>
                      <span className="block text-[11px] text-parch-500">Commemorated today</span>
                    </span>
                    {s.url && (
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-[40px] shrink-0 items-center gap-1 rounded-[8px] border border-brand-gold/50 bg-brand-wash px-3 text-[12px] font-bold text-brand-gold-dark transition-colors hover:bg-brand-50 print:hidden"
                      >
                        Read <ExternalLink className="h-3 w-3" aria-hidden />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="space-y-4 print:hidden">
          {reading && (
            <ReadingCheckIn
              checkedInToday={reading.checkedInToday}
              streak={reading.streak}
              totalDays={reading.totalDays}
              grid={reading.grid}
              monthLabel={reading.monthLabel}
            />
          )}

          {checkIns.length > 0 && (
            <Card title="Checked in today" bodyClassName="space-y-4 p-[18px]">
              {checkIns.map((c) => (
                <div key={c.classId}>
                  <StatCard
                    label={c.className}
                    value={`${c.readers.length}/${c.total}`}
                    hint={c.total === 0 ? 'No students yet' : 'read the Bible today'}
                    tone={c.readers.length > 0 ? 'good' : 'default'}
                    accent={accentFor(c.classId)}
                    icon={<BookOpen className="h-5 w-5" aria-hidden />}
                  />
                  {c.readers.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {c.readers.map((r) => (
                        <li key={r.studentId}>
                          <Badge tone="good">{r.name}</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

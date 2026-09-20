import { BookOpen, ExternalLink, Flame, Sparkles } from 'lucide-react'
import { requirePortalUser } from '@/lib/portal/session'
import { listVisibleClasses } from '@/lib/portal/data/classes'
import { loadDailyReadings, readingStateFor, classCheckInsToday } from '@/lib/portal/data/community'
import { todayInNewYork } from '@/lib/portal/dates'
import { formatLongDate } from '@/lib/portal/format'
import { accentFor } from '@/lib/portal/accents'
import { PageHeader, Card, Badge, Callout, EmptyState, StatCard } from '@/components/portal/ui'
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
            <EmptyState
              title="Today’s readings aren’t available yet"
              hint="The Coptic calendar feed hasn’t been refreshed for today. Try again a little later — your reading check-in still works."
            />
          ) : day.sections.length === 0 ? (
            <Callout tone="info" title="No readings listed">
              The calendar has today’s Coptic date but no reading references yet.
            </Callout>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {day.sections.map((section) => (
                <Card
                  key={section.section}
                  title={section.section}
                  icon={<BookOpen className="h-3.5 w-3.5" aria-hidden />}
                  bodyClassName="px-[18px] py-1"
                >
                  <dl>
                    {section.entries.map((entry, i) => {
                      const label = entry.bookName && entry.bookName !== entry.reference ? entry.bookName : null
                      return (
                        <div
                          key={`${entry.reference}-${i}`}
                          className="flex items-center justify-between gap-3 border-b border-[#F5F2ED] py-[9px] last:border-b-0"
                        >
                          <dt className="shrink-0 text-[12.5px] text-parch-500">{label ?? 'Reading'}</dt>
                          <dd className="truncate text-right text-[12.5px] font-bold text-parch-900">{entry.reference}</dd>
                        </div>
                      )
                    })}
                  </dl>
                </Card>
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

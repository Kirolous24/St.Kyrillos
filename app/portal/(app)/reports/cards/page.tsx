import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Award, CalendarCheck, GraduationCap, Users, Printer } from 'lucide-react'
import { requirePortalUser } from '@/lib/portal/session'
import { reportClasses, churchReportScope, listSessions, loadReportCards } from '@/lib/portal/data/reports'
import { exportReportCardsCsv } from '@/lib/portal/actions/reports'
import { todayInNewYork, parseDateOnly } from '@/lib/portal/dates'
import { formatLongDate } from '@/lib/portal/format'
import { attendanceBand, BAND_LABEL, prettyBadge, type Band, schoolYearMonths, RANK_MEDAL } from '@/lib/portal/reports'
import {
  PageHeader,
  Tabs,
  TabLink,
  Card,
  Badge,
  EmptyState,
  ProgressBar,
  Avatar,
  LinkButton,
  SectionTitle,
} from '@/components/portal/ui'
import { PrintButton } from '@/components/portal/PrintButton'
import { ReportFilters, CsvExportButton } from '../ReportFilters'

export const metadata = { title: 'Report cards' }

/** The Sunday School year runs September → August (ANALYSIS §5). */
function schoolYearStart(today: string): string {
  const year = Number(today.slice(0, 4))
  const month = Number(today.slice(5, 7))
  return `${month >= 9 ? year : year - 1}-09-01`
}

/**
 * The prototype's masthead line, verbatim in shape:
 * "Academic Year 2026 – 2027 (1743 Coptic)". Display only.
 */
function academicYearLabel(today: string): string {
  const year = Number(today.slice(0, 4))
  const month = Number(today.slice(5, 7))
  const start = month >= 9 ? year : year - 1
  return `Academic Year ${start} – ${start + 1} (${start - 283} Coptic)`
}

function bandTone(band: Band | null): 'good' | 'warn' | 'bad' | 'neutral' {
  if (band === 'excellent') return 'good'
  if (band === 'good') return 'warn'
  if (band === 'low') return 'bad'
  return 'neutral'
}

/** The prototype's section caption above each block of a report card. */
function SheetSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-[18px] pb-4">
      <p className="mb-2.5 border-b border-[#F3F0EB] pb-1.5 text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">
        {title}
      </p>
      {children}
    </div>
  )
}

/** One cell of the four-up stat strip under the masthead. */
function SheetStat({ value, label, color }: { value: React.ReactNode; label: string; color: string }) {
  return (
    <div className="bg-parch-50 px-1.5 py-3 text-center">
      <p className="text-[19px] font-bold leading-none tabular-nums" style={{ color }}>
        {value}
      </p>
      <p className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.5px] text-parch-500">{label}</p>
    </div>
  )
}

interface SearchParams {
  class?: string
  from?: string
  to?: string
  session?: string
  /** One child's sheet only — handing a family their own card should not print the class. */
  student?: string
}

export default async function ReportCardsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requirePortalUser()
  if (user.role === 'STUDENT') notFound()

  const today = todayInNewYork()
  // F0142 — this page offered a "Church reports" tab to everyone. A plain
  // servant has no church-wide scope, so /portal/reports?tab=church quietly
  // falls back to the Attendance tab: the tab looked like a place they could go
  // and then pretended they had never clicked it. Gated on the same scope the
  // Reports page itself uses, so the two agree.
  const [classes, sessions, churchScope] = await Promise.all([
    reportClasses(user),
    listSessions(),
    churchReportScope(user),
  ])

  const tabs = (
    <Tabs>
      <TabLink href="/portal/reports" active={false}>
        Attendance
      </TabLink>
      {churchScope && (
        <TabLink href="/portal/reports?tab=church" active={false}>
          Church reports
        </TabLink>
      )}
      <TabLink href="/portal/reports/cards" active>
        Report cards
      </TabLink>
    </Tabs>
  )

  if (classes.length === 0) {
    return (
      <>
        <PageHeader title="Report cards" icon={<Award className="h-5 w-5" />} />
        {tabs}
        <EmptyState title="No classes yet" hint="Once you are assigned to a class its report cards appear here." />
      </>
    )
  }

  const classId = classes.some((c) => c.id === searchParams.class) ? searchParams.class! : classes[0]!.id
  const requestedFrom = parseDateOnly(searchParams.from) ?? schoolYearStart(today)
  const requestedTo = parseDateOnly(searchParams.to) ?? today
  const from = requestedFrom <= requestedTo ? requestedFrom : requestedTo
  const to = requestedTo
  const sessionKey =
    searchParams.session && searchParams.session !== 'all' && sessions.some((s) => s.key === searchParams.session)
      ? searchParams.session
      : null

  const data = await loadReportCards(user, { classId, from, to, sessionKey })
  const period = `${formatLongDate(from)} → ${formatLongDate(to)}`
  const academicYear = academicYearLabel(today)

  // Printing one child's sheet was impossible: the page always rendered every
  // card in the class, so handing a family their report meant handing them
  // everyone else's marks too.
  const only = searchParams.student ? data.cards.find((c) => c.studentId === searchParams.student) ?? null : null
  const cards = only ? [only] : data.cards
  const allCardsHref = `/portal/reports/cards?class=${encodeURIComponent(classId)}&from=${from}&to=${to}${sessionKey ? `&session=${sessionKey}` : ''}`

  return (
    <div className="portal-print-page">
      <PageHeader
        title="Report cards"
        icon={<Award className="h-5 w-5" />}
        subtitle={`${only ? `${only.name} · ` : ''}${data.cls.name} · ${period}${sessionKey ? ` · ${sessions.find((s) => s.key === sessionKey)?.label}` : ' · all sessions'}`}
        actions={
          <>
            <PrintButton label={only ? 'Print this card' : 'Print all cards'} />
            {only ? (
              <LinkButton href={allCardsHref} variant="secondary">
                <Users className="h-4 w-4" aria-hidden /> All cards
              </LinkButton>
            ) : (
              <CsvExportButton run={exportReportCardsCsv.bind(null, { classId, from, to, sessionKey })} />
            )}
          </>
        }
      />
      {tabs}
      {only && (
        <p className="mb-4 text-[12.5px] text-parch-500 print:hidden">
          Showing {only.name} only.{' '}
          <Link href={allCardsHref} className="font-semibold text-brand-800 underline">
            Show the whole class
          </Link>
        </p>
      )}
      <ReportFilters
        months={schoolYearMonths(today)}
        basePath="/portal/reports/cards"
        classes={classes}
        classId={classId}
        from={from}
        to={to}
        sessionKey={sessionKey}
        sessions={sessions}
        allowAllSessions
        show={{ class: true, range: true, session: true }}
      />

      {cards.length === 0 ? (
        <EmptyState title={searchParams.student ? 'That student has no card in this period' : 'No students in this class yet'} />
      ) : (
        <div className="space-y-5">
          {/* F0429 / F0428 — the prototype headed the sheet with the class and
              a student count, then three class-level figures. Without them a
              stack of cards gave no sense of the class as a whole, and a pastor
              had to add the numbers up himself. Only on the full-class view:
              on one child's sheet the class totals are somebody else's data. */}
          {!only && (
            <div className="print:break-inside-avoid">
              <SectionTitle hint={`${cards.length} student${cards.length === 1 ? '' : 's'}`}>
                Student report cards &middot; {data.cls.name}
              </SectionTitle>
              <dl className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Total students', value: cards.length, color: '#4F46E5' },
                  {
                    label: 'Avg points',
                    value: Math.round(cards.reduce((n, c) => n + c.pointsTotal, 0) / Math.max(1, cards.length)),
                    color: '#C89B3C',
                  },
                  {
                    label: 'Total points',
                    value: cards.reduce((n, c) => n + c.pointsTotal, 0).toLocaleString(),
                    color: '#16A34A',
                  },
                ].map((t) => (
                  <div key={t.label} className="rounded-[12px] border border-[#EFE9DC] bg-parch-50 px-3 py-2.5 text-center">
                    <dd className="text-[19px] font-bold leading-none tabular-nums" style={{ color: t.color }}>
                      {t.value}
                    </dd>
                    <dt className="mt-1 text-[10.5px] font-bold uppercase tracking-[0.8px] text-parch-500">{t.label}</dt>
                  </div>
                ))}
              </dl>
            </div>
          )}
          {cards.map((card, index) => {
            const band = attendanceBand(card.attendance.rate)
            const rankLabel = card.rank ? `#${card.rank}` : '—'
            return (
              <section
                key={card.studentId}
                className={index < cards.length - 1 ? 'portal-print-break' : undefined}
              >
                <Card bodyClassName="p-0">
                  {/* F0432 — the prototype had a per-student Report button on
                      the list itself. Here the only way to one child's sheet was
                      through their profile page, so a servant printing cards for
                      three families left this page three times. Hidden when
                      already showing one card, and never printed. */}
                  {!only && (
                    <div className="flex justify-end border-b border-[#F3F0EB] px-3 py-2 print:hidden">
                      <LinkButton
                        href={`/portal/reports/cards?class=${encodeURIComponent(classId)}&from=${from}&to=${to}${sessionKey ? `&session=${sessionKey}` : ''}&student=${encodeURIComponent(card.studentId)}`}
                        variant="secondary"
                        size="sm"
                      >
                        <Printer className="h-[13px] w-[13px]" aria-hidden /> This card only
                      </LinkButton>
                    </div>
                  )}
                  {/* Masthead — the prototype's burgundy sheet header */}
                  <header className="bg-brand-950 px-5 py-[22px] text-center">
                    <div className="mb-2.5 flex justify-center">
                      <Avatar name={card.name} size="lg" />
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-white/45">
                      St. Kyrillos the Sixth · Antioch, TN
                    </p>
                    <p className="mt-1 font-serif text-[19px] font-bold leading-tight text-parch-50">{card.name}</p>
                    <p className="mt-0.5 text-[12px] tracking-[0.5px] text-brand-gold">
                      {card.className} — Report Card
                    </p>
                    <p className="mt-1.5 text-[11px] text-white/55">{academicYear}</p>
                    <p className="text-[11px] text-white/45">{period}</p>
                  </header>

                  {/* Four-up stat strip: hairlines are the ground showing through */}
                  <div className="grid grid-cols-4 gap-px bg-parch-200">
                    <SheetStat value={card.pointsTotal.toLocaleString()} label="Total pts" color="#C89B3C" />
                    <SheetStat
                      value={card.quizAverage === null ? '—' : `${card.quizAverage}%`}
                      label="Avg"
                      color={card.quizAverage === null ? '#7C7A7A' : card.quizAverage >= 70 ? '#16A34A' : '#DC2626'}
                    />
                    <SheetStat
                      value={card.attendance.rate === null ? '—' : `${card.attendance.rate}%`}
                      label="Att."
                      color="#6F1D1B"
                    />
                    <SheetStat value={rankLabel} label="Rank" color="#2F2930" />
                  </div>

                  {card.rank !== null && card.rank <= 3 && (
                    <div className="px-[18px] pt-4">
                      <span className="inline-flex items-center gap-1.5 rounded-[20px] bg-brand-800 px-3.5 py-1.5 text-[12px] font-bold text-brand-gold">
                        {/* F0185 — the prototype's medal glyph. A child reading
                            their own sheet knows what 🥇 means before they read
                            "#1", and it survives a black-and-white printer,
                            which a gold ribbon does not. The Award icon stays as
                            the accessible fallback label. */}
                        <span aria-hidden className="text-[13px] leading-none">
                          {RANK_MEDAL[card.rank] ?? ''}
                        </span>
                        <Award className="h-3.5 w-3.5" aria-hidden /> {rankLabel} in {card.className}
                      </span>
                    </div>
                  )}

                  {card.pointsBySource.length > 1 && (
                    <div className="px-[18px] pt-4">
                      {/* F0185 — "184 points" cannot answer the question a parent
                          asks at the door: is that because he turns up, or because
                          he works? Shown only when there is more than one source,
                          since a single row repeats the total above it. */}
                      <p className="mb-1 text-[9.5px] font-bold uppercase tracking-[0.7px] text-parch-500">
                        Where the points came from
                      </p>
                      <dl className="flex flex-wrap gap-x-4 gap-y-1">
                        {card.pointsBySource.map((row) => (
                          <div key={row.source} className="flex items-baseline gap-1.5">
                            <dt className="text-[11px] text-parch-500">{row.label}</dt>
                            <dd className="text-[12px] font-bold tabular-nums text-parch-900">
                              {row.points > 0 ? '+' : ''}
                              {row.points.toLocaleString()}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}

                  <div className="pt-4">
                    <SheetSection title="Attendance">
                      <div className="mb-2.5 flex items-center gap-3">
                        <p
                          className="text-[28px] font-bold leading-none tabular-nums"
                          style={{
                            color:
                              band === 'excellent' ? '#16A34A' : band === 'good' ? '#D97706' : band === 'low' ? '#DC2626' : '#7C7A7A',
                          }}
                        >
                          {card.attendance.rate === null ? '—' : `${card.attendance.rate}%`}
                        </p>
                        <div className="min-w-0 flex-1">
                          <p className="text-[12.5px] font-semibold text-parch-900">
                            {card.attendance.attended} of {card.attendance.held} sessions
                            {card.attendance.excused > 0 ? ` · ${card.attendance.excused} excused` : ''}
                          </p>
                          {band && (
                            <p className="mt-1">
                              <Badge tone={bandTone(band)}>{BAND_LABEL[band]}</Badge>
                            </p>
                          )}
                        </div>
                      </div>
                      <ProgressBar
                        value={card.attendance.rate ?? 0}
                        tone={band === 'excellent' ? 'good' : band === 'good' ? 'warn' : 'bad'}
                        label={`${card.name} attendance`}
                      />
                    </SheetSection>

                    <SheetSection title={`Exam results${card.quizCount > 0 ? ` (${card.quizCount})` : ''}`}>
                      <div className="flex items-center gap-3">
                        <GraduationCap className="h-5 w-5 shrink-0 text-brand-gold-dark" aria-hidden />
                        <div className="min-w-0 flex-1">
                          <p className="text-[12.5px] font-semibold text-parch-900">
                            {card.quizAverage === null ? 'No quizzes taken in this period' : `${card.quizAverage}% average`}
                          </p>
                          {card.quizCount > 0 && (
                            /* The prototype's summary line: correct/total and the
                               points earned, not just an average (OG L6442-6454). */
                            <p className="mt-0.5 text-[11px] text-parch-500">
                              {card.quizCount} quiz{card.quizCount === 1 ? '' : 'zes'} taken · {card.examCorrect} of{' '}
                              {card.examQuestions} questions right · {card.examPoints} pts earned
                            </p>
                          )}
                        </div>
                        {card.quizBand && <Badge tone={bandTone(card.quizBand)}>{BAND_LABEL[card.quizBand]}</Badge>}
                      </div>

                      {/* The prototype's per-exam breakdown. It put this behind a
                          "Show Details" toggle; here it starts open, because a
                          collapsed <details> prints collapsed — there is no
                          reliable CSS to force one open for print — and a card
                          handed to a parent has to carry its own detail. It can
                          still be folded away on screen. */}
                      {card.exams.length > 0 && (
                        <details open className="mt-2.5 rounded-[10px] border border-[#F0EBE3] bg-parch-100">
                          <summary className="cursor-pointer list-none px-3 py-2 text-[11px] font-bold uppercase tracking-[0.8px] text-brand-800">
                            Each exam
                          </summary>
                          <ul className="divide-y divide-[#F3F0EB] border-t border-[#F0EBE3] px-3 py-1">
                            {card.exams.map((e) => (
                              <li key={e.examId} className="flex items-center gap-3 py-1.5">
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-[12px] font-semibold text-parch-800">{e.title}</span>
                                  <span className="block text-[10.5px] text-parch-500">
                                    {e.correct}/{e.questions} right · {e.points} pts
                                    {e.submittedAt ? ` · ${formatLongDate(e.submittedAt)}` : ''}
                                  </span>
                                </span>
                                <span
                                  className="shrink-0 text-[14px] font-bold tabular-nums"
                                  style={{ color: e.percentage >= 70 ? '#16A34A' : '#DC2626' }}
                                >
                                  {e.percentage}%
                                </span>
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </SheetSection>

                    <SheetSection title="Badges">
                      {card.badges.length === 0 ? (
                        <p className="text-[12.5px] text-parch-500">No badges yet — there is a whole year ahead.</p>
                      ) : (
                        <ul className="flex flex-wrap gap-2">
                          {card.badges.map((badge) => (
                            <li key={badge}>
                              <Badge tone="gold">{prettyBadge(badge)}</Badge>
                            </li>
                          ))}
                        </ul>
                      )}
                    </SheetSection>

                    <div className="border-t border-[#F3F0EB] px-[18px] py-3.5">
                      <p className="flex items-center gap-1.5 text-[11px] text-parch-500">
                        <CalendarCheck className="h-3.5 w-3.5 text-brand-gold-dark" aria-hidden />
                        Servant&rsquo;s note: ______________________________________________
                      </p>
                    </div>
                  </div>
                </Card>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

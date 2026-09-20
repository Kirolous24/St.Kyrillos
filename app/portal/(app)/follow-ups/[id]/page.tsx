import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ClipboardList, History, Phone, Mail, Users } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '@/lib/portal/session'
import { requireClassAccess } from '@/lib/portal/data/classes'
import { studentName } from '@/lib/portal/data/students'
import { can } from '@/lib/portal/permissions'
import { formatDateOnly } from '@/lib/portal/dates'
import { formatDateTime, formatLongDate } from '@/lib/portal/format'
import { formatPhone } from '@/lib/portal/phones'
import { PageHeader, Card, Badge, Callout, EmptyState } from '@/components/portal/ui'
import { CaseActions } from './CaseActions'

export default async function CasePage({ params }: { params: { id: string } }) {
  const user = await requirePortalUser()
  const c = await prisma.followUpCase.findUnique({
    where: { id: params.id },
    select: {
      id: true, classId: true, status: true, origin: true, title: true, details: true, consecutiveAbsences: true, lastSeen: true, nextFollowUp: true,
      createdAt: true, resolvedAt: true, resolveReason: true, resolveNote: true,
      resolvedBy: { select: { displayName: true } }, createdBy: { select: { displayName: true } },
      student: { select: { id: true, firstName: true, lastName: true, fatherName: true, fatherPhone: true, motherName: true, motherPhone: true, parentEmails: true } },
      class: { select: { name: true } },
      logs: { orderBy: { at: 'desc' }, select: { id: true, method: true, note: true, result: true, at: true, by: { select: { displayName: true } } } },
    },
  })
  if (!c) notFound()
  const cls = await requireClassAccess(user, c.classId, 'class.read')
  const canWrite = can(user, 'followup.write', { classId: cls.id, classStage: cls.stage })
  const s = c.student
  const hasContacts = Boolean(s.fatherPhone || s.motherPhone || s.fatherName || s.motherName) || s.parentEmails.length > 0

  return (
    <>
      <PageHeader
        title={studentName(s)}
        subtitle={
          <>
            {c.title} &middot;{' '}
            <Link href={`/portal/students/${s.id}`} className="font-semibold text-brand-gold-light underline-offset-2 hover:underline">
              Open profile
            </Link>
          </>
        }
        back={{ href: '/portal/follow-ups', label: 'Follow-ups' }}
        icon={<ClipboardList className="h-5 w-5" />}
        actions={<Badge tone={c.status === 'OPEN' ? 'bad' : 'good'}>{c.status === 'OPEN' ? 'Open' : 'Resolved'}</Badge>}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title="Case" icon={<ClipboardList className="h-4 w-4" />} bodyClassName="p-0">
            <dl>
              <Row label="Class" value={c.class.name} />
              <Row
                label="Opened"
                value={`${formatDateTime(c.createdAt)}${c.createdBy ? ` by ${c.createdBy.displayName}` : c.origin === 'AUTO' ? ' automatically' : ''}`}
              />
              {c.origin === 'AUTO' && <Row label="Missed in a row" value={String(c.consecutiveAbsences)} />}
              {c.lastSeen && <Row label="Last seen" value={formatLongDate(formatDateOnly(c.lastSeen))} />}
              {c.nextFollowUp && <Row label="Next follow-up" value={formatLongDate(formatDateOnly(c.nextFollowUp))} />}
            </dl>
            {(c.details || c.status === 'DONE') && (
              <div className="space-y-3 px-[18px] py-3.5">
                {c.details && (
                  <div>
                    <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">Details</p>
                    <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-parch-800">{c.details}</p>
                  </div>
                )}
                {c.status === 'DONE' && (
                  <Callout
                    tone="good"
                    title={`Resolved${c.resolveReason ? ` \u00b7 ${c.resolveReason.replace('_', ' ')}` : ''}`}
                  >
                    {c.resolvedAt ? formatDateTime(c.resolvedAt) : ''}
                    {c.resolvedBy ? ` · ${c.resolvedBy.displayName}` : ''}
                    {c.resolveNote && <span className="mt-1 block">{c.resolveNote}</span>}
                  </Callout>
                )}
              </div>
            )}
          </Card>

          <Card title="Contact log" icon={<History className="h-4 w-4" />} action={<span className="text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">{c.logs.length}</span>}>
            {c.logs.length === 0 ? (
              <EmptyState title="No contact recorded yet" hint="Every call, text or visit you log shows up here in order." />
            ) : (
              <ol className="relative ml-1.5 space-y-4 border-l-2 border-brand-gold/30 pl-5">
                {c.logs.map((l) => (
                  <li key={l.id} className="relative">
                    <span aria-hidden className="absolute -left-[26px] top-1 h-3 w-3 rounded-full bg-brand-gold ring-2 ring-parch-50" />
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="brand"><span className="capitalize">{l.method}</span></Badge>
                      {l.result && <Badge tone={l.result === 'reached' || l.result === 'will_come' ? 'good' : 'neutral'}><span className="capitalize">{l.result.replace('_', ' ')}</span></Badge>}
                    </div>
                    {l.note && <p className="mt-1.5 whitespace-pre-wrap text-[12.5px] leading-relaxed text-parch-800">{l.note}</p>}
                    <p className="mt-1 text-[11px] text-parch-500">
                      {formatDateTime(l.at)}
                      {l.by ? ` · ${l.by.displayName}` : ''}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Family contacts" icon={<Users className="h-4 w-4" />} bodyClassName="p-0">
            {!hasContacts ? (
              <p className="px-[18px] py-4 text-[12.5px] text-parch-500">No contact details on file.</p>
            ) : (
              <dl>
                {(s.fatherName || s.fatherPhone) && (
                  <Row
                    label="Father"
                    value={
                      <>
                        {s.fatherName}
                        {s.fatherPhone && (
                          <>
                            {' '}
                            <a className="inline-flex items-center gap-1 font-bold text-brand-800 hover:text-brand-gold-dark" href={`tel:${s.fatherPhone}`}>
                              <Phone className="h-3.5 w-3.5" aria-hidden />
                              {formatPhone(s.fatherPhone)}
                            </a>
                          </>
                        )}
                      </>
                    }
                  />
                )}
                {(s.motherName || s.motherPhone) && (
                  <Row
                    label="Mother"
                    value={
                      <>
                        {s.motherName}
                        {s.motherPhone && (
                          <>
                            {' '}
                            <a className="inline-flex items-center gap-1 font-bold text-brand-800 hover:text-brand-gold-dark" href={`tel:${s.motherPhone}`}>
                              <Phone className="h-3.5 w-3.5" aria-hidden />
                              {formatPhone(s.motherPhone)}
                            </a>
                          </>
                        )}
                      </>
                    }
                  />
                )}
                {s.parentEmails.map((e) => (
                  <Row
                    key={e}
                    label="Email"
                    value={
                      <a className="inline-flex items-center gap-1 break-all font-bold text-brand-800 hover:text-brand-gold-dark" href={`mailto:${e}`}>
                        <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        {e}
                      </a>
                    }
                  />
                ))}
              </dl>
            )}
          </Card>
          {canWrite && <CaseActions caseId={c.id} status={c.status} />}
        </div>
      </div>
    </>
  )
}

/** One hairline-separated key/value line, the prototype's `.cls-card` row. */
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[#F5F2ED] px-[18px] py-2.5 text-[12px] last:border-0">
      <dt className="shrink-0 text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">{label}</dt>
      <dd className="min-w-0 text-right font-semibold text-parch-800">{value}</dd>
    </div>
  )
}

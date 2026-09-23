import { notFound } from 'next/navigation'
import { Award } from 'lucide-react'
import { requirePortalUser } from '@/lib/portal/session'
import { requireStudentRead, studentName } from '@/lib/portal/data/students'
import { certificateText } from '@/lib/portal/certificates'
import { todayInNewYork } from '@/lib/portal/dates'
import { formatLongDate, academicYearLabel } from '@/lib/portal/format'
import { CHURCH_INFO } from '@/lib/constants'
import { PageHeader } from '@/components/portal/ui'
import { CertificateForm } from './CertificateForm'

export const metadata = { title: 'Certificate' }

interface SearchParams {
  occasion?: string
  period?: string
  by?: string
}

/**
 * A printable award certificate for one student — the prototype's certificate
 * generator, which the port dropped entirely.
 *
 * Built as a route rather than a modal on purpose: the portal's printable
 * things are already routes (`reports/cards`, `qr/cards`), and it sidesteps the
 * overlay trap that once left a dialog's own controls unclickable.
 */
export default async function CertificatePage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: SearchParams
}) {
  const user = await requirePortalUser()
  // A student may not print their own award; everyone on staff may, including
  // the pastor — handing these out is precisely a pastor's job, and gating it
  // on student.write would hide it from them.
  if (user.role === 'STUDENT') notFound()
  const s = await requireStudentRead(user, params.id)

  const today = todayInNewYork()
  const text = certificateText(searchParams.occasion)
  const period = (searchParams.period ?? '').trim() || academicYearLabel(today).replace('Academic Year ', '')
  const presentedBy = (searchParams.by ?? '').trim() || 'St. Kyrillos Sunday School'

  return (
    <div className="portal-print-page">
      <div className="print:hidden">
        <PageHeader
          title="Certificate"
          icon={<Award className="h-5 w-5" aria-hidden />}
          subtitle={studentName(s)}
          back={{ href: `/portal/students/${s.id}`, label: studentName(s) }}
        />
      </div>

      <CertificateForm
        studentId={s.id}
        occasion={text.key}
        period={period}
        presentedBy={presentedBy}
      />

      {/* The sheet. Landscape-ish proportions, a gold double rule, and nothing
          that depends on JavaScript — it is the same markup on screen and on
          paper. */}
      <div className="mx-auto max-w-[900px] break-inside-avoid rounded-[6px] border-[3px] border-brand-gold bg-parch-50 p-2">
        <div className="border border-brand-gold/60 px-8 py-10 text-center sm:px-14 sm:py-14">
          <p className="text-[11px] font-bold uppercase tracking-[2px] text-brand-gold-dark">
            {CHURCH_INFO.fullName}
          </p>
          <p className="mt-0.5 text-[10.5px] uppercase tracking-[1.5px] text-parch-500">{CHURCH_INFO.location}</p>

          <h1 className="mt-7 font-serif text-[30px] font-bold leading-tight text-brand-950 sm:text-[36px]">
            {text.title}
          </h1>
          <p className="mx-auto mt-3 h-px w-24 bg-brand-gold" />

          <p className="mt-7 text-[12.5px] uppercase tracking-[1.5px] text-parch-500">Presented to</p>
          <p className="mt-2 font-serif text-[30px] font-bold text-brand-800 sm:text-[38px]">{studentName(s)}</p>
          {s.class?.name && <p className="mt-1 text-[12.5px] text-parch-600">{s.class.name}</p>}

          <p className="mx-auto mt-6 max-w-[34rem] text-[13.5px] leading-relaxed text-parch-700">
            {text.line} <span className="font-bold text-parch-900">{period}</span>.
          </p>

          <div className="mt-10 flex flex-wrap items-end justify-center gap-10 sm:gap-16">
            <div className="min-w-[11rem]">
              <p className="border-t border-parch-400 pt-1.5 text-[11px] uppercase tracking-[1px] text-parch-500">
                Presented by
              </p>
              <p className="mt-1 text-[12.5px] font-semibold text-parch-900">{presentedBy}</p>
            </div>
            <div className="min-w-[11rem]">
              <p className="border-t border-parch-400 pt-1.5 text-[11px] uppercase tracking-[1px] text-parch-500">
                Date
              </p>
              <p className="mt-1 text-[12.5px] font-semibold text-parch-900">{formatLongDate(today)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

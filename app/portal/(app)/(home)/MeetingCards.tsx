import { HeartHandshake, CalendarCheck, QrCode } from 'lucide-react'
import type { MeetingTile } from '@/lib/portal/data/fellowship'
import { ClassCard, LinkButton, SectionTitle } from '@/components/portal/ui'
import { accentByOrder } from '@/lib/portal/accents'
import { formatShortDate } from '@/lib/portal/format'

/** The Fellowship meetings on a dashboard (2026-10-24). */
export function MeetingCards({ meetings, title = true }: { meetings: MeetingTile[]; title?: boolean }) {
  if (meetings.length === 0) return null
  return (
    <section data-testid="dashboard-meetings">
      {title && <SectionTitle hint="Members, attendance and follow-ups">Fellowship meetings</SectionTitle>}
      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
        {meetings.map((m) => (
          <ClassCard
            key={m.id}
            href={`/portal/classes/${m.id}`}
            name={m.name}
            accent={accentByOrder(m.sortOrder)}
            icon={<HeartHandshake className="h-5 w-5" />}
            photo={m.photo}
            note={m.description}
            rows={[
              { key: 'Members', value: m.members },
              { key: 'Servants', value: m.servants },
              { key: 'Last meeting', value: m.last ? `${formatShortDate(m.last.date)} · ${m.last.here} here` : 'None yet' },
              { key: 'Open follow-ups', value: m.openCases },
            ]}
            actions={
              m.canWrite ? (
                <>
                  <LinkButton href={`/portal/classes/${m.id}/attendance`} size="sm">
                    <CalendarCheck className="h-4 w-4" aria-hidden /> Attendance
                  </LinkButton>
                  <LinkButton href={`/portal/classes/${m.id}/checkin`} variant="secondary" size="sm">
                    <QrCode className="h-4 w-4" aria-hidden /> QR check-in
                  </LinkButton>
                </>
              ) : undefined
            }
          />
        ))}
      </div>
    </section>
  )
}

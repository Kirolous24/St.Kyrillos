import type { Metadata } from 'next'
import { createHash } from 'node:crypto'
import { cookies } from 'next/headers'
import Link from '@/components/portal/Link'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { parseTokenPayload } from '@/lib/portal/qr'
import { rosterWhere } from '@/lib/portal/class-members'
import { checkInLabels } from '@/lib/portal/fellowship'
import { churchToday, formatDateOnly, toUTCDate } from '@/lib/portal/dates'
import { formatLongDate } from '@/lib/portal/format'
import { CheckInFrame } from '../CheckInFrame'
import { SelfCheckIn } from './SelfCheckIn'

export const metadata: Metadata = { title: 'Check in', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

function Problem({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-[18px] border border-parch-200 bg-parch-50 p-5 text-center shadow-card" data-testid="checkin-problem">
      <h1 className="mb-1 font-serif text-[20px] font-bold text-parch-900">{title}</h1>
      <p className="text-[13px] text-parch-600">{hint}</p>
      <Link href="/portal/checkin" className="mt-4 inline-block text-[13px] font-bold text-brand-800 underline decoration-brand-gold underline-offset-2">
        Type the code instead
      </Link>
    </div>
  )
}

/**
 * A Fellowship meeting's check-in (2026-10-24), opened from the phone camera
 * without signing in. The live code is the key; the names shown are first name
 * and last initial, for the five minutes it lives.
 */
export default async function CheckInPage({ params }: { params: { token: string } }) {
  const token = parseTokenPayload(params.token)
  const row =
    token && token.length >= 32
      ? await prisma.qrToken.findUnique({
          where: { token },
          select: { token: true, kind: true, classIds: true, sessionKey: true, activityLabel: true, date: true, expiresAt: true },
        })
      : null
  if (!row || row.kind !== 'MEMBER_CHECKIN' || row.classIds.length !== 1 || !row.sessionKey) {
    return (
      <CheckInFrame>
        <Problem title="That code isn’t valid" hint="Scan the code on the screen again, or ask a servant." />
      </CheckInFrame>
    )
  }
  if (row.expiresAt.getTime() <= Date.now()) {
    return (
      <CheckInFrame>
        <Problem title="This code has expired" hint="Ask a servant to show a new one, then scan it again." />
      </CheckInFrame>
    )
  }
  const classId = row.classIds[0]!
  const date = row.date ? formatDateOnly(row.date) : churchToday()
  const [roster, present] = await Promise.all([
    prisma.student.findMany({ where: rosterWhere(classId), select: { id: true, accountId: true, firstName: true, lastName: true } }),
    prisma.attendanceRecord.findMany({
      where: { classId, sessionKey: row.sessionKey, date: toUTCDate(date), status: 'PRESENT' },
      select: { studentId: true },
    }),
  ])
  const labels = checkInLabels(roster)
  const here = new Set(present.map((p) => p.studentId))
  const label = (id: string) => labels.get(id) ?? ''

  // This phone's own check-in with this code, if it made one.
  const cookie = cookies().get('sk_ci')?.value
  const device = cookie && /^[0-9a-f]{32}$/.test(cookie) ? createHash('sha256').update(cookie).digest('hex') : null
  const mine = device ? await prisma.qrRedemption.findFirst({ where: { tokenId: row.token, device }, select: { accountId: true } }) : null
  const minePerson = mine ? roster.find((r) => r.accountId === mine.accountId) : undefined
  // A servant who is a member, signed in on this phone: one tap.
  const session = await auth()
  const myAccountId = session?.user?.kind === 'portal' ? session.user.accountId : null
  const me = myAccountId ? roster.find((r) => r.accountId === myAccountId) : undefined

  return (
    <CheckInFrame>
      <SelfCheckIn
        token={row.token}
        meeting={row.activityLabel ?? 'the meeting'}
        dateLabel={formatLongDate(date)}
        people={roster
          .map((r) => ({ id: r.id, label: label(r.id), here: here.has(r.id) }))
          .sort((a, b) => a.label.localeCompare(b.label))}
        mine={minePerson ? { id: minePerson.id, label: label(minePerson.id) } : null}
        me={me ? { id: me.id, label: label(me.id), here: here.has(me.id) } : null}
      />
    </CheckInFrame>
  )
}

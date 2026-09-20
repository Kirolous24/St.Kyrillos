import Link from 'next/link'
import { CheckCircle2, QrCode, ShieldAlert, XCircle } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '@/lib/portal/session'
import { canRedeem, parseTokenPayload } from '@/lib/portal/qr'
import { formatDateOnly } from '@/lib/portal/dates'
import { formatDateTime, formatLongDate } from '@/lib/portal/format'
import { redeemCodeForm } from '@/lib/portal/actions/qr'
import { Card, LinkButton, Badge, Callout } from '@/components/portal/ui'
import { SubmitButton } from '@/components/portal/SubmitButton'

export const metadata = { title: 'Check in' }

function Frame({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-[440px] py-4">{children}</div>
}

/** The prototype's outcome disc: a 64px tinted circle around a single glyph. */
function Verdict({ tone, children }: { tone: 'good' | 'bad' | 'warn' | 'gold'; children: React.ReactNode }) {
  const cls = {
    good: 'bg-[#F0FDF4] text-[#16A34A]',
    bad: 'bg-[#FEF2F2] text-[#DC2626]',
    warn: 'bg-[#FFFBEB] text-[#B45309]',
    gold: 'bg-brand-wash text-brand-800',
  }[tone]
  return (
    <span aria-hidden className={`mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full ${cls}`}>
      {children}
    </span>
  )
}

export default async function ScanPage({
  params,
  searchParams,
}: {
  params: { token: string }
  searchParams?: { error?: string | string[] }
}) {
  const user = await requirePortalUser()
  const code = parseTokenPayload(params.token)
  // redeemCodeForm redirects back here with the reason when a redemption fails,
  // so a failure is never silent.
  const raw = searchParams?.error
  const failure = (Array.isArray(raw) ? raw[0] : raw)?.slice(0, 300) || null

  const token = code
    ? code.length >= 32
      ? await prisma.qrToken.findUnique({ where: { token: code } })
      : await prisma.qrToken.findFirst({
          where: { token: { startsWith: code }, expiresAt: { gt: new Date() } },
          orderBy: { createdAt: 'desc' },
        })
    : null

  if (!token) {
    return (
      <Frame>
        <Card bodyClassName="px-6 py-9">
          <div className="text-center">
            <Verdict tone="bad">
              <XCircle className="h-9 w-9" strokeWidth={2.2} />
            </Verdict>
            <h1 className="font-serif text-[22px] font-bold text-parch-900">That code is not valid</h1>
            <p className="mx-auto mt-2 max-w-[19rem] text-[12.5px] leading-relaxed text-parch-500">
              It may have been mistyped, or it expired and was cleaned up. Ask your servant to open a new one.
            </p>
            <div className="mt-6 flex justify-center">
              <LinkButton href="/portal">Back to the portal</LinkButton>
            </div>
          </div>
        </Card>
      </Frame>
    )
  }

  const redemption = await prisma.qrRedemption.findUnique({
    where: { tokenId_accountId: { tokenId: token.token, accountId: user.accountId } },
    select: { at: true },
  })

  const title = token.title ?? token.activityLabel ?? 'Check-in'
  const when = token.date
    ? formatLongDate(formatDateOnly(token.date))
    : token.weekStart
      ? `week of ${formatLongDate(formatDateOnly(token.weekStart))}`
      : null

  if (redemption) {
    return (
      <Frame>
        <Card tone="brand" bodyClassName="px-6 py-9">
          <div className="text-center">
            <Verdict tone="good">
              <CheckCircle2 className="h-10 w-10" strokeWidth={2.2} />
            </Verdict>
            <p className="text-[11px] font-bold uppercase tracking-[0.8px] text-brand-gold-dark">You are checked in</p>
            <h1 className="mt-1 font-serif text-[24px] font-bold leading-tight text-parch-900">{title}</h1>
            {when && <p className="mt-1 text-[12.5px] text-parch-500">{when}</p>}
            {token.kind !== 'SERVANT_MEETING' && token.points ? (
              <div className="mt-3 flex justify-center">
                <Badge tone="gold">+{token.points} points</Badge>
              </div>
            ) : null}
            <div className="mt-4 rounded-[12px] border border-parch-200 bg-parch-100 px-4 py-2.5">
              <p className="text-[11px] text-parch-500">Recorded {formatDateTime(redemption.at)}</p>
            </div>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <LinkButton href="/portal">Back to the portal</LinkButton>
              <LinkButton href="/portal/my-attendance" variant="secondary">My attendance</LinkButton>
            </div>
          </div>
        </Card>
      </Frame>
    )
  }

  const reason = canRedeem(user, token, new Date())
  if (reason) {
    return (
      <Frame>
        <Card bodyClassName="px-6 py-9">
          <div className="text-center">
            <Verdict tone="warn">
              <ShieldAlert className="h-9 w-9" strokeWidth={2.2} />
            </Verdict>
            <h1 className="font-serif text-[22px] font-bold text-parch-900">Cannot check you in</h1>
            <p className="mx-auto mt-2 max-w-[19rem] text-[12.5px] leading-relaxed text-parch-500">{reason}</p>
            <div className="mt-6 flex justify-center">
              <LinkButton href="/portal">Back to the portal</LinkButton>
            </div>
          </div>
        </Card>
      </Frame>
    )
  }

  return (
    <Frame>
      <Card tone="brand" bodyClassName="px-6 py-8">
        <div className="text-center">
          <Verdict tone="gold">
            <QrCode className="h-8 w-8" strokeWidth={2} />
          </Verdict>
          <p className="text-[11px] font-bold uppercase tracking-[0.8px] text-brand-gold-dark">
            {token.kind === 'SERVANT_MEETING' ? 'Servants check-in' : token.kind === 'STUDENT_POINTS' ? 'Points code' : 'Attendance code'}
          </p>
          <h1 className="mt-1 font-serif text-[24px] font-bold leading-tight text-parch-900">{title}</h1>
          {when && <p className="mt-1 text-[12.5px] text-parch-500">{when}</p>}
          {token.kind !== 'SERVANT_MEETING' && token.points ? (
            <div className="mt-3 flex justify-center">
              <Badge tone="gold">+{token.points} points</Badge>
            </div>
          ) : null}

          {failure && (
            <div className="mt-5 text-left">
              <Callout tone="bad" title="That did not work">
                {failure}
              </Callout>
            </div>
          )}

          <form action={redeemCodeForm} className="mt-6">
            <input type="hidden" name="token" value={token.token} />
            <SubmitButton pendingText="Checking you in…" className="w-full py-3">
              {failure ? 'Try again' : `Check me in, ${user.displayName.split(' ')[0]}`}
            </SubmitButton>
          </form>

          <p className="mt-4 text-[11px] leading-relaxed text-parch-500">
            Signed in as {user.displayName}. This code can only be used once by each person.
          </p>
        </div>
      </Card>
      <div className="mt-4 text-center">
        <Link href="/portal" className="text-[12.5px] text-parch-500 transition-colors hover:text-brand-800">
          Not now — back to the portal
        </Link>
      </div>
    </Frame>
  )
}

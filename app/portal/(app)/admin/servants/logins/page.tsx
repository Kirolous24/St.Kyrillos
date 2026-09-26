import { notFound } from 'next/navigation'
import { Send } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '@/lib/portal/session'
import { PageHeader } from '@/components/portal/ui'
import { onFileAccountIds } from '@/lib/portal/data/logins'
import { pinVaultEnabled } from '@/lib/portal/pin-vault'
import { resendApiKey } from '@/lib/portal/login-email'
import { fetchSentLoginEmails, loginEmailStates, type LoginEmailState } from '@/lib/portal/login-email-status'
import { SendLogins, type Candidate } from './SendLogins'

export const metadata = { title: 'Send logins' }
// Issuing new PINs hashes each one with bcrypt; for the whole staff that is a
// few seconds of CPU, so the page's actions get room.
export const maxDuration = 60

export default async function SendLoginsPage() {
  const user = await requirePortalUser()
  if (user.role !== 'ADMIN') notFound()
  const accounts = await prisma.account.findMany({
    where: { role: { in: ['SERVANT', 'PASTOR', 'ADMIN'] }, isActive: true },
    orderBy: { displayName: 'asc' },
    select: { id: true, displayName: true, role: true, loginId: true, email: true, phone: true, lastLoginAt: true, pinIssuedAt: true },
  })
  const onFile = await onFileAccountIds(accounts.map((a) => a.id))
  // Who already has their login by email, asked of Resend (which also knows
  // about bounces). If Resend cannot be reached the page still works; it just
  // cannot tell who was emailed.
  let states: Map<string, LoginEmailState> | null = null
  const key = resendApiKey({ RESEND_API_KEY2: process.env.RESEND_API_KEY2, RESEND_API_KEY: process.env.RESEND_API_KEY })
  if (key) {
    try {
      states = loginEmailStates(accounts, await fetchSentLoginEmails(key))
    } catch (err) {
      console.error('Could not read sent login emails from Resend:', err)
    }
  }
  const emailedAtOf = (id: string) => {
    const s = states?.get(id)
    return s && s.state !== 'none' ? s.at.toISOString() : null
  }
  const candidates: Candidate[] = accounts.map((a) => ({
    accountId: a.id,
    name: a.displayName,
    role: a.role as Candidate['role'],
    loginId: a.loginId,
    email: a.email,
    phone: a.phone,
    neverSignedIn: !a.lastLoginAt,
    onFile: onFile.has(a.id),
    isSelf: a.id === user.accountId,
    emailState: states ? (states.get(a.id)?.state ?? 'none') : null,
    emailedAt: emailedAtOf(a.id),
  }))
  return (
    <>
      <PageHeader
        title="Send logins"
        icon={<Send className="h-5 w-5" aria-hidden />}
        subtitle="Give each servant their own ID and PIN by email, text, WhatsApp or a printed slip."
        back={{ href: '/portal/admin/servants', label: 'Servants' }}
      />
      <SendLogins candidates={candidates} vaultEnabled={pinVaultEnabled()} emailCheck={states !== null} />
    </>
  )
}

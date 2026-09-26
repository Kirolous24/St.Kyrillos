'use client'

import { useMemo, useState, useTransition } from 'react'
import { KeyRound, Mail, Printer, RotateCcw, Search } from 'lucide-react'
import { emailLogins, reissuePins, revealLogins } from '@/lib/portal/actions/logins'
import { CONFIRM_PHRASE } from '@/lib/portal/reports'
import { LOGIN_URL } from '@/lib/portal/login-share'
import { formatPhone } from '@/lib/portal/phones'
import { Badge, Callout, Card, buttonClass, checkboxClass, inputClass } from '@/components/portal/ui'
import { LoginShareButtons } from '@/components/portal/LoginShareButtons'
import { cn } from '@/lib/utils'

export interface Candidate {
  accountId: string
  name: string
  role: 'SERVANT' | 'PASTOR' | 'ADMIN'
  loginId: string
  email: string | null
  phone: string | null
  neverSignedIn: boolean
  onFile: boolean
  isSelf: boolean
}

type EmailStatus = 'sent' | 'no-email' | 'not-on-file' | 'failed'
type SheetRow = Candidate & { pin: string | null; emailStatus?: EmailStatus; emailError?: string }

const EMAIL_BADGE: Record<EmailStatus, { tone: 'good' | 'bad' | 'neutral' | 'warn'; label: string }> = {
  sent: { tone: 'good', label: 'Emailed' },
  failed: { tone: 'bad', label: 'Email failed' },
  'no-email': { tone: 'neutral', label: 'No email' },
  'not-on-file': { tone: 'warn', label: 'No PIN on file' },
}

/**
 * Send each servant their own login (option B). Pick who, then get their
 * logins: anyone with a PIN on file keeps it, and anyone without is issued one
 * after a typed confirmation. The sheet then emails everyone with an address,
 * opens Messages or WhatsApp per person, and prints slips for the rest.
 */
export function SendLogins({ candidates, vaultEnabled }: { candidates: Candidate[]; vaultEnabled: boolean }) {
  const [scope, setScope] = useState<'never' | 'all'>('never')
  const [unchecked, setUnchecked] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [typed, setTyped] = useState('')
  const [sheet, setSheet] = useState<SheetRow[] | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const phrase = CONFIRM_PHRASE.reissuePins

  const inScope = useMemo(
    () => candidates.filter((c) => !c.isSelf && (scope === 'all' || c.neverSignedIn)),
    [candidates, scope],
  )
  const chosen = inScope.filter((c) => !unchecked.has(c.accountId))
  // Search narrows what is shown; it never changes who is selected. So you can
  // unselect everyone, search for one person and tick them.
  const q = query.trim().toLowerCase()
  const digits = q.replace(/\D/g, '')
  const shown = q
    ? inScope.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.loginId.includes(q) ||
          (c.email ?? '').toLowerCase().includes(q) ||
          (digits.length >= 3 && (c.phone ?? '').includes(digits)),
      )
    : inScope
  const needNew = chosen.filter((c) => !c.onFile)
  const withEmail = chosen.filter((c) => c.email).length
  const phoneOnly = chosen.filter((c) => !c.email && c.phone).length
  const neither = chosen.filter((c) => !c.email && !c.phone).length

  if (!vaultEnabled) {
    return (
      <Callout tone="bad" title="PIN viewing is switched off">
        Set PORTAL_PIN_KEY on the site first. Without it the portal cannot keep the PINs it issues, so there would be
        nothing to send.
      </Callout>
    )
  }

  /** Select or unselect everybody the list is showing right now. */
  function selectShown(on: boolean) {
    setUnchecked((prev) => {
      const next = new Set(prev)
      for (const c of shown) {
        if (on) next.delete(c.accountId)
        else next.add(c.accountId)
      }
      return next
    })
  }

  function toggle(id: string) {
    setUnchecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function prepare() {
    setError(null)
    setNotice(null)
    startTransition(async () => {
      const pins = new Map<string, string | null>()
      if (needNew.length > 0) {
        const r = await reissuePins(needNew.map((c) => c.accountId), typed)
        if (!r.ok) return setError(r.error)
        for (const row of r.data!.rows) pins.set(row.accountId, row.pin)
      }
      const known = chosen.filter((c) => c.onFile)
      if (known.length > 0) {
        const r = await revealLogins(known.map((c) => c.accountId))
        if (!r.ok) return setError(r.error)
        for (const row of r.data!.rows) pins.set(row.accountId, row.pin)
      }
      setSheet(chosen.map((c) => ({ ...c, onFile: true, pin: pins.get(c.accountId) ?? null })))
      setTyped('')
    })
  }

  function emailAll() {
    if (!sheet) return
    const targets = sheet.filter((r) => r.email && r.pin && r.emailStatus !== 'sent')
    if (targets.length === 0) return
    setError(null)
    startTransition(async () => {
      const r = await emailLogins(targets.map((t) => t.accountId))
      if (!r.ok) return setError(r.error)
      const by = new Map(r.data!.results.map((x) => [x.accountId, x]))
      setSheet((prev) =>
        prev!.map((row) => {
          const x = by.get(row.accountId)
          return x ? { ...row, emailStatus: x.status, emailError: x.error } : row
        }),
      )
      if (r.data!.mode === 'redirect') setNotice('Test mode: every email went to the redirect address, not to the servants.')
    })
  }

  if (sheet) {
    const emailable = sheet.filter((r) => r.email && r.pin && r.emailStatus !== 'sent').length
    return (
      <>
        <div className="print:hidden">
          <Card title={`${sheet.length} login${sheet.length === 1 ? '' : 's'} ready`} icon={<KeyRound className="h-4 w-4" />}>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending || emailable === 0}
                onClick={emailAll}
                className={cn(buttonClass('primary'), 'min-h-[40px]')}
              >
                <Mail className="h-4 w-4" aria-hidden /> {pending ? 'Sending…' : `Email the ${emailable} with an address`}
              </button>
              <button type="button" onClick={() => window.print()} className={cn(buttonClass('secondary'), 'min-h-[40px]')}>
                <Printer className="h-4 w-4" aria-hidden /> Print slips
              </button>
              <button type="button" onClick={() => setSheet(null)} className={cn(buttonClass('ghost'), 'min-h-[40px]')}>
                <RotateCcw className="h-4 w-4" aria-hidden /> Start over
              </button>
            </div>
            <p className="mt-2 text-[11.5px] text-parch-500">
              Text and WhatsApp open on this device with the message typed. Press Send in the app. Each person gets only
              their own login.
            </p>
            {notice && (
              <p role="status" className="mt-2 text-[12px] font-semibold text-[#D97706]">
                {notice}
              </p>
            )}
            {error && (
              <div className="mt-3" role="alert">
                <Callout tone="bad">{error}</Callout>
              </div>
            )}
          </Card>
          <div className="mt-4 space-y-2.5" data-testid="login-sheet">
            {sheet.map((r) => (
              <div key={r.accountId} className="rounded-[14px] border border-parch-200 bg-parch-50 p-3.5" data-login-row={r.loginId}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-serif text-[14px] font-bold text-parch-900">{r.name}</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {r.emailStatus && <Badge tone={EMAIL_BADGE[r.emailStatus].tone}>{EMAIL_BADGE[r.emailStatus].label}</Badge>}
                    {!r.email && !r.phone && <Badge tone="warn">Print a slip</Badge>}
                  </div>
                </div>
                <p className="mt-1 text-[12.5px] text-parch-700">
                  ID <strong className="font-mono tabular-nums">{r.loginId}</strong> · PIN{' '}
                  <strong className="font-mono tabular-nums text-brand-800" data-testid="sheet-pin">
                    {r.pin ?? '—'}
                  </strong>
                  {r.phone ? ` · ${formatPhone(r.phone)}` : ''}
                  {r.email ? ` · ${r.email}` : ''}
                </p>
                {r.emailError && <p className="mt-1 text-[11.5px] text-[#B91C1C]">{r.emailError}</p>}
                {r.pin && (
                  <div className="mt-2">
                    <LoginShareButtons name={r.name} loginId={r.loginId} pin={r.pin} email={r.email} phone={r.phone} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        {/* Print: one cut-out slip per person. */}
        <div className="hidden grid-cols-2 gap-3 print:grid">
          {sheet.map((r) => (
            <div key={r.accountId} className="break-inside-avoid rounded-[10px] border border-dashed border-parch-500 p-3">
              <p className="font-serif text-[13px] font-bold">{r.name}</p>
              <p className="mt-1 text-[12px]">
                ID: <strong className="font-mono">{r.loginId}</strong>
              </p>
              <p className="text-[12px]">
                PIN: <strong className="font-mono">{r.pin ?? '—'}</strong>
              </p>
              <p className="mt-1 text-[10.5px]">Sign in at {LOGIN_URL}</p>
            </div>
          ))}
        </div>
      </>
    )
  }

  return (
    <div className="space-y-4">
      <Card title="Who gets their login" icon={<KeyRound className="h-4 w-4" />}>
        <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Who">
          {(
            [
              ['never', `Never signed in (${candidates.filter((c) => !c.isSelf && c.neverSignedIn).length})`],
              ['all', `Everyone (${candidates.filter((c) => !c.isSelf).length})`],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              aria-pressed={scope === k}
              onClick={() => {
                setScope(k)
                setUnchecked(new Set())
              }}
              className={cn(buttonClass(scope === k ? 'primary' : 'secondary', 'sm'), 'min-h-[36px]')}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-[12px] text-parch-700" data-testid="send-summary">
          <strong>{chosen.length}</strong> selected · {withEmail} by email · {phoneOnly} by phone only · {neither} need a
          printed slip{needNew.length ? ` · ${needNew.length} need a new PIN` : ''}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-parch-500" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, ID, email or phone"
              aria-label="Search servants"
              className={cn(inputClass, 'pl-8')}
            />
          </label>
          <button type="button" onClick={() => selectShown(true)} disabled={shown.length === 0} className={cn(buttonClass('secondary', 'sm'), 'min-h-[36px]')}>
            {q ? `Select these ${shown.length}` : 'Select all'}
          </button>
          <button type="button" onClick={() => selectShown(false)} disabled={shown.length === 0} className={cn(buttonClass('secondary', 'sm'), 'min-h-[36px]')}>
            {q ? `Unselect these ${shown.length}` : 'Unselect all'}
          </button>
        </div>
        <ul className="mt-3 divide-y divide-parch-200 rounded-[12px] border border-parch-200">
          {shown.map((c) => (
            <li key={c.accountId} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <label className="flex min-w-0 flex-1 items-center gap-2 text-[12.5px] font-semibold text-parch-900">
                <input
                  type="checkbox"
                  className={checkboxClass}
                  checked={!unchecked.has(c.accountId)}
                  onChange={() => toggle(c.accountId)}
                  data-account={c.loginId}
                />
                <span className="truncate">{c.name}</span>
              </label>
              <span className="text-[11px] text-parch-500">{c.email ? 'Email' : c.phone ? 'Phone' : 'No contact'}</span>
              {c.onFile ? <Badge tone="good">PIN on file</Badge> : <Badge tone="warn">Needs a new PIN</Badge>}
            </li>
          ))}
          {shown.length === 0 && (
            <li className="px-3 py-3 text-[12px] text-parch-500">{q ? `Nobody matches “${query.trim()}”.` : 'Nobody here.'}</li>
          )}
        </ul>
      </Card>

      {needNew.length > 0 && (
        <Callout tone="warn" title={`${needNew.length} will get a new PIN`}>
          {needNew
            .slice(0, 12)
            .map((c) => c.name)
            .join(', ')}
          {needNew.length > 12 ? `, and ${needNew.length - 12} more` : ''}. Their PIN is not on file, so the portal issues a
          new one, and the PIN they use now stops working. They get the new one on the next screen.
          <label className="mt-2.5 block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">
              Type <span className="font-mono text-[12px] normal-case tracking-normal text-[#B91C1C]">{phrase}</span> to confirm
            </span>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className={cn(inputClass, 'max-w-xs font-mono')}
              placeholder={phrase}
              autoComplete="off"
              spellCheck={false}
              aria-label="Confirmation phrase"
            />
          </label>
        </Callout>
      )}

      {error && (
        <div role="alert">
          <Callout tone="bad">{error}</Callout>
        </div>
      )}

      <button
        type="button"
        disabled={pending || chosen.length === 0 || (needNew.length > 0 && typed.trim() !== phrase)}
        onClick={prepare}
        className={cn(buttonClass('primary'), 'min-h-[44px]')}
      >
        <KeyRound className="h-4 w-4" aria-hidden />{' '}
        {pending ? 'Getting logins…' : `Get ${chosen.length} login${chosen.length === 1 ? '' : 's'}`}
      </button>
    </div>
  )
}

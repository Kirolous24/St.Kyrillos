'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { UserCog, GraduationCap, KeyRound } from 'lucide-react'
import { createServant, updateServant, resetServantPin, deleteServant, type ServantFormInput } from '@/lib/portal/actions/admin'
import { Card, Field, inputClass, selectClass, checkboxClass, buttonClass, Callout, Badge } from '@/components/portal/ui'
import { accentFor } from '@/lib/portal/accents'
import { cn } from '@/lib/utils'

interface Props {
  mode: 'create' | 'edit'
  accountId?: string
  isSelf?: boolean
  classes: Array<{ id: string; name: string }>
  initial?: Partial<ServantFormInput>
}

/** The prototype's .grid2. */
const GRID2 = 'grid grid-cols-1 gap-x-4 sm:grid-cols-2'

export function ServantForm({ mode, accountId, isSelf, classes, initial }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [creds, setCreds] = useState<{ loginId: string; pin: string } | null>(null)
  // F0851 — see the share row under the new credentials below.
  const [copied, setCopied] = useState(false)
  const [form, setForm] = useState<ServantFormInput>({
    displayName: initial?.displayName ?? '',
    role: initial?.role ?? 'SERVANT',
    email: initial?.email ?? '',
    phone: initial?.phone ?? '',
    birthday: initial?.birthday ?? '',
    address: initial?.address ?? '',
    stageOversight: initial?.stageOversight ?? '',
    classes: initial?.classes ?? [],
    isActive: initial?.isActive ?? true,
  })

  /**
   * F0851 — what an admin actually has to send a new servant. The PIN is shown
   * once and never again, so without this they read eight digits off a screen
   * and retype them into a message; one wrong digit and the servant meets a
   * login screen on a Sunday morning and the PIN has to be reset again.
   */
  const shareText = creds
    ? `St. Kyrillos Sunday School portal\n${typeof window === 'undefined' ? '' : `${window.location.origin}/portal/login\n`}ID: ${creds.loginId}\nPIN: ${creds.pin}`
    : ''
  const shareRow = creds ? (
    <div className="mt-3.5 flex flex-wrap gap-2">
      <button
        type="button"
        className={cn(buttonClass('secondary'), 'min-h-[40px]')}
        onClick={() => {
          void navigator.clipboard
            ?.writeText(shareText)
            .then(() => {
              setError('')
              setCopied(true)
            })
            .catch(() => setError('This browser would not let the portal copy. Write the ID and PIN down instead.'))
        }}
      >
        {copied ? 'Copied — paste it to them' : 'Copy ID and PIN'}
      </button>
      {/* Only when an address was actually typed in above, so the button can
          never open a blank compose window. */}
      {form.email && (
        <a
          href={`mailto:${encodeURIComponent(form.email)}?subject=${encodeURIComponent('Your Sunday School portal sign-in')}&body=${encodeURIComponent(shareText)}`}
          className={cn(buttonClass('secondary'), 'min-h-[40px]')}
        >
          Email it to {form.displayName || 'them'}
        </a>
      )}
    </div>
  ) : null
  const set = (k: keyof ServantFormInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value })

  function toggleClass(classId: string) {
    setForm((f) => ({
      ...f,
      classes: f.classes.some((c) => c.classId === classId) ? f.classes.filter((c) => c.classId !== classId) : [...f.classes, { classId, title: '' }],
    }))
  }
  function setTitle(classId: string, title: '' | 'COORDINATOR' | 'ASSISTANT_COORDINATOR') {
    setForm((f) => ({ ...f, classes: f.classes.map((c) => (c.classId === classId ? { ...c, title } : c)) }))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    startTransition(async () => {
      if (mode === 'create') {
        const r = await createServant(form)
        if (!r.ok) return setError(r.error)
        setCreds({ loginId: r.data!.loginId, pin: r.data!.pin })
      } else {
        const r = await updateServant(accountId!, form)
        if (!r.ok) return setError(r.error)
        router.push('/portal/admin/servants')
        router.refresh()
      }
    })
  }

  if (creds && mode === 'create') {
    return (
      <Card title="Account created" icon={<KeyRound className="h-[15px] w-[15px]" />}>
        <p className="text-[12.5px] text-parch-700">Share these with {form.displayName}. The PIN is shown only once.</p>
        <dl className="mt-3.5 grid grid-cols-2 gap-3 text-center">
          <div className="rounded-[12px] border border-brand-gold/40 bg-brand-wash p-3.5">
            <dt className="text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">ID</dt>
            <dd className="font-serif text-[26px] font-bold tracking-[0.2em] text-brand-800 tabular-nums">{creds.loginId}</dd>
          </div>
          <div className="rounded-[12px] border border-brand-gold/40 bg-brand-wash p-3.5">
            <dt className="text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">PIN</dt>
            <dd className="font-serif text-[26px] font-bold tracking-[0.2em] text-brand-800 tabular-nums">{creds.pin}</dd>
          </div>
        </dl>
        <button type="button" className={cn(buttonClass('primary'), 'mt-4 min-h-[40px]')} onClick={() => { router.push('/portal/admin/servants'); router.refresh() }}>Back to servants</button>
      </Card>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-3.5">
      <Card title="Account" icon={<UserCog className="h-[15px] w-[15px]" />}>
        <div className={GRID2}>
          <Field label="Full name" htmlFor="displayName"><input id="displayName" value={form.displayName} onChange={set('displayName')} className={inputClass} required maxLength={80} /></Field>
          <Field label="Role" htmlFor="role">
            <select id="role" value={form.role} onChange={set('role')} className={selectClass} disabled={isSelf}>
              <option value="SERVANT">Servant</option><option value="PASTOR">Pastor</option><option value="ADMIN">Admin</option>
            </select>
          </Field>
          <Field label="Email" htmlFor="email" hint="Optional — for contact."><input id="email" type="email" value={form.email ?? ''} onChange={set('email')} className={inputClass} maxLength={120} /></Field>
          <Field label="Phone" htmlFor="phone"><input id="phone" type="tel" value={form.phone ?? ''} onChange={set('phone')} className={inputClass} maxLength={30} /></Field>
          <Field label="Birthday" htmlFor="birthday"><input id="birthday" type="date" value={form.birthday ?? ''} onChange={set('birthday')} className={inputClass} /></Field>
          <Field label="Address" htmlFor="address"><input id="address" value={form.address ?? ''} onChange={set('address')} className={inputClass} maxLength={200} /></Field>
        </div>
        {mode === 'edit' && !isSelf && (
          <label className="flex items-center gap-2 text-[12.5px] text-parch-800">
            <input type="checkbox" className={checkboxClass} checked={form.isActive ?? true} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
            Account active (can sign in)
          </label>
        )}
        {mode === 'create' && (
          <Callout tone="warn">
            Everyone signs in with an auto-generated <strong>4-digit ID and 4-digit PIN</strong> — no password to remember. You&rsquo;ll see both right after saving.
          </Callout>
        )}
      </Card>

      <Card title="Classes" icon={<GraduationCap className="h-[15px] w-[15px]" />}>
        {/* F0551 — a pastor reads every class and is enrolled in none, so a grid
            of class checkboxes invited an admin to tick something that means
            nothing for that role and would then show the pastor on a roster as
            though he served there. The prototype hid this card for Pastor. */}
        {form.role === 'PASTOR' ? (
          <p className="text-[12.5px] text-parch-500">
            A pastor is not assigned to classes — the role already reads every class.
          </p>
        ) : classes.length === 0 ? (
          <p className="text-[12.5px] text-parch-500">No active classes yet.</p>
        ) : (
          <ul className={cn(GRID2, 'gap-y-2')}>
            {classes.map((c) => {
              const m = form.classes.find((x) => x.classId === c.id)
              const accent = accentFor(c.id)
              return (
                <li
                  key={c.id}
                  className={cn(
                    'flex min-h-[44px] flex-wrap items-center gap-2 rounded-[12px] border-[1.5px] px-3 py-2',
                    m ? 'border-brand-gold bg-brand-wash' : 'border-parch-200 bg-parch-50',
                  )}
                >
                  <label className="flex flex-1 items-center gap-2 text-[12.5px] font-semibold text-parch-900">
                    <input type="checkbox" className={checkboxClass} checked={!!m} onChange={() => toggleClass(c.id)} />
                    <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: accent }} />
                    {c.name}
                  </label>
                  {m && (
                    <select
                      value={m.title}
                      onChange={(e) => setTitle(c.id, e.target.value as '' | 'COORDINATOR' | 'ASSISTANT_COORDINATOR')}
                      className="rounded-lg border-[1.5px] border-parch-200 bg-parch-50 px-2 py-1.5 text-[11px] font-semibold text-parch-900 outline-none focus:border-brand-gold"
                      aria-label={`Title in ${c.name}`}
                    >
                      <option value="">Servant</option><option value="COORDINATOR">Coordinator</option><option value="ASSISTANT_COORDINATOR">Assistant Coordinator</option>
                    </select>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        <div className="mt-4 max-w-xs">
          <Field label="Stage coordinator" htmlFor="stageOversight" hint="Separate from a class position — can view every class in this stage.">
            <select id="stageOversight" value={form.stageOversight ?? ''} onChange={set('stageOversight')} className={selectClass}>
              <option value="">None</option><option value="ELEMENTARY">Elementary</option><option value="MIDDLE_SCHOOL">Middle School</option><option value="HIGH_SCHOOL">High School</option>
            </select>
          </Field>
        </div>
      </Card>

      {error && <div role="alert"><Callout tone="bad">{error}</Callout></div>}

      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={pending} className={cn(buttonClass('primary'), 'min-h-[40px]')}>{pending ? 'Saving…' : mode === 'create' ? 'Create account' : 'Save changes'}</button>
        <button type="button" className={cn(buttonClass('secondary'), 'min-h-[40px]')} onClick={() => router.push('/portal/admin/servants')}>Cancel</button>
        {mode === 'edit' && (
          <>
            {creds ? (
              <span className="inline-flex items-center gap-2 rounded-[10px] border border-brand-gold/40 bg-brand-wash px-3 py-2 text-[12px] text-parch-800">
                New PIN for ID {creds.loginId}: <strong className="font-serif text-[15px] tracking-[0.2em] text-brand-800 tabular-nums">{creds.pin}</strong>
              </span>
            ) : (
              <button
                type="button"
                disabled={pending}
                className={cn(buttonClass('secondary'), 'min-h-[40px]')}
                onClick={() => { if (confirm('Reset this PIN?')) startTransition(async () => { const r = await resetServantPin(accountId!); if (r.ok) setCreds(r.data!); else setError(r.error) }) }}
              >
                Reset PIN
              </button>
            )}
            {isSelf && <Badge tone="gold">This is you</Badge>}
            {!isSelf && (
              <button
                type="button"
                disabled={pending}
                className={cn(buttonClass('danger'), 'ml-auto min-h-[40px]')}
                onClick={() => { if (confirm('Delete this account? Attendance they marked is kept.')) startTransition(async () => { const r = await deleteServant(accountId!); if (!r.ok) return setError(r.error); router.push('/portal/admin/servants'); router.refresh() }) }}
              >
                Delete
              </button>
            )}
          </>
        )}
      </div>
    </form>
  )
}

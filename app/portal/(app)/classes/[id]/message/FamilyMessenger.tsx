'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, MessageCircle, MessageSquare, RotateCcw, Save } from 'lucide-react'
import Link from '@/components/portal/Link'
import { Badge, Callout, buttonClass, textareaClass } from '@/components/portal/ui'
import { ExcuseNote } from '@/components/portal/ExcuseNote'
import { recordFamilyMessage, resetMeetingMessage, saveMeetingMessage } from '@/lib/portal/actions/family-messages'
import { MESSAGE_MAX, MESSAGE_PLACEHOLDERS, fillMessage, messageProblem, smsHref, whatsAppHref } from '@/lib/portal/family-messages'
import type { MissedKid, SavedMessage } from '@/lib/portal/data/family-messages'
import type { KidPhone } from '@/lib/portal/phones'
import { formatLongDate } from '@/lib/portal/format'
import { cn } from '@/lib/utils'

type Channel = 'whatsapp' | 'text'

const CHANNEL_KEY = 'portal:family-message:channel'
const draftKey = (classId: string, sessionKey: string, date: string) => `portal:family-message:${classId}:${sessionKey}:${date}`

/** Browser storage can be missing or blocked (a private window); the page works without it. */
function stored(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}
function store(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    /* nothing to keep it in */
  }
}

const METHOD_LABEL: Record<string, string> = { whatsapp: 'WhatsApp', text: 'Text', email: 'Email' }

/**
 * Message families (2026-10-19): one message, written once, for every family
 * whose child missed the meeting. Each button opens WhatsApp or Messages with
 * that child's own copy written in; the servant sends it there and comes back
 * for the next. A change made here is used for every family on the page and
 * kept on this phone until it is saved as the class's message or dropped. That
 * is what lets it survive the trip to WhatsApp and back.
 */
export function FamilyMessenger({
  classId,
  sessionKey,
  meeting,
  date,
  today,
  saved,
  kids,
  members = false,
}: {
  /** A Fellowship meeting (2026-10-24): each message goes to the member, not a family. */
  members?: boolean
  classId: string
  sessionKey: string
  meeting: string
  date: string
  today: string
  saved: SavedMessage
  kids: MissedKid[]
}) {
  const router = useRouter()
  const box = useRef<HTMLTextAreaElement>(null)
  const [text, setText] = useState(saved.body)
  const [restored, setRestored] = useState(false)
  const [channel, setChannel] = useState<Channel>('whatsapp')
  const [chosen, setChosen] = useState<Record<string, string>>({})
  const [justSent, setJustSent] = useState<Record<string, { method: Channel; to: string }>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  // What to note again when noting a message failed: it may have gone anyway.
  const [retry, setRetry] = useState<Record<string, { phone: KidPhone; message: string; method: Channel }>>({})
  const [notice, setNotice] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null)
  const [saving, startSaving] = useTransition()
  const [, startRecording] = useTransition()
  const key = draftKey(classId, sessionKey, date)

  // After mount only, so the server's render and the first client render agree.
  useEffect(() => {
    const draft = stored(key)
    if (draft !== null && draft !== saved.body) {
      setText(draft)
      setRestored(true)
    }
    const ch = stored(CHANNEL_KEY)
    if (ch === 'whatsapp' || ch === 'text') setChannel(ch)
    // Only on arriving at this meeting; later saves bring a new `saved` on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  function edit(next: string) {
    setText(next)
    store(key, next === saved.body ? null : next)
  }

  function insert(token: string) {
    const el = box.current
    const at = el ? el.selectionStart : text.length
    const end = el ? el.selectionEnd : text.length
    const next = `${text.slice(0, at)}${token}${text.slice(end)}`
    edit(next)
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(at + token.length, at + token.length)
    })
  }

  function pickChannel(next: Channel) {
    setChannel(next)
    store(CHANNEL_KEY, next)
  }

  const problem = messageProblem(text)
  const changed = text !== saved.body
  const preview = kids[0] ? fillMessage(text, { name: kids[0].firstName, meeting, date }) : ''

  function saveAsClassMessage() {
    setNotice(null)
    startSaving(async () => {
      const r = await saveMeetingMessage({ classId, sessionKey, body: text })
      if (!r.ok) return setNotice({ tone: 'bad', text: r.error })
      const body = text.trim()
      setText(body)
      store(key, null)
      setRestored(false)
      setNotice({ tone: 'good', text: `Saved. Your class’s ${meeting} message now starts like this.` })
      router.refresh()
    })
  }

  function startOver() {
    edit(saved.body)
    setRestored(false)
    setNotice(null)
  }

  function backToStandard() {
    if (!window.confirm(`Go back to the standard ${meeting} message? The ${members ? 'meeting’s' : 'class’s'} own one is removed.`)) return
    setNotice(null)
    startSaving(async () => {
      const r = await resetMeetingMessage({ classId, sessionKey })
      if (!r.ok) return setNotice({ tone: 'bad', text: r.error })
      store(key, null)
      setRestored(false)
      setNotice({ tone: 'good', text: 'Back to the standard message.' })
      router.refresh()
    })
  }

  // The server's `saved` changes after a save or a reset: follow it unless the
  // servant is in the middle of their own change.
  const lastSaved = useRef(saved.body)
  useEffect(() => {
    if (lastSaved.current !== saved.body) {
      if (stored(key) === null) setText(saved.body)
      lastSaved.current = saved.body
    }
  }, [saved.body, key])

  const without = <T,>(m: Record<string, T>, id: string) => {
    const rest = { ...m }
    delete rest[id]
    return rest
  }

  /**
   * The link opens the app (a plain link, so no pop-up blocker); this notes it.
   * The phone may leave for WhatsApp before the note is saved, so a failure is
   * caught and offered again rather than left to break the page.
   */
  function sent(kid: MissedKid, phone: KidPhone, message: string, method: Channel = channel) {
    // A member is messaged on their own phone, so the note names them (2026-10-24).
    const to = members ? kid.firstName : phone.label
    setJustSent((m) => ({ ...m, [kid.id]: { method, to } }))
    setErrors((m) => without(m, kid.id))
    setRetry((m) => without(m, kid.id))
    startRecording(async () => {
      let error: string | null = null
      try {
        const r = await recordFamilyMessage({ studentId: kid.id, classId, channel: method, to, text: message, missed: { sessionKey, date } })
        if (!r.ok) error = r.error
      } catch {
        error = 'The connection dropped before it was noted.'
      }
      if (error) {
        setErrors((m) => ({ ...m, [kid.id]: `${error} If the message went, note it here.` }))
        setRetry((m) => ({ ...m, [kid.id]: { phone, message, method } }))
        setJustSent((m) => without(m, kid.id))
      } else {
        router.refresh()
      }
    })
  }

  const done = kids.filter((k) => k.sent.length > 0 || justSent[k.id]).length
  const next = kids.find((k) => !k.excused && k.phones.length > 0 && k.sent.length === 0 && !justSent[k.id])

  return (
    <div className="grid gap-5 lg:grid-cols-5">
      <section className="space-y-3 lg:col-span-2" aria-labelledby="message-heading">
        <div className="rounded-[16px] border border-parch-200 border-l-[3px] border-l-brand-gold bg-parch-50 p-4 shadow-card">
          <h2 id="message-heading" className="mb-1 font-serif text-[15px] font-bold text-parch-900">
            The message
          </h2>
          <p className="mb-3 text-[12px] text-parch-600">
            {saved.isStandard
              ? members
                ? `The standard message. Change it for this ${meeting} if you like. Everyone below gets it with their own name.`
                : `The standard message. Change it for this ${meeting}: say what you read or did. Every family below gets it with their own child’s name.`
              : `${members ? 'The meeting’s' : 'Your class’s'} ${meeting} message${saved.by ? `, last changed by ${saved.by}` : ''}${saved.day ? ` on ${formatLongDate(saved.day)}` : ''}. Change it for this one if you like.`}
          </p>
          <textarea
            id="family-message"
            ref={box}
            value={text}
            onChange={(e) => edit(e.target.value)}
            rows={8}
            maxLength={MESSAGE_MAX + 200}
            aria-label={members ? 'The message everyone gets' : 'The message every family gets'}
            aria-describedby="family-message-help"
            className={cn(textareaClass, 'resize-y')}
          />
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5" id="family-message-help">
            {MESSAGE_PLACEHOLDERS.map((p) => (
              <button
                key={p.token}
                type="button"
                onClick={() => insert(p.token)}
                className="rounded-[8px] border border-parch-200 bg-parch-100 px-2 py-1 text-[11px] font-semibold text-parch-700 hover:border-brand-gold/60"
                title={`Adds ${p.token}: ${p.label.toLowerCase()}`}
              >
                + {members && p.token === '{name}' ? 'First name' : p.label}
              </button>
            ))}
            <span className={cn('ml-auto text-[11px] tabular-nums', text.length > MESSAGE_MAX ? 'font-bold text-[#DC2626]' : 'text-parch-500')}>
              {text.length}/{MESSAGE_MAX}
            </span>
          </div>
          {restored && changed && (
            <p className="mt-2 text-[11.5px] text-parch-600">Your changes from earlier are back.</p>
          )}
          {problem && text.length > 0 && <p className="mt-2 text-[12px] font-semibold text-[#DC2626]">{problem}</p>}

          {kids[0] && !problem && (
            <div className="mt-3 rounded-[12px] border border-[#EFE9DC] bg-parch-100 px-3 py-2.5" data-testid="message-preview">
              <p className="mb-1 text-[10.5px] font-bold uppercase tracking-[0.8px] text-parch-500">
                {members ? `What ${kids[0].firstName} gets` : `What ${kids[0].firstName}’s family gets`}
              </p>
              <p className="whitespace-pre-wrap break-words text-[12.5px] leading-relaxed text-parch-800">{preview}</p>
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            {changed && (
              <>
                <button type="button" onClick={saveAsClassMessage} disabled={saving || !!problem} className={buttonClass('secondary', 'sm')}>
                  <Save className="h-3.5 w-3.5" aria-hidden /> Save as our {meeting} message
                </button>
                <button type="button" onClick={startOver} disabled={saving} className={buttonClass('ghost', 'sm')}>
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Start over
                </button>
              </>
            )}
            {!changed && !saved.isStandard && (
              <button type="button" onClick={backToStandard} disabled={saving} className={buttonClass('ghost', 'sm')}>
                <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Use the standard message
              </button>
            )}
          </div>
          {changed && (
            <p className="mt-2 text-[11.5px] text-parch-500">
              Saving makes it where every {meeting} message starts. Without saving, this change is used for everyone on this page and kept
              on this phone.
            </p>
          )}
          {notice && (
            <div className="mt-3">
              <Callout tone={notice.tone}>{notice.text}</Callout>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-3 lg:col-span-3" aria-labelledby="send-heading">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="send-heading" className="font-serif text-[15px] font-bold text-parch-900">
            Send it <span className="ml-1 text-[12px] font-semibold text-parch-500">{done} of {kids.length} sent</span>
          </h2>
          <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Send with">
            {([['whatsapp', 'WhatsApp'], ['text', 'Text message']] as const).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => pickChannel(k)}
                aria-pressed={channel === k}
                className={cn(
                  'rounded-[9px] border-[1.5px] px-3 py-1.5 text-[12px] font-bold transition-colors',
                  channel === k ? 'border-brand-gold bg-[#FDF5E4] text-parch-900' : 'border-[#E7E2DA] bg-parch-50 text-parch-500',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[12px] text-parch-600">
          Each button opens {channel === 'whatsapp' ? 'WhatsApp' : 'your Messages app'} with {members ? 'their' : 'that family’s'} message written in. Send it
          there, then come back for the next. Each one is noted on {members ? 'their' : 'the child’s'} follow-ups.
        </p>

        <ul className="space-y-2.5">
          {kids.map((kid) => {
            const phone = kid.phones.find((p) => p.digits === chosen[kid.id]) ?? kid.phones[0] ?? null
            const message = fillMessage(text, { name: kid.firstName, meeting, date })
            const href = phone ? (channel === 'whatsapp' ? whatsAppHref(phone.digits, message) : smsHref(phone.digits, message)) : null
            const local = justSent[kid.id]
            const isNext = next?.id === kid.id
            const who = phone ? (phone.label === 'Student' ? kid.firstName : phone.label) : ''
            return (
              <li
                key={kid.id}
                data-testid="missed-kid"
                data-student={kid.id}
                className={cn(
                  'rounded-[14px] border bg-parch-50 p-3 shadow-card',
                  isNext ? 'border-brand-gold ring-2 ring-brand-gold/25' : 'border-parch-200',
                )}
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <Link href={members ? `/portal/members/${kid.id}` : `/portal/students/${kid.id}`} className="font-serif text-[14px] font-bold text-parch-900 hover:text-brand-800">
                    {kid.name}
                  </Link>
                  <Badge tone={kid.marked ? 'bad' : 'warn'}>{kid.marked ? 'Absent' : 'Not marked'}</Badge>
                  {(kid.sent.length > 0 || local) && (
                    <Badge tone="good">
                      <Check className="h-3 w-3" aria-hidden /> Sent
                    </Badge>
                  )}
                </div>
                {kid.excuse && <ExcuseNote excuse={kid.excuse} today={today} className="mt-2" />}

                {kid.phones.length === 0 ? (
                  <p className="mt-2 text-[12px] text-parch-600">
                    No phone number on file.{' '}
                    <Link href={members ? `/portal/members/${kid.id}` : `/portal/students/${kid.id}`} className="font-bold text-brand-800 underline decoration-brand-gold underline-offset-2">
                      Add one on their page
                    </Link>
                  </p>
                ) : (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {kid.phones.length > 1 ? (
                      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={`Who to message for ${kid.name}`}>
                        {kid.phones.map((p) => (
                          <button
                            key={p.digits}
                            type="button"
                            role="radio"
                            aria-checked={phone?.digits === p.digits}
                            onClick={() => setChosen((m) => ({ ...m, [kid.id]: p.digits }))}
                            className={cn(
                              'rounded-[9px] border-[1.5px] px-2.5 py-1 text-[11.5px] font-semibold transition-colors',
                              phone?.digits === p.digits ? 'border-brand-800 bg-brand-wash text-parch-900' : 'border-[#E7E2DA] text-parch-600',
                            )}
                          >
                            {p.label} · {p.display}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[11.5px] text-parch-600">
                        {phone!.label} · {phone!.display}
                      </span>
                    )}
                    {href && !problem ? (
                      <a
                        href={href}
                        target={channel === 'whatsapp' ? '_blank' : undefined}
                        rel={channel === 'whatsapp' ? 'noopener noreferrer' : undefined}
                        onClick={() => sent(kid, phone!, message)}
                        className={cn(buttonClass(isNext ? 'primary' : 'secondary', 'sm'), 'ml-auto min-h-[38px]')}
                        data-testid="send-family-message"
                      >
                        {channel === 'whatsapp' ? (
                          <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                        ) : (
                          <MessageSquare className="h-3.5 w-3.5" aria-hidden />
                        )}
                        {channel === 'whatsapp' ? 'WhatsApp' : 'Text'} {who}
                      </a>
                    ) : (
                      <span className={cn(buttonClass('secondary', 'sm'), 'ml-auto min-h-[38px] cursor-not-allowed opacity-50')} aria-disabled="true">
                        Write the message first
                      </span>
                    )}
                  </div>
                )}

                {(kid.sent.length > 0 || local) && (
                  <ul className="mt-2 space-y-0.5 text-[11.5px] text-parch-600" data-testid="sent-lines">
                    {kid.sent.map((s, i) => (
                      <li key={i}>
                        ✓ {METHOD_LABEL[s.method] ?? s.method}
                        {s.to ? ` to ${s.to}` : ''} · {s.when}
                        {s.by ? ` · ${s.by}` : ''}
                      </li>
                    ))}
                    {local && kid.sent.length === 0 && (
                      <li>
                        ✓ {METHOD_LABEL[local.method]} to {local.to} · just now
                      </li>
                    )}
                  </ul>
                )}
                {errors[kid.id] && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <p className="text-[12px] font-semibold text-[#DC2626]">{errors[kid.id]}</p>
                    {retry[kid.id] && (
                      <button
                        type="button"
                        onClick={() => sent(kid, retry[kid.id]!.phone, retry[kid.id]!.message, retry[kid.id]!.method)}
                        className={buttonClass('secondary', 'sm')}
                      >
                        <Check className="h-3.5 w-3.5" aria-hidden /> Note it as sent
                      </button>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}

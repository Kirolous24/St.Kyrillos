'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { BellRing, Send, Share, Smartphone } from 'lucide-react'
import { buttonClass, Callout } from './ui'
import { removePushSubscription, savePushSubscription, sendTestNotice, setNoticeEmails } from '@/lib/portal/actions/notices'
import { isIosDevice, phoneSupport, urlBase64ToUint8Array, type PhoneSupport } from '@/lib/portal/push-client'

type DeviceState = 'checking' | 'on' | 'off' | 'blocked'

const SCOPE = '/portal'

/**
 * Settings → Notifications (2026-10-19): turn phone notifications on for this
 * phone or computer, choose email, and send a test. An iPhone in Safari is
 * shown how to add the portal to the Home Screen first, the only place Apple
 * offers notifications to a web app.
 */
export function NotificationSettings({
  publicKey,
  phonesOn,
  email,
  emailOn,
}: {
  /** Null when phone notifications are not set up on this site. */
  publicKey: string | null
  /** Phones and computers this servant has turned on, everywhere. */
  phonesOn: number
  email: string | null
  emailOn: boolean
}) {
  const router = useRouter()
  const [support, setSupport] = useState<PhoneSupport | 'checking'>('checking')
  const [device, setDevice] = useState<DeviceState>('checking')
  const [message, setMessage] = useState<{ tone: 'good' | 'bad' | 'info'; text: string } | null>(null)
  const [busy, startBusy] = useTransition()

  useEffect(() => {
    if (!publicKey) return
    const ios = isIosDevice(navigator.userAgent, navigator.maxTouchPoints ?? 0)
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
    const s = phoneSupport({
      hasServiceWorker: 'serviceWorker' in navigator,
      hasPushManager: 'PushManager' in window,
      hasNotification: 'Notification' in window,
      ios,
      standalone,
    })
    setSupport(s)
    if (s !== 'ok') return
    if (Notification.permission === 'denied') return setDevice('blocked')
    navigator.serviceWorker
      .getRegistration(SCOPE)
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => setDevice(sub ? 'on' : 'off'))
      .catch(() => setDevice('off'))
  }, [publicKey])

  function turnOn() {
    if (!publicKey) return
    setMessage(null)
    // Asked first, inside the tap: Safari only shows the question for a tap.
    const asking = Notification.requestPermission()
    startBusy(async () => {
      try {
        const permission = await asking
        if (permission !== 'granted') {
          setDevice(permission === 'denied' ? 'blocked' : 'off')
          return setMessage({ tone: 'bad', text: 'Notifications were not allowed on this device.' })
        }
        await navigator.serviceWorker.register('/portal-sw.js', { scope: SCOPE })
        const reg = await navigator.serviceWorker.ready
        const sub =
          (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource }))
        const json = sub.toJSON()
        const r = await savePushSubscription({
          endpoint: sub.endpoint,
          keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' },
          userAgent: navigator.userAgent.slice(0, 300),
        })
        if (!r.ok) return setMessage({ tone: 'bad', text: r.error })
        setDevice('on')
        setMessage({ tone: 'good', text: 'Phone notifications are on for this device.' })
        router.refresh()
      } catch {
        setMessage({ tone: 'bad', text: 'This device could not turn notifications on. Try again, or use email instead.' })
      }
    })
  }

  function turnOff() {
    setMessage(null)
    startBusy(async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration(SCOPE)
        const sub = await reg?.pushManager.getSubscription()
        if (sub) {
          await removePushSubscription(sub.endpoint)
          await sub.unsubscribe().catch(() => {})
        }
        setDevice('off')
        setMessage({ tone: 'info', text: 'Phone notifications are off for this device.' })
        router.refresh()
      } catch {
        setMessage({ tone: 'bad', text: 'This device could not turn notifications off.' })
      }
    })
  }

  function emailChoice(on: boolean) {
    setMessage(null)
    startBusy(async () => {
      const r = await setNoticeEmails(on)
      if (!r.ok) setMessage({ tone: 'bad', text: r.error })
      router.refresh()
    })
  }

  function test() {
    setMessage(null)
    startBusy(async () => {
      const r = await sendTestNotice()
      if (!r.ok) return setMessage({ tone: 'bad', text: r.error })
      const { pushed, emailed } = r.data ?? { pushed: 0, emailed: 0 }
      setMessage(
        pushed
          ? { tone: 'good', text: 'Sent. It should appear on your device in a moment. If it does not, wait a minute and send another: a device that has only just been turned on sometimes misses the first.' }
          : emailed
            ? { tone: 'good', text: `Emailed to ${email ?? 'you'}.` }
            : { tone: 'info', text: 'It is in your bell. Turn on phone notifications, or ask for an email to be added, to get it elsewhere.' },
      )
      router.refresh()
    })
  }

  return (
    <div className="space-y-4 text-[12.5px] text-parch-700" data-testid="notification-settings">
      <p>
        You are told when you are given a part of a Sunday class or taken off one. Every evening you are reminded of the parts
        you have not marked done yet, and on Saturday evening of everything for Sunday. It always shows in the bell; here you
        choose where else it reaches you. Email brings only the Saturday evening reminder.
      </p>

      <section aria-labelledby="phone-heading" className="rounded-[12px] border border-parch-200 bg-parch-100/50 p-3">
        <h3 id="phone-heading" className="mb-1 flex items-center gap-1.5 text-[12.5px] font-bold text-parch-900">
          <Smartphone className="h-4 w-4 text-brand-gold-dark" aria-hidden /> Phone notifications
        </h3>
        {!publicKey ? (
          <p className="text-parch-600">Phone notifications are not set up on the portal yet.</p>
        ) : support === 'checking' || (support === 'ok' && device === 'checking') ? (
          <p className="text-parch-500">Checking this device…</p>
        ) : support === 'ios-install' ? (
          <div data-testid="ios-install-steps">
            <p className="mb-1.5">On an iPhone or iPad, notifications come only through the portal on your Home Screen:</p>
            <ol className="ml-4 list-decimal space-y-0.5">
              <li>
                Tap <Share className="inline h-3.5 w-3.5 align-[-2px]" aria-label="Share" /> at the bottom of Safari.
              </li>
              <li>Choose <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</li>
              <li>Open <strong>Sunday School</strong> from your Home Screen and sign in.</li>
              <li>Come back to My Settings there and tap <strong>Turn on</strong>.</li>
            </ol>
            <p className="mt-1.5 text-[11.5px] text-parch-500">This needs iOS 16.4 or later.</p>
          </div>
        ) : support === 'unsupported' ? (
          <p className="text-parch-600">
            This browser cannot show notifications. On an iPhone, update to iOS 16.4 or later and open the portal from your Home
            Screen; otherwise use email below.
          </p>
        ) : device === 'blocked' ? (
          <p className="text-parch-600">Notifications are blocked for this site in this browser’s settings. Allow them there, then come back.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className={device === 'on' ? 'font-bold text-[#16A34A]' : 'text-parch-600'}>
              {device === 'on' ? 'On for this device.' : 'Off for this device.'}
            </span>
            {device === 'on' ? (
              <button type="button" onClick={turnOff} disabled={busy} className={buttonClass('secondary', 'sm')}>
                Turn off
              </button>
            ) : (
              <button type="button" onClick={turnOn} disabled={busy} className={buttonClass('primary', 'sm')}>
                <BellRing className="h-3.5 w-3.5" aria-hidden /> Turn on
              </button>
            )}
          </div>
        )}
        {publicKey && phonesOn > 0 && (
          <p className="mt-1.5 text-[11.5px] text-parch-500" data-testid="phones-on">
            On for {phonesOn} {phonesOn === 1 ? 'device' : 'devices'} in all.
          </p>
        )}
      </section>

      <section aria-labelledby="email-heading" className="rounded-[12px] border border-parch-200 bg-parch-100/50 p-3">
        <h3 id="email-heading" className="mb-1 text-[12.5px] font-bold text-parch-900">Email</h3>
        {email ? (
          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="checkbox"
              checked={emailOn}
              disabled={busy}
              onChange={(e) => emailChoice(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#6F1D1B]"
            />
            <span>
              Email me at <strong>{email}</strong> while no phone has notifications on.
            </span>
          </label>
        ) : (
          <p className="text-parch-600">There is no email on your account. Ask the office to add one if you would like emails.</p>
        )}
      </section>

      <div>
        <button type="button" onClick={test} disabled={busy} className={buttonClass('secondary', 'sm')}>
          <Send className="h-3.5 w-3.5" aria-hidden /> Send me a test
        </button>
      </div>

      {message && <Callout tone={message.tone}>{message.text}</Callout>}
    </div>
  )
}

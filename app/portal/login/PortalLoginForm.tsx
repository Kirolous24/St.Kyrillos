'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, UserRound, KeyRound } from 'lucide-react'
import { safeNextPath } from '@/lib/portal/login'

const REMEMBER_KEY = 'portal:rememberedId'

/**
 * The sign-in landing, ported from the prototype's `.login-bg` / `.login-box`:
 * a full-bleed church photo under a slow Ken Burns pan, the church wordmark
 * top-left, the invitation on the left, and a frosted card on the right.
 */
export function PortalLoginForm() {
  const [loginId, setLoginId] = useState('')
  const [pin, setPin] = useState('')
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const search = useSearchParams()

  // Only the ID is ever remembered — never the PIN.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(REMEMBER_KEY)
      if (saved) {
        setLoginId(saved)
        setRemember(true)
      }
    } catch {
      /* private browsing, or storage blocked — the form still works */
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await signIn('portal', { loginId, pin, redirect: false })
    setLoading(false)
    if (result?.error) {
      setError('That ID and PIN do not match. After 5 wrong tries the account is locked for 15 minutes.')
      return
    }
    try {
      if (remember) window.localStorage.setItem(REMEMBER_KEY, loginId)
      else window.localStorage.removeItem(REMEMBER_KEY)
    } catch {
      /* ignore */
    }
    // Back to whatever they were trying to reach — a scanned code, usually.
    router.replace(safeNextPath(search.get('next')) ?? '/portal')
    router.refresh()
  }

  const digits = (v: string, max: number) => v.replace(/\D/g, '').slice(0, max)

  const fieldClass =
    'h-14 w-full rounded-[14px] border-[1.5px] border-[#E7DFCF] bg-parch-50 pl-12 pr-4 text-center font-bold tracking-[4px] text-[18px] text-[#2E2E2E] outline-none transition-all placeholder:font-normal placeholder:tracking-[4px] placeholder:text-[#BDB29B] focus:border-brand-gold focus:ring-4 focus:ring-brand-gold/20'

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#3D1418] px-4 py-8 font-body lg:justify-end lg:px-16">
      {/* ── Background ── */}
      <div className="portal-kenburns absolute inset-0 z-0">
        <Image
          src="/images/portal-login-bg.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      </div>
      <div
        aria-hidden
        className="absolute inset-0 z-[1]"
        style={{
          background:
            'linear-gradient(115deg,rgba(61,20,24,.16) 0%,rgba(61,20,24,.07) 38%,rgba(61,20,24,.02) 62%,rgba(61,20,24,0) 80%), linear-gradient(0deg,rgba(20,10,8,.10) 0%,rgba(20,10,8,0) 40%)',
        }}
      />

      {/* ── Church wordmark ── */}
      <Link
        href="/"
        className="portal-slide-left absolute left-10 top-8 z-[2] hidden items-center gap-3 lg:flex"
      >
        <Image
          src="/images/Logo.png"
          alt=""
          width={60}
          height={60}
          className="h-[46px] w-[46px] rounded-full border-[1.5px] border-white/55 object-cover shadow-[0_4px_14px_rgba(0,0,0,.3)] lg:h-[60px] lg:w-[60px]"
        />
        <span className="[text-shadow:0_2px_8px_rgba(0,0,0,.5)]">
          <span className="block font-serif text-[11px] font-bold uppercase leading-tight tracking-[2px] text-white/95 lg:text-[12px]">
            St. Kyrillos the Sixth
          </span>
          <span className="mt-0.5 block text-[9px] uppercase tracking-[2.5px] text-white/70 lg:text-[10px]">
            Coptic Orthodox Church
          </span>
        </span>
      </Link>

      {/* ── The invitation ── */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-[2] hidden max-w-[620px] flex-col justify-center pl-10 pr-6 text-white lg:flex">
        <h1 className="portal-slide-left mb-4 font-serif text-[clamp(32px,4vw,52px)] font-bold leading-[1.18] [text-shadow:0_2px_24px_rgba(0,0,0,.75),0_2px_6px_rgba(0,0,0,.7)]">
          Grow together in <em className="not-italic font-serif italic text-brand-gold">grace</em>
          <br />
          and truth.
        </h1>
        <p className="portal-slide-left max-w-[460px] text-[15.5px] leading-[1.7] text-white/95 [animation-delay:.12s] [text-shadow:0_1px_14px_rgba(0,0,0,.7)]">
          A calm, focused home for learning the faith — for students, servants, and administrators.
        </p>
      </div>

      {/* ── Sign-in card ── */}
      <div className="portal-card-up relative z-[2] w-full max-w-[520px] overflow-hidden rounded-[28px] border border-white/35 bg-white/[0.86] shadow-[0_30px_80px_rgba(30,10,10,.4),0_2px_0_rgba(255,255,255,.5)_inset] backdrop-blur-xl">
        <div className="px-6 py-8 sm:px-12 sm:py-12">
          <Image
            src="/images/coptic-cross.png"
            alt=""
            width={56}
            height={56}
            className="mx-auto mb-3.5 h-14 w-14 object-contain drop-shadow-[0_2px_6px_rgba(107,30,30,.25)]"
          />
          <p className="mb-1.5 text-center text-[12.5px] font-semibold uppercase tracking-[2px] text-[#8a7a52]">
            Welcome to
          </p>
          <h2 className="mb-3.5 text-center font-serif text-[26px] font-bold leading-[1.3] text-brand-800">
            St. Kyrillos Sunday School Portal
          </h2>
          <div className="mx-auto mb-4.5 flex max-w-[220px] items-center justify-center gap-2.5">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent to-brand-gold/60" />
            <span className="text-[11px] text-brand-gold" aria-hidden>◆</span>
            <span className="h-px flex-1 bg-gradient-to-r from-brand-gold/60 to-transparent" />
          </div>
          <p className="mb-7 text-center text-[13px] leading-[1.6] text-[#6B6255]">
            For students, servants, and administrators.
          </p>

          <form onSubmit={handleSubmit} noValidate>
            {error && (
              <p
                role="alert"
                className="mb-4 rounded-[10px] border border-[#FECACA] bg-[#FEE2E2] px-3.5 py-2.5 text-center text-[12.5px] text-[#B91C1C]"
              >
                {error}
              </p>
            )}

            <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="loginId" className="mb-2 block text-[12px] font-bold uppercase tracking-[0.6px] text-[#2E2E2E]">
                  ID
                </label>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#A99A7C]" aria-hidden />
                  <input
                    id="loginId"
                    inputMode="numeric"
                    autoComplete="username"
                    pattern="\d{4}"
                    value={loginId}
                    onChange={(e) => setLoginId(digits(e.target.value, 4))}
                    required
                    placeholder="0000"
                    className={fieldClass}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="pin" className="mb-2 block text-[12px] font-bold uppercase tracking-[0.6px] text-[#2E2E2E]">
                  PIN
                </label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#A99A7C]" aria-hidden />
                  <input
                    id="pin"
                    type="password"
                    inputMode="numeric"
                    autoComplete="current-password"
                    value={pin}
                    onChange={(e) => setPin(digits(e.target.value, 8))}
                    required
                    placeholder="0000"
                    className={fieldClass}
                  />
                </div>
              </div>
            </div>

            <label className="mb-6 flex w-fit cursor-pointer items-center gap-2.5 text-[12.5px] text-[#6B6255]">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-[17px] w-[17px] cursor-pointer rounded-[6px] border-2 border-[#D8CBAE] bg-parch-50 text-brand-800 accent-brand-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold"
              />
              Remember my ID
            </label>

            {/* F0048 — the button is disabled until both fields are filled and
                said nothing about why, so a parent who typed a three-digit ID
                was looking at a dead control with no words. The prototype said
                it in the form, before any network call. */}
            <p id="signin-hint" className="mb-4 text-center text-[12px] leading-[1.6] text-[#8A8175]">
              Please enter a 4-digit ID and PIN. Sign in stays greyed out until both are in.
            </p>

            <button
              type="submit"
              aria-describedby="signin-hint"
              disabled={loading || loginId.length !== 4 || pin.length < 4}
              className="group mb-5 flex h-14 w-full items-center justify-center gap-2.5 rounded-[14px] bg-[linear-gradient(120deg,#6F1D1B_0%,#7A2A2A_50%,#C89B3C_100%)] text-[13.5px] font-bold uppercase tracking-[1.5px] text-white shadow-[0_10px_28px_rgba(107,30,30,.32)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(107,30,30,.4)] hover:brightness-105 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-[3px] focus-visible:outline-brand-gold disabled:cursor-default disabled:opacity-[.85] disabled:shadow-none disabled:hover:translate-y-0 disabled:hover:brightness-100"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
                  Signing in…
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
                </>
              )}
            </button>
          </form>

          {/* Forgetting a PIN is the commonest way into this screen, and the card
              said nothing about it — it covered not *having* an account and left
              having *lost* one unanswered. Every reset also clears the lockout,
              so the wait in the error message above is not something anyone has
              to sit through. Deliberately not behind a disclosure: the person
              reading this is already stuck. */}
          <div className="rounded-[14px] border border-[#EDE4D2] bg-[#FBF7EF] px-4.5 py-3.5 text-center shadow-[0_2px_10px_rgba(0,0,0,.03)]">
            <p className="text-[12px] font-bold leading-[1.6] text-brand-800">Forgotten your ID or PIN?</p>
            <p className="mt-1 text-[12px] leading-[1.6] text-[#8A8175]">
              Students, ask your class servant. Servants, ask an administrator
              (Bason Emad or Bason Kirolous Kamel).
              <br className="hidden sm:inline" /> They can set you a new PIN, and it works
              straight away &mdash; even if you have been locked out.
            </p>
            <p className="mt-3 border-t border-[#EDE4D2] pt-3 text-[12px] leading-[1.6] text-[#8A8175]">
              Don&rsquo;t have an account? <strong className="font-bold text-brand-800">Ask your class servant for access.</strong>
            </p>
          </div>

          <div className="flex items-center justify-center gap-1.5 pt-4">
            <p className="text-[11.5px] leading-[1.6] tracking-[0.3px] text-[#A79E8C]">
              © {new Date().getFullYear()} St. Kyrillos the Sixth ·
            </p>
            <Link
              href="/"
              className="text-[11.5px] font-bold tracking-[0.4px] text-brand-gold-dark transition-colors hover:text-brand-800"
            >
              Church website
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

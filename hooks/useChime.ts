'use client'

import { useCallback } from 'react'
import { createLocalToggle } from './localToggle'

/**
 * The short confirmation tones the portal plays when something is recorded.
 *
 * This lived inside the QR scan panel, which is why a servant taking the
 * register by tapping names heard nothing at all while the same servant
 * scanning cards heard every child land. Tapping is the commoner path of the
 * two, and it is the one where you are looking at the class rather than the
 * screen, so it needs the sound more.
 *
 * Two rising notes mean it went in, two falling notes mean it did not — the
 * prototype's own intervals (OG L9491-9509 and L9515-9530), added for F0007.
 *
 * `ok`, `warn` and `err` keep the scan panel's original notes exactly — that
 * path works and is in daily use, so this must not change how it sounds.
 * `neutral` and `low` are new, for marking a child excused and for taking them
 * off a list.
 */
export type ChimeTone = 'ok' | 'warn' | 'err' | 'neutral' | 'low'

const NOTES: Record<ChimeTone, number[]> = {
  ok: [587.33, 880], //      rising pair — recorded
  warn: [523.25, 349.23], // falling pair — already done
  err: [523.25, 349.23], //  falling pair — refused
  neutral: [587.33], //      one note — excused
  low: [392], //             one lower note — taken off
}

/* ── the mute preference ──────────────────────────────────────────────────
 *
 * One switch for all three paths. Silencing the register from the register
 * also silences points and the scanner, because a servant who wants quiet
 * wants quiet — not three switches to find.
 */
const mute = createLocalToggle('portal:chimeMuted', false)

export const setChimeMuted = (next: boolean) => mute.set(next)

/** Whether sound is currently off. */
export const useChimeMuted = () => mute.use()

/**
 * Returns a `chime(tone)` you can call from any event handler.
 *
 * The AudioContext is built on the first call rather than on mount, by which
 * point the servant has tapped something — which is the user gesture the
 * browser's autoplay rule wants. Every line is inside a try/catch: a browser
 * that refuses audio must never stop the register being taken.
 */
let ctx: AudioContext | null = null

export function useChime() {
  // Reads the stored preference even on a page with no visible switch, so the
  // scanner honours a mute set from the register.
  mute.use()

  return useCallback((tone: ChimeTone) => {
    if (mute.get()) return
    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return
      const audio = ctx ?? (ctx = new Ctor())
      if (audio.state === 'suspended') void audio.resume()
      NOTES[tone].forEach((freq, i) => {
        const osc = audio.createOscillator()
        const gain = audio.createGain()
        osc.type = 'triangle'
        osc.frequency.value = freq
        const at = audio.currentTime + i * 0.08
        gain.gain.setValueAtTime(0, at)
        gain.gain.linearRampToValueAtTime(0.22, at + 0.01)
        gain.gain.exponentialRampToValueAtTime(0.001, at + 0.35)
        osc.connect(gain)
        gain.connect(audio.destination)
        osc.start(at)
        osc.stop(at + 0.4)
      })
    } catch {
      // Audio is a convenience; the row on screen is the record of truth.
    }
  }, [])
}

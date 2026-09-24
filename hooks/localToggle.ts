'use client'

import { useEffect, useSyncExternalStore } from 'react'

/**
 * A yes/no preference that belongs to the person's device rather than their
 * account — whether the scanner reviews before saving, whether the confirmation
 * tones play. These are decisions about the room you are standing in, so they
 * follow the tablet, not the login.
 *
 * Module-level rather than context so a panel can read one without a provider,
 * and so plain (non-React) code can read the current value at the moment of an
 * event instead of closing over a stale render.
 *
 * Storage is wrapped at every access: a browser in private mode, or with site
 * data blocked, simply gets the fallback and the switch still works for that
 * visit. The value starts at `fallback` on both server and client and is
 * corrected right after mount, so a stored preference can never cause a
 * hydration mismatch.
 */
export interface LocalToggle {
  /** The current value, readable outside React. */
  get(): boolean
  set(next: boolean): void
  /** Subscribe from a component. */
  use(): boolean
}

export function createLocalToggle(key: string, fallback: boolean): LocalToggle {
  let value = fallback
  let hydrated = false
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach((l) => l())

  function hydrate() {
    if (hydrated) return
    hydrated = true
    try {
      const stored = window.localStorage.getItem(key)
      // Only an explicit choice overrides the fallback, so changing the default
      // later still reaches everyone who never touched the switch.
      if (stored === '1' || stored === '0') {
        const next = stored === '1'
        if (next !== value) {
          value = next
          emit()
        }
      }
    } catch {
      /* storage blocked — the fallback stands */
    }
  }

  function subscribe(fn: () => void) {
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  }

  return {
    get: () => value,
    set(next: boolean) {
      value = next
      try {
        window.localStorage.setItem(key, next ? '1' : '0')
      } catch {
        /* the switch still holds for this visit */
      }
      emit()
    },
    use() {
      useEffect(hydrate, [])
      return useSyncExternalStore(
        subscribe,
        () => value,
        () => fallback,
      )
    },
  }
}

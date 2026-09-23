'use client'

import { useEffect, useState } from 'react'

/**
 * The prototype's stat counters ran up to their value instead of snapping in
 * (F0086, and the duplicates F0359 / F0528 / F0687). It is small, but on the
 * dashboard it is what makes the numbers read as this week's rather than as
 * furniture, and the prototype turned it off for anyone who had asked their
 * system for less motion — that accommodation went with it.
 *
 * Three things this deliberately does NOT do, each learned here:
 *
 *   - It does not start from zero on the server. The rendered HTML carries the
 *     real number, so the page is correct before any JavaScript runs, correct in
 *     a print, and correct to anything reading the markup. Only the browser, only
 *     after mount, ever shows an intermediate value.
 *   - It does not animate when `prefers-reduced-motion: reduce` is set.
 *   - It does not animate a number that has no business counting — see
 *     `countableValue` in ui.tsx. A rate of "—" or a name is passed straight
 *     through.
 *
 * `data-count-to` carries the final value throughout, so a browser check can
 * assert the true number without racing the animation.
 *
 * It takes a `suffix` string rather than a formatter function: a function cannot
 * cross the server/client boundary, and passing one threw
 * "Functions cannot be passed directly to Client Components" on every page with a
 * stat tile — which is to say all of them.
 */
export function CountUp({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [shown, setShown] = useState(value)

  useEffect(() => {
    // Deliberately NOT guarded by a "have I already run" ref. React Strict Mode
    // mounts, unmounts and remounts in development: the first run set the value
    // to 0 and scheduled the animation, the unmount's cleanup cancelled it, and
    // a ref guard then made the second run return early — leaving every tile
    // reading 0 permanently. A browser check caught it as "12 vs 0". Running the
    // animation again on a remount is harmless; not finishing it is not.
    if (typeof window === 'undefined') return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    // Nothing to animate towards, or the reader asked for less motion.
    if (reduce || value === 0) return setShown(value)

    const DURATION = 520
    let raf = 0
    const start = performance.now()
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / DURATION)
      // Ease-out, so it arrives rather than stopping dead.
      const eased = 1 - (1 - p) ** 3
      setShown(Math.round(value * eased))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    setShown(0)
    raf = requestAnimationFrame(step)

    // The number must arrive even if the frames never do. requestAnimationFrame
    // is throttled hard in a backgrounded tab and can stop outright, and without
    // this the tile would sit on 0 — showing a wrong number for as long as the
    // tab stayed hidden, which is far worse than not animating at all. Caught by
    // a browser check reading "12 vs 0".
    const settle = setTimeout(() => setShown(value), DURATION + 150)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(settle)
    }
  }, [value])

  return (
    <span data-count-to={value} suppressHydrationWarning>
      {shown.toLocaleString()}
      {suffix}
    </span>
  )
}

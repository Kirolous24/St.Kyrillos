/**
 * How a portal link loads its page ahead of a click (2026-09-28).
 *
 * `<Link prefetch>` on the side menu had the server build every menu page on
 * screen, in full, as soon as the menu appeared — 13–14 pages each time someone
 * opened the portal on a computer (measured), most never visited. Links inside
 * pages, left on Next's default, fired a background request for every link on
 * screen — 31 on one class page — that came back with 0–175 bytes, because the
 * pages they point at have no loading outline to fetch. Each of those requests
 * is a server run on the Vercel CPU bill, which the Hobby plan caps at 4 hours
 * a month.
 *
 * Now a page loads only when someone shows they are about to open it: the
 * pointer or keyboard focus resting on the link for a moment, or a finger
 * touching it. Passing over a link on the way to another loads nothing.
 * `router.prefetch` loads the full page, so the click still lands instantly;
 * `prefetch: false` switches off Link's own prefetching, so this is the only load.
 */
const REST_MS = 100

export function intentPrefetch(href: string, prefetch: (href: string) => void) {
  let pending: ReturnType<typeof setTimeout> | null = null
  const cancel = () => {
    if (pending !== null) clearTimeout(pending)
    pending = null
  }
  const afterRest = () => {
    cancel()
    pending = setTimeout(() => {
      pending = null
      prefetch(href)
    }, REST_MS)
  }
  const now = () => {
    cancel()
    prefetch(href)
  }
  return {
    prefetch: false,
    onMouseEnter: afterRest,
    onMouseLeave: cancel,
    onFocus: afterRest,
    onBlur: cancel,
    onTouchStart: now,
  } as const
}

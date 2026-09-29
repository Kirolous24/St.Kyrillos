'use client'

import { forwardRef, useMemo, type ComponentPropsWithoutRef } from 'react'
import NextLink from 'next/link'
import { useRouter } from 'next/navigation'
import { intentPrefetch } from '@/lib/portal/intent-prefetch'

type Props = Omit<ComponentPropsWithoutRef<typeof NextLink>, 'prefetch'>

/**
 * The portal's link: next/link, except the page loads only when someone shows
 * they are about to open it — see lib/portal/intent-prefetch.ts for why and
 * what was measured. ESLint blocks importing next/link directly in portal code.
 */
const Link = forwardRef<HTMLAnchorElement, Props>(function Link(
  { href, onMouseEnter, onMouseLeave, onFocus, onBlur, onTouchStart, ...rest },
  ref,
) {
  const router = useRouter()
  const target = typeof href === 'string' ? href : null
  // Memoised so a re-render between the pointer arriving and leaving keeps the
  // same pending timer, and leaving still cancels it.
  const intent = useMemo(() => (target ? intentPrefetch(target, (h) => router.prefetch(h)) : null), [target, router])
  return (
    <NextLink
      ref={ref}
      href={href}
      {...rest}
      prefetch={false}
      onMouseEnter={(e) => {
        onMouseEnter?.(e)
        intent?.onMouseEnter()
      }}
      onMouseLeave={(e) => {
        onMouseLeave?.(e)
        intent?.onMouseLeave()
      }}
      onFocus={(e) => {
        onFocus?.(e)
        intent?.onFocus()
      }}
      onBlur={(e) => {
        onBlur?.(e)
        intent?.onBlur()
      }}
      onTouchStart={(e) => {
        onTouchStart?.(e)
        intent?.onTouchStart()
      }}
    />
  )
})

export default Link

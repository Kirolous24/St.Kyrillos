'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { inputClass } from '@/components/portal/ui'
import { cn } from '@/lib/utils'

/**
 * A search box that refines as you type, without giving up the server as the
 * single place the filtering happens (F0823).
 *
 * The prototype had a live filter; the port replaced it with a form you submit,
 * so every refinement of a search cost a round trip *and* a keypress. This keeps
 * the round trip — debounced, and without a full navigation — and deliberately
 * does NOT filter on the client.
 *
 * That is not laziness. The roster query stops at 500 rows (F0073), so a
 * client-side filter would search the first 500 and silently fail to find the
 * 501st: an admin typing a name that exists would be told there is no such
 * student. The server sees all of them.
 *
 * Falls back to an ordinary submit when JavaScript has not run: the surrounding
 * <form> still works on its own.
 */
export function DebouncedSearch({
  name = 'q',
  placeholder,
  delay = 350,
  className,
  'aria-label': ariaLabel,
}: {
  name?: string
  placeholder?: string
  delay?: number
  className?: string
  'aria-label'?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const fromUrl = params.get(name) ?? ''
  const [value, setValue] = useState(fromUrl)
  const typing = useRef(false)

  // Adopt the URL again when it changes underneath us — a class filter or the
  // browser Back button — but never while the person is mid-word.
  useEffect(() => {
    if (!typing.current) setValue(fromUrl)
  }, [fromUrl])

  useEffect(() => {
    if (value === fromUrl) return
    const id = setTimeout(() => {
      const next = new URLSearchParams(params.toString())
      if (value.trim()) next.set(name, value.trim())
      else next.delete(name)
      typing.current = false
      // `replace`, not `push`: eight keystrokes should not be eight Back presses.
      router.replace(`${pathname}?${next.toString()}`, { scroll: false })
    }, delay)
    return () => clearTimeout(id)
  }, [value, fromUrl, delay, name, params, pathname, router])

  return (
    <input
      name={name}
      value={value}
      onChange={(e) => {
        typing.current = true
        setValue(e.target.value)
      }}
      className={cn(inputClass, className)}
      placeholder={placeholder}
      aria-label={ariaLabel}
      data-debounced-search={name}
      autoComplete="off"
    />
  )
}

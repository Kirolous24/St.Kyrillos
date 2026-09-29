import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { intentPrefetch } from '@/lib/portal/intent-prefetch'

// A portal link must not load its page just because it is on screen, or
// because the pointer passes over it on the way to something else — but it
// must load it once someone shows they are about to open it, so the click
// still lands instantly. Every needless load is a server render on the
// Vercel CPU bill (2026-09-28).

function recorder() {
  const loaded: string[] = []
  return { loaded, prefetch: (href: string) => void loaded.push(href) }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('intentPrefetch', () => {
  it('stops a page loading just because its link is on screen', () => {
    expect(intentPrefetch('/portal/agenda', recorder().prefetch).prefetch).toBe(false)
  })

  it('loads nothing until someone shows intent', () => {
    const r = recorder()
    intentPrefetch('/portal/agenda', r.prefetch)
    vi.advanceTimersByTime(10_000)
    expect(r.loaded).toEqual([])
  })

  it('loads the page once the pointer rests on the link', () => {
    const r = recorder()
    const link = intentPrefetch('/portal/students/abc', r.prefetch)
    link.onMouseEnter()
    vi.advanceTimersByTime(1_000)
    expect(r.loaded).toEqual(['/portal/students/abc'])
  })

  it('loads nothing when the pointer only passes over the link', () => {
    const r = recorder()
    const link = intentPrefetch('/portal/students/abc', r.prefetch)
    link.onMouseEnter()
    vi.advanceTimersByTime(30)
    link.onMouseLeave()
    vi.advanceTimersByTime(1_000)
    expect(r.loaded).toEqual([])
  })

  it('loads only the row a sweep across a list stops on', () => {
    const r = recorder()
    const rows = ['/portal/students/a', '/portal/students/b', '/portal/students/c'].map((h) => intentPrefetch(h, r.prefetch))
    for (const row of rows.slice(0, 2)) {
      row.onMouseEnter()
      vi.advanceTimersByTime(25)
      row.onMouseLeave()
    }
    rows[2].onMouseEnter()
    vi.advanceTimersByTime(1_000)
    expect(r.loaded).toEqual(['/portal/students/c'])
  })

  it('loads the page once keyboard focus rests on the link', () => {
    const r = recorder()
    const link = intentPrefetch('/portal/qr', r.prefetch)
    link.onFocus()
    vi.advanceTimersByTime(1_000)
    expect(r.loaded).toEqual(['/portal/qr'])
  })

  it('loads nothing when keyboard focus moves straight on', () => {
    const r = recorder()
    const link = intentPrefetch('/portal/qr', r.prefetch)
    link.onFocus()
    vi.advanceTimersByTime(30)
    link.onBlur()
    vi.advanceTimersByTime(1_000)
    expect(r.loaded).toEqual([])
  })

  it('loads the page the moment a finger touches the link', () => {
    const r = recorder()
    intentPrefetch('/portal/grades', r.prefetch).onTouchStart()
    expect(r.loaded).toEqual(['/portal/grades'])
  })
})

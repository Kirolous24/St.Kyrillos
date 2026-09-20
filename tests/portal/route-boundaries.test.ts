import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

// Regression guard for the bug documented on components/portal/PageSkeleton's
// doc comment: a `loading.tsx` sibling wraps its `page.tsx` in a Suspense
// boundary, which makes Next flush a 200 status before the page component
// runs — so a conditional `notFound()` inside that page can still render the
// not-found UI, but can no longer turn the response into a real 404. Every
// segment whose page.tsx may call `notFound()` must therefore have no
// `loading.tsx` sibling (matches the existing convention for dynamic `[id]`
// segments, which never carry one either).

const PORTAL_APP_DIR = path.resolve(__dirname, '../../app/portal/(app)')

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

describe('portal route segments: loading.tsx vs conditional notFound()', () => {
  const files = walk(PORTAL_APP_DIR)
  const pageFiles = files.filter((f) => path.basename(f) === 'page.tsx')

  it('finds page.tsx files to check (sanity check the walk itself)', () => {
    expect(pageFiles.length).toBeGreaterThan(20)
  })

  for (const pageFile of pageFiles) {
    const dir = path.dirname(pageFile)
    const rel = path.relative(PORTAL_APP_DIR, dir) || '.'
    const source = readFileSync(pageFile, 'utf8')
    const callsNotFound = /\bnotFound\s*\(\s*\)/.test(source)

    if (callsNotFound) {
      it(`${rel}: page.tsx calls notFound(), so no loading.tsx sibling`, () => {
        const loadingPath = path.join(dir, 'loading.tsx')
        let hasLoading = true
        try {
          statSync(loadingPath)
        } catch {
          hasLoading = false
        }
        expect(hasLoading).toBe(false)
      })
    }
  }
})

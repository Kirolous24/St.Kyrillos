import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * Found 2026-10-25, while building Class photos: no photo could be saved in the
 * portal since it went live. The picker drew the chosen file through a blob:
 * URL, and the portal's Content Security Policy allows images from 'self' and
 * data: only, so the browser refused to load it and every servant saw "That
 * photo could not be read". The two files must agree, whichever one changes.
 */
const root = path.resolve(__dirname, '../..')
const config = readFileSync(path.join(root, 'next.config.js'), 'utf8')
const resize = readFileSync(path.join(root, 'components/portal/photo-resize.ts'), 'utf8')
const imgSrc = (/"img-src ([^"]+)"/.exec(config)?.[1] ?? '').split(/\s+/)

describe('the photo picker and the portal CSP', () => {
  it('the CSP is the one this guard reads', () => {
    expect(imgSrc).toContain("'self'")
  })

  it('reads the chosen photo in a way the CSP allows', () => {
    const usesBlobUrl = /URL\.createObjectURL/.test(resize)
    expect(usesBlobUrl && !imgSrc.includes('blob:'), 'the picker loads a blob: URL that img-src refuses').toBe(false)
    const usesDataUrl = /readAsDataURL/.test(resize)
    expect(!usesDataUrl || imgSrc.includes('data:'), 'the picker loads a data: URL that img-src refuses').toBe(true)
  })
})

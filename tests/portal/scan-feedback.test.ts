import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * Every scan has to answer — with a sound, and with the child's name.
 *
 * `chime` originally lived only on the write path, inside `pushRow`. That was
 * enough while every scan was written the moment the card was read. Then the
 * review queue became the default (51e46dc, 2026-09-23) and `queueCode` — which
 * never touches `pushRow` — became the path every servant lands on. The scanner
 * went silent for everyone, and the only confirmation left was a name in a
 * panel that a phone puts several hundred pixels below the picture. Both halves
 * were reported from the door the next morning.
 *
 * The prototype did neither of these things by accident: it played its tone as
 * the card joined the batch (OG L14012), not as the batch was saved, and it
 * painted the name over the camera picture (OG L14019).
 *
 * This reads the source. The sound is a Web Audio oscillator with nothing for a
 * headless browser to assert on, and the regression was structural — feedback
 * reachable from one code path and not from its sibling. The visible half is
 * covered for real in scripts/og-parity-verify-ui.mjs, which drives a scan
 * through the manual-ID box and reads the toast off the camera well.
 */

const PANEL = path.resolve(__dirname, '../../app/portal/(app)/qr/ScanPanel.tsx')

/**
 * Comments are stripped before anything is matched. A check for a call by name
 * has passed on a comment *describing* the call before now, in this same
 * session — the word was there, the call was not.
 */
function source(): string {
  return readFileSync(PANEL, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
}

/** One handler's body, from its declaration to the start of the next. */
function slice(from: string, to: string): string {
  const text = source()
  const start = text.indexOf(from)
  expect(start, `${from} not found — the handler was renamed`).toBeGreaterThan(-1)
  const end = text.indexOf(to, start + from.length)
  expect(end, `${to} not found after ${from}`).toBeGreaterThan(start)
  return text.slice(start, end)
}

const queuePath = () => slice('const queueCode', 'const submitCode')
const commitPath = () => slice('function commitQueue', 'function undo')

describe('a scan answers the servant', () => {
  /**
   * Vacuous-pass guard. A slice that matched nothing is an empty string, and an
   * empty string reads exactly like a handler that was found and was happy.
   */
  it('finds the scan paths at all', () => {
    expect(queuePath().length).toBeGreaterThan(400)
    expect(commitPath().length).toBeGreaterThan(400)
    expect(slice('const pushRow', 'const queueCode').length).toBeGreaterThan(200)
  })

  it('queueing a scan makes a sound — this is the path the default takes', () => {
    expect(queuePath()).toContain('chime(')
  })

  it('and puts the name on the camera picture', () => {
    expect(queuePath()).toContain('showFlash(')
  })

  it('a second read of the same card is answered, not swallowed', () => {
    // The duplicate branch used to `return` in silence, which on a phone is
    // indistinguishable from a camera that has stopped decoding. It sits before
    // the server round trip begins, so slice there.
    const queue = queuePath()
    const duplicateBranch = queue.slice(0, queue.indexOf('busyRef.current = true'))
    expect(duplicateBranch).toContain('chime(')
    expect(duplicateBranch).toContain('showFlash(')
  })

  it('writing on every scan still makes a sound', () => {
    // `submitCode` feeds `pushRow`, which owns the feedback for that path.
    expect(slice('const pushRow', 'const queueCode')).toContain('chime(')
  })

  it('saving a batch makes one sound, not one per card', () => {
    const commit = commitPath()
    // Once, textually...
    expect((commit.match(/chime\(/g) ?? []).length).toBe(1)
    // ...and after the loop, not inside it: `setQueue([])` runs once the last
    // card has been written, so a tone that comes later cannot be per-card.
    expect(commit.indexOf('chime(')).toBeGreaterThan(commit.indexOf('setQueue([])'))
    // And the rows it writes on the way past stay quiet, or a dozen saved cards
    // would still fire a dozen overlapping tones from inside `pushRow`.
    expect(commit).toContain('quiet: true')
  })
})

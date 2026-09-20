import { describe, it, expect, vi, afterEach } from 'vitest'
import { createLivePoller } from '@/lib/live-poller'

// A scripted status source: returns the given statuses in order, then repeats the last.
function scripted(statuses: { isLive: boolean }[]) {
  let i = 0
  const calls: number[] = []
  return {
    calls,
    fetchStatus: async () => {
      calls.push(Date.now())
      const s = statuses[Math.min(i, statuses.length - 1)]
      i++
      return s
    },
  }
}

const INTERVAL = 60_000

afterEach(() => {
  vi.useRealTimers()
})

describe('createLivePoller', () => {
  it('keeps polling after the stream goes live so it can see the stream end (reported bug)', async () => {
    vi.useFakeTimers()
    const src = scripted([{ isLive: true }, { isLive: true }, { isLive: false }])
    const seen: boolean[] = []
    const poller = createLivePoller({
      fetchStatus: src.fetchStatus,
      onStatus: (s) => seen.push(s.isLive),
      intervalMs: INTERVAL,
    })

    await poller.start()
    expect(seen).toEqual([true]) // first check: live

    await vi.advanceTimersByTimeAsync(INTERVAL)
    await vi.advanceTimersByTimeAsync(INTERVAL)

    // Previously polling stopped as soon as isLive was true, so the third
    // status (stream ended) was never observed and the player stayed "LIVE".
    expect(seen).toEqual([true, true, false])
    poller.stop()
  })

  it('pauses while the page is hidden and checks again immediately when it becomes visible', async () => {
    vi.useFakeTimers()
    const src = scripted([{ isLive: false }])
    const poller = createLivePoller({
      fetchStatus: src.fetchStatus,
      onStatus: () => {},
      intervalMs: INTERVAL,
    })

    await poller.start()
    expect(src.calls).toHaveLength(1)

    poller.setVisible(false)
    await vi.advanceTimersByTimeAsync(INTERVAL * 5)
    expect(src.calls).toHaveLength(1) // nothing while hidden

    poller.setVisible(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(src.calls).toHaveLength(2) // immediate catch-up check

    await vi.advanceTimersByTimeAsync(INTERVAL)
    expect(src.calls).toHaveLength(3) // and regular polling resumes
    poller.stop()
  })

  it('stop() ends polling for good', async () => {
    vi.useFakeTimers()
    const src = scripted([{ isLive: false }])
    const poller = createLivePoller({
      fetchStatus: src.fetchStatus,
      onStatus: () => {},
      intervalMs: INTERVAL,
    })

    await poller.start()
    poller.stop()
    await vi.advanceTimersByTimeAsync(INTERVAL * 3)
    poller.setVisible(true)
    await vi.advanceTimersByTimeAsync(INTERVAL)
    expect(src.calls).toHaveLength(1)
  })

  it('reports a failed fetch as offline instead of throwing, and keeps polling', async () => {
    vi.useFakeTimers()
    let n = 0
    const seen: { isLive: boolean; error?: string }[] = []
    const poller = createLivePoller({
      fetchStatus: async () => {
        n++
        if (n === 1) throw new Error('network')
        return { isLive: true }
      },
      onStatus: (s) => seen.push(s),
      intervalMs: INTERVAL,
    })

    await poller.start()
    expect(seen[0].isLive).toBe(false)
    expect(seen[0].error).toBeTruthy()

    await vi.advanceTimersByTimeAsync(INTERVAL)
    expect(seen[1].isLive).toBe(true)
    poller.stop()
  })
})

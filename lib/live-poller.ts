// Framework-free polling controller for the livestream player.
//
// Rules (each one is a unit test in tests/live-poller.test.ts):
//   • Poll on a fixed interval REGARDLESS of whether the stream is live. The
//     old player stopped polling as soon as isLive was true, so it never saw
//     the stream end and kept showing a dead "LIVE" embed until a reload.
//   • Pause while the page is hidden (tab in background / phone locked) and
//     check again immediately when it becomes visible. This replaces the old
//     30-minute mouse/keyboard inactivity kill, which also fired on phones
//     where nobody moves a mouse.
//   • A failed fetch reports offline with an error and polling continues.
//
// Server-side quota is protected by the API route's own rate limits, so one
// request per minute per open tab is cheap (a DB read when nothing changed).

export interface LiveStatusLike {
  isLive: boolean
  error?: string
}

export interface LivePollerOptions<S extends LiveStatusLike> {
  fetchStatus: () => Promise<S>
  /** Receives the fetched status, or a minimal offline status when the fetch failed. */
  onStatus: (status: S | LiveStatusLike) => void
  intervalMs: number
}

export interface LivePoller {
  /** Runs the first check, then starts the interval. */
  start(): Promise<void>
  /** Stops polling permanently (call on unmount). */
  stop(): void
  /** Pause when hidden; resume (with an immediate check) when visible. */
  setVisible(visible: boolean): void
}

export function createLivePoller<S extends LiveStatusLike>(opts: LivePollerOptions<S>): LivePoller {
  const { fetchStatus, onStatus, intervalMs } = opts
  let timer: ReturnType<typeof setInterval> | null = null
  let stopped = false
  let visible = true

  async function check(): Promise<void> {
    try {
      const status = await fetchStatus()
      if (!stopped) onStatus(status)
    } catch (err) {
      if (!stopped) {
        onStatus({
          isLive: false,
          error: err instanceof Error && err.message ? err.message : 'Failed to load livestream status',
        })
      }
    }
  }

  function startTimer(): void {
    if (timer || stopped || !visible) return
    timer = setInterval(check, intervalMs)
  }

  function clearTimer(): void {
    if (timer) clearInterval(timer)
    timer = null
  }

  return {
    async start() {
      if (stopped) return
      await check()
      startTimer()
    },
    stop() {
      stopped = true
      clearTimer()
    },
    setVisible(v: boolean) {
      if (stopped || v === visible) return
      visible = v
      if (!visible) {
        clearTimer()
        return
      }
      // Became visible: catch up right away, then resume the regular cadence.
      void check()
      startTimer()
    },
  }
}

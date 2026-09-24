'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import { Camera, CameraOff } from 'lucide-react'
import { buttonClass } from './ui'
import { cn } from '@/lib/utils'

type ScannerState = 'idle' | 'starting' | 'running' | 'denied' | 'unsupported' | 'insecure' | 'error'

const MESSAGE: Record<Exclude<ScannerState, 'idle' | 'starting' | 'running'>, string> = {
  denied: 'Camera access was blocked. Allow it in your browser settings, or type the ID below.',
  unsupported: 'This device or browser has no camera we can use. Type the ID below instead.',
  insecure: 'The camera only works over HTTPS. Open the portal on https:// or type the ID below.',
  error: 'The camera could not be started. Type the ID below instead.',
}

/**
 * How many consecutive frames a decoded code must be *absent* from the picture
 * before it may fire again (~20 frames of requestAnimationFrame, a third of a
 * second), so a brief decode miss while the card is still being held up does
 * not count as the card having left the frame.
 */
const CLEAR_AFTER_MISSES = 20

/**
 * Camera QR reader. Decoding happens entirely in the browser with jsQR; the
 * decoded text is handed to the caller, which validates it on the server.
 * Degrades to nothing but a message when there is no camera, no permission or
 * no secure context — the caller always renders a manual fallback as well.
 *
 * A code fires once per visit to the frame, never on a timer: while the same
 * payload keeps decoding it stays suppressed, and it is only re-armed once the
 * card has left the picture (or a different one appeared) *and* cooldownMs has
 * passed. Otherwise a card left lying in front of the lens would be scanned
 * over and over — which, in "give points" mode, means points over and over.
 */
export function QrScanner({
  onScan,
  paused = false,
  cooldownMs = 2500,
  overlay,
}: {
  onScan: (text: string) => void
  paused?: boolean
  cooldownMs?: number
  /**
   * Rendered inside the camera well, which is the positioning context — so an
   * `absolute` node here lands on the picture rather than under the buttons.
   * The scan panel uses it for the prototype's per-scan toast: the name of the
   * child who just scanned has to appear where the servant is already looking.
   */
  overlay?: React.ReactNode
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const frameRef = useRef<number | null>(null)
  const lastRef = useRef<{ text: string; at: number }>({ text: '', at: 0 })
  const missRef = useRef(0)
  const pausedRef = useRef(paused)
  const onScanRef = useRef(onScan)
  const [state, setState] = useState<ScannerState>('idle')

  useEffect(() => {
    pausedRef.current = paused
  }, [paused])
  useEffect(() => {
    onScanRef.current = onScan
  }, [onScan])

  const stop = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
    const stream = streamRef.current
    if (stream) {
      stream.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    const video = videoRef.current
    if (video) video.srcObject = null
    lastRef.current = { text: '', at: 0 }
    missRef.current = 0
  }, [])

  useEffect(() => stop, [stop])

  const tick = useCallback(() => {
    frameRef.current = requestAnimationFrame(tick)
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) return
    if (pausedRef.current) return

    const width = Math.min(480, video.videoWidth)
    if (!width) return
    const height = Math.round((video.videoHeight / video.videoWidth) * width)
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return
    ctx.drawImage(video, 0, 0, width, height)

    let image: ImageData
    try {
      image = ctx.getImageData(0, 0, width, height)
    } catch {
      return
    }
    const found = jsQR(image.data, width, height, { inversionAttempts: 'dontInvert' })
    const now = Date.now()

    if (!found || !found.data) {
      // Nothing in the picture: once it has been gone long enough, and the
      // cooldown has elapsed, the last code may be scanned again.
      if (missRef.current < CLEAR_AFTER_MISSES) missRef.current += 1
      if (missRef.current >= CLEAR_AFTER_MISSES && now - lastRef.current.at >= cooldownMs) {
        lastRef.current = { text: '', at: 0 }
      }
      return
    }

    missRef.current = 0
    // Still the same card in the frame — stay quiet however long it is held up.
    if (found.data === lastRef.current.text) return

    lastRef.current = { text: found.data, at: now }
    onScanRef.current(found.data)
  }, [cooldownMs])

  const start = useCallback(async () => {
    if (typeof window === 'undefined') return
    if (!window.isSecureContext) return setState('insecure')
    if (!navigator.mediaDevices?.getUserMedia) return setState('unsupported')

    setState('starting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      streamRef.current = stream
      const video = videoRef.current
      if (!video) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      video.srcObject = stream
      video.setAttribute('playsinline', 'true')
      await video.play()
      setState('running')
      frameRef.current = requestAnimationFrame(tick)
    } catch (err) {
      stop()
      const name = err instanceof Error ? err.name : ''
      setState(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : name === 'NotFoundError' ? 'unsupported' : 'error')
    }
  }, [tick, stop])

  const running = state === 'running' || state === 'starting'

  return (
    <div>
      {/* The prototype's camera well: black ground, the picture filling it, and a
          gold reticle with the surround dimmed by a huge shadow spread. */}
      <div
        data-camera-well
        className={cn(
          'relative aspect-[4/3] w-full overflow-hidden rounded-[14px] border border-parch-200 bg-[#1A0A0A]',
          !running && 'flex items-center justify-center',
        )}
      >
        <video
          ref={videoRef}
          muted
          playsInline
          className={cn('h-full w-full object-cover', !running && 'hidden')}
        />
        {running && (
          <span
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 h-[62%] w-[62%] max-h-[190px] max-w-[190px] -translate-x-1/2 -translate-y-1/2 rounded-[18px] border-[2.5px] border-brand-gold/85 shadow-[0_0_0_999px_rgba(0,0,0,.35)]"
          >
            {/* corner brackets, brighter than the frame itself */}
            <span className="absolute -left-px -top-px h-5 w-5 rounded-tl-[16px] border-l-[3px] border-t-[3px] border-brand-gold-light" />
            <span className="absolute -right-px -top-px h-5 w-5 rounded-tr-[16px] border-r-[3px] border-t-[3px] border-brand-gold-light" />
            <span className="absolute -bottom-px -left-px h-5 w-5 rounded-bl-[16px] border-b-[3px] border-l-[3px] border-brand-gold-light" />
            <span className="absolute -bottom-px -right-px h-5 w-5 rounded-br-[16px] border-b-[3px] border-r-[3px] border-brand-gold-light" />
          </span>
        )}
        {!running && (
          <div className="px-6 py-8 text-center">
            <CameraOff className="mx-auto mb-2.5 h-7 w-7 text-brand-gold/70" aria-hidden />
            <p className="mx-auto max-w-xs text-[12.5px] leading-relaxed text-white/80">
              {state === 'idle' ? 'The camera is off.' : MESSAGE[state as Exclude<ScannerState, 'idle' | 'starting' | 'running'>]}
            </p>
          </div>
        )}
        {overlay}
      </div>
      <canvas ref={canvasRef} className="hidden" />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {running ? (
          <button type="button" onClick={() => { stop(); setState('idle') }} className={buttonClass('secondary', 'sm')}>
            <CameraOff className="h-4 w-4" aria-hidden /> Stop camera
          </button>
        ) : (
          <button type="button" onClick={() => void start()} className={buttonClass('primary', 'sm')}>
            <Camera className="h-4 w-4" aria-hidden /> Start camera
          </button>
        )}
        {state === 'running' && <span className="text-[11.5px] text-parch-500">Point the camera at a student card.</span>}
      </div>
    </div>
  )
}

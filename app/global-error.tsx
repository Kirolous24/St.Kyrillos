'use client'

import { useEffect } from 'react'

/**
 * Last resort: only mounts when the ROOT layout itself throws (nothing below
 * it, including `app/portal/error.tsx`, can catch that). Next requires this
 * file to render its own `<html>`/`<body>` — no guarantee the app's CSS
 * bundle is available here, so styling is inline rather than Tailwind.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[root]', error)
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#F8F4EC',
          fontFamily: 'Georgia, "Times New Roman", serif',
          padding: '1rem',
        }}
      >
        <div
          style={{
            maxWidth: '24rem',
            width: '100%',
            textAlign: 'center',
            background: '#FFFDF8',
            border: '1px solid #E7E2DA',
            borderRadius: '16px',
            padding: '2rem 1.5rem',
            boxShadow: '0 1px 4px rgba(74, 59, 50, .08)',
          }}
        >
          <h1 style={{ margin: '0 0 0.5rem', fontSize: '18px', fontWeight: 700, color: '#2F2930' }}>
            Something went wrong
          </h1>
          <p style={{ margin: '0 0 1.5rem', fontSize: '13px', lineHeight: 1.6, color: '#65625F' }}>
            The site hit an unexpected error. Please try again.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              borderRadius: '10px',
              border: 'none',
              padding: '0.6rem 1.4rem',
              fontSize: '13px',
              fontWeight: 700,
              color: '#fff',
              background: 'linear-gradient(120deg,#6F1D1B 0%,#7A2A2A 50%,#C89B3C 100%)',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}

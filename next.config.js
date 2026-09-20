// The Sunday School portal and the church admin dashboard sit behind PIN /
// password auth and hold children's PII, so they get a locked-down CSP on
// top of the baseline headers. The public marketing site embeds Google Maps,
// YouTube and Calendly (see VisitSection, LivestreamPlayer, the confession
// page) and stays on the baseline only — a portal-strength CSP there would
// need per-embed allowlisting to not break those iframes/scripts.
const PORTAL_CSP = [
  "default-src 'self'",
  // Next.js's App Router inlines hydration/streaming payloads as <script>
  // tags with no nonce wired up (see the root layout's JSON-LD tag too), so
  // this can't be tightened to a strict allowlist without a nonce pipeline.
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

const BASELINE_HEADERS = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  async headers() {
    return [
      { source: '/:path*', headers: BASELINE_HEADERS },
      {
        source: '/portal/:path*',
        headers: [...BASELINE_HEADERS, { key: 'Content-Security-Policy', value: PORTAL_CSP }],
      },
      {
        source: '/admin/:path*',
        headers: [...BASELINE_HEADERS, { key: 'Content-Security-Policy', value: PORTAL_CSP }],
      },
    ]
  },
}

module.exports = nextConfig

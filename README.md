# St. Kyrillos VI Church Website

**Live:** [stkyrillostn.org](https://stkyrillostn.org) · **Stack:** Next.js 14 · TypeScript · Tailwind CSS · Prisma · Vercel

A production full-stack web application for St. Kyrillos the Sixth Coptic Orthodox Church in Antioch, Nashville, TN. Ships real features used by an active congregation — not a demo.

---

## Highlights

### YouTube Live Stream Detection with API Quota Management
The most technically complex piece. YouTube's PubSubHubbub webhook notifies the app when a new video is published, but does **not** fire again when a scheduled stream goes live. To catch the `upcoming → live` transition without hammering the API:

- **Webhook (0 quota)** — catches stream creation in near real-time and stores the `videoId` in Postgres via Prisma
- **`videos.list` polling (1 quota unit / call)** — once a `videoId` is stored, verifies live status every 30 seconds
- **`search.list` fallback (100 quota units / call)** — rate-limited to once per 15 minutes, only fires if no `videoId` is stored and the webhook was missed
- **Cache-Control tuning** — `no-store` on live responses, `s-maxage=30` on offline responses to prevent Vercel's edge cache from pinning a stale "live" state across deploys

Result: near real-time detection with minimal quota spend.

### Admin Dashboard (Auth-Protected)
- NextAuth v5 session-based authentication
- CRUD for service schedules, weekly services, and content templates
- Activity audit log for all admin actions
- Coptic calendar data fetched from an external API, refreshed on a Vercel cron schedule

### Transactional Email via Resend
Membership join form validates input server-side and routes the submission to the priest's email via Resend, with proper domain verification.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router, Server Components) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS |
| Database | Prisma ORM + Postgres (Vercel Postgres) |
| Auth | NextAuth v5 |
| Email | Resend |
| External APIs | YouTube Data API v3, YouTube PubSubHubbub |
| Deployment | Vercel (with cron jobs) |

---

## Pages & Routes

| Route | Description |
|---|---|
| `/` | Homepage — hero, quick actions, schedule preview, Google Maps |
| `/about/*` | Coptic Orthodoxy, clergy, St. Kyrillos VI bio, FAQs |
| `/services/*` | Sunday School, choir, youth, men's/women's meetings, bookstore, hymns |
| `/schedule` | Weekly service schedule with live Coptic calendar day |
| `/media/livestream` | Auto-detects and embeds active YouTube live stream |
| `/confession` | Calendly-integrated confession booking |
| `/give` | Online giving info and Zelle details |
| `/resources` | Curated congregation resources |
| `/members/join` | Membership form — emails priest via Resend |
| `/admin/*` | Auth-protected dashboard (schedule, services, templates, logs) |

---

## API Routes

| Endpoint | Description |
|---|---|
| `GET /api/youtube-live` | 3-tier live detection (DB → verify → fallback search) |
| `POST /api/youtube-webhook` | PubSubHubbub subscriber — receives YouTube stream events |
| `GET /api/youtube-webhook/cron` | Keeps PubSub subscription alive (Vercel cron) |
| `GET /api/coptic/cron` | Refreshes Coptic calendar data (Vercel cron) |
| `POST /api/membership` | Validates join form, sends email via Resend |
| `CRUD /api/schedule` | Schedule management (admin only) |
| `CRUD /api/weekly-services` | Weekly service management (admin only) |
| `CRUD /api/templates` | Content template management (admin only) |

---

## Getting Started

```bash
npm install
cp .env.example .env.local   # fill in environment variables
npm run db:push               # apply Prisma schema
npm run dev                   # http://localhost:3000
```

### Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `NEXTAUTH_SECRET` | NextAuth session encryption secret |
| `NEXTAUTH_URL` | Public site URL |
| `YOUTUBE_API_KEY` | YouTube Data API v3 key |
| `RESEND_API_KEY` | Resend transactional email key |

---

## Project Structure

```
app/
├── (public pages)/       # All public routes
├── admin/                # Auth-protected dashboard
└── api/                  # REST API + webhook handlers
components/
├── home/                 # Homepage section components
├── layout/               # Navbar, Footer
├── ui/                   # Reusable primitives (Button, Card, Modal…)
└── (feature components)/ # Per-feature components
lib/
└── constants.ts          # Single source of truth — all church info, nav, schedule
prisma/
└── schema.prisma
```

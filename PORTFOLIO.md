# St. Kyrillos VI Church Website — Full Portfolio Document

**Live Site:** https://stkyrillostn.org
**GitHub:** https://github.com/Kirolous24/St.Kyrillos
**Role:** Solo Developer (design, architecture, full-stack implementation, deployment)

---

## Project Overview

Built a complete, production-grade church website for St. Kyrillos the Sixth Coptic Orthodox Church in Antioch, Nashville, Tennessee. This is a real, active site used by a real congregation — not a portfolio demo. The project includes a public-facing website with 15+ pages, a secure admin dashboard for church staff, a real-time livestream detection system, transactional email, and a Coptic calendar integration.

---

## What I Built

### 1. Public Website (15+ Pages)

Every page was designed and built from scratch with a consistent design system using Tailwind CSS.

| Page | What it does |
|---|---|
| `/` | Homepage with hero, quick actions, welcome message, live weekly schedule preview, and Google Maps embed |
| `/about/coptic-orthodoxy` | Educational content explaining the Coptic Orthodox faith |
| `/about/clergy` | Clergy profile page with bio and contact info |
| `/about/st-kyrillos-vi` | Biography of the church's patron saint |
| `/about/faqs` | Accordion FAQ with categorized questions for visitors |
| `/services` | Landing page for all church services and ministries |
| `/services/sunday-school` | Sunday School ministry page |
| `/services/choir` | Choir ministry page |
| `/services/youth-meeting` | Youth ministry page |
| `/services/mens-meeting` | Men's meeting page |
| `/services/womens-meeting` | Women's meeting page |
| `/services/bookstore` | Church bookstore page |
| `/services/hymns` | Hymns ministry page |
| `/schedule` | Weekly service schedule with live Coptic calendar day |
| `/media/livestream` | Auto-detects and embeds active YouTube live stream |
| `/confession` | Calendly-integrated confession booking |
| `/give` | Online giving page (Zelle + platform info) |
| `/resources` | Curated external resources for congregation members |
| `/members/join` | Membership intake form with server-side validation |
| `/privacy` | Privacy policy page |
| `/citations` | Citation references |

---

### 2. Real-Time YouTube Livestream Detection System

This is the most technically complex feature I built. The goal: automatically show an embedded live stream on the website when Sunday Liturgy goes live on YouTube, and hide it automatically when it ends — without manually updating anything.

**The challenge:** YouTube's quota system limits you to 10,000 API units per day. A naive polling approach (calling `search.list` every minute) would cost 144,000 units per day — 14x the daily limit.

**The solution — a 3-tier detection system:**

**Tier 1: YouTube PubSubHubbub Webhook (0 quota cost)**
- Subscribed the app to YouTube's PubSubHubbub (W3C WebSub) protocol
- YouTube pushes a notification to `/api/youtube-webhook` the moment a new video is published
- The webhook handler parses the Atom XML payload, extracts the video ID, calls `videos.list` (1 unit) to confirm it's a live/upcoming stream, and stores the result in Postgres via Prisma
- Subscription verification: YouTube sends a `hub.challenge` parameter that must be echoed back as plain text — implemented the handshake handler

**Critical edge case I solved:** YouTube's webhook fires when a stream is *created* (scheduled as "upcoming"), but does **not** fire again when the stream transitions from `upcoming → live`. If I only relied on the webhook, the stream would never show as live.

**Tier 2: `videos.list` Verification (1 quota unit per call)**
- Once a video ID is stored in the DB (from the webhook), the `/api/youtube-live` route polls `videos.list` every 30 seconds
- This catches the `upcoming → live` transition that the webhook misses
- Also detects when a stream ends (`liveBroadcastContent` changes from `live` to `none`) and clears the DB record

**Tier 3: `search.list` Fallback (100 quota units, max once per 15 min)**
- If no video ID is stored and the webhook was missed entirely, falls back to `search.list`
- Rate-limited by `lastSearchAt` timestamp in DB — only runs if 15+ minutes have passed since the last search
- Catches any streams that slipped through the webhook entirely

**Another edge case I solved:** Vercel's edge cache was pinning a 5-day-old "live" response across deploys and stream lifecycles. Fixed by forcing `Cache-Control: no-store, must-revalidate` on all live responses, while allowing `s-maxage=30` only when offline.

**One more race condition I handled:** YouTube re-fires webhooks whenever stream metadata changes. A scheduled future stream could fire an "upcoming" notification while a different stream is actively live, which would clobber the live state. Added a verification check: before accepting an "upcoming" notification for a new video, re-verify the currently-stored video is actually still live. If it's not (stream ended silently), clear it first.

**Result:** Near real-time detection with minimal quota spend. On a typical Sunday, total API cost is roughly 2–5 `videos.list` calls (2–5 units) + 0–1 `search.list` calls (0–100 units). Well within the 10,000 unit daily limit.

---

### 3. Admin Dashboard (Auth-Protected)

Built a full admin panel at `/admin` for church staff to manage content without touching code.

**Authentication**
- NextAuth v5 with session-based authentication
- Server-side auth check on every admin page using `auth()` — redirects unauthenticated users to `/admin/login`
- Password hashed with bcryptjs

**Schedule Manager**
- CRUD interface for managing weekly service schedules (create, edit, delete events)
- Loads the next 4 weeks of events in parallel with templates, weekly services, Coptic calendar data, and app settings via `Promise.all` to minimize load time
- Events displayed in a calendar-style UI

**Season Templates**
- Pre-built templates for liturgical seasons (e.g., Lent, Advent, feast days)
- Templates include multiple days with multiple events per day
- AI-assisted template suggestions based on upcoming Coptic feast days in the calendar data

**Weekly Services Manager**
- Separate from the calendar — manages the standing recurring services shown on the public `/services` page
- Toggle services on/off per week, reorder with `sortOrder`

**Activity Audit Log**
- Every admin action is logged with timestamp, user, and action type
- Viewable in the dashboard, clearable by admin

**Coptic Calendar Integration**
- Fetches live Coptic calendar data from an external API
- Displayed alongside the schedule so admin can see feast days while planning
- Refreshed on a Vercel cron schedule (`/api/coptic/cron`)

---

### 4. Membership Intake Form

Built a multi-section intake form at `/members/join` that:
- Collects: first/last name, email, phone, full address (with US state dropdown), date of birth, gender, marital status, children
- Validates all fields server-side in the API route before sending
- Sends a formatted email to the priest via **Resend** transactional email API, with verified custom domain (`stkyrillostn.org`)
- Returns a clean success state to the user on completion
- All data stays private — stored nowhere; goes directly to the priest's inbox

---

### 5. Vercel Cron Jobs

Set up two cron jobs in `vercel.json`:

| Cron Route | Schedule | Purpose |
|---|---|---|
| `/api/coptic/cron` | Daily | Refreshes Coptic calendar data cache |
| `/api/youtube-webhook/cron` | Every few days | Renews the YouTube PubSubHubbub subscription (leases expire) |

---

### 6. Design System

Built a consistent, custom design system entirely in Tailwind CSS:
- Custom color palette (`primary-*`, `gold`) defined in `tailwind.config`
- Reusable UI components: `Button`, `Card`, `Modal`, `Skeleton`, `SectionHeader`, `PageTransition`, `BackToTop`, `FloatingCTA`, `AnnouncementBanner`, `OptimizedImage`, `ParallaxHero`
- Responsive layouts across all pages (mobile-first)
- `next/image` used for all images (automatic WebP conversion, lazy loading, size optimization)
- Serif/sans-serif font pairing for church aesthetic

---

### 7. Single Source of Truth Architecture

All church-specific data lives in one file: `lib/constants.ts`. This includes:
- Church name, address, phone, email, office hours, diocese
- Clergy information and bios
- Service schedule times
- Social media links
- Navigation structure
- Footer links
- Giving info and scripture
- Livestream channel IDs and URLs
- Confession/Calendly config
- FAQ content (all questions and answers)

This means updating any piece of church information requires editing exactly one file — no hunting through components.

---

## Technical Achievements & Problem-Solving

| Challenge | Solution |
|---|---|
| YouTube API quota limit (10,000 units/day) | 3-tier detection: webhook (0 units) → verify (1 unit) → search fallback (100 units, rate-limited) |
| `upcoming → live` transition not fired by webhook | 30-second `videos.list` polling loop once a videoId is known |
| Vercel edge cache pinning stale "live" state | `Cache-Control: no-store` on all live responses |
| Webhook clobbering active live stream with "upcoming" notification | Re-verify stored stream before accepting new upcoming; clear stale state first |
| PubSub subscriptions expire | Cron job renews subscription before lease expires |
| New member intake with no database | Form → API validation → Resend email → priest's inbox |
| Parallel data fetching on admin dashboard | `Promise.all` for 5 concurrent DB/API calls at page load |

---

## Tech Stack

| Category | Technology |
|---|---|
| Framework | Next.js 14 (App Router, Server Components, Server Actions) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS |
| Database | PostgreSQL via Prisma ORM |
| Authentication | NextAuth v5 (session-based, bcryptjs password hashing) |
| Email | Resend (transactional email, custom domain) |
| External APIs | YouTube Data API v3, YouTube PubSubHubbub (WebSub) |
| Deployment | Vercel (Serverless Functions + Edge Network + Cron Jobs) |
| Icons | Lucide React |
| Image Optimization | Next.js Image component (WebP, lazy load) |

---

## Skills Demonstrated

**Frontend**
- React 18 with Server and Client Components (Next.js App Router)
- TypeScript — strict, typed throughout (interfaces, const assertions, generics)
- Tailwind CSS — custom design system, responsive layouts, component variants
- Form state management with controlled inputs, validation, and async submission UX
- Optimized images, page transitions, skeleton loading states

**Backend**
- REST API design with Next.js Route Handlers
- Prisma ORM — schema design, migrations, upsert patterns, relational queries
- PostgreSQL database design
- Server-side authentication with NextAuth v5 and session validation
- Transactional email with Resend and custom domain verification

**Systems & Infrastructure**
- YouTube Data API v3 — `search.list`, `videos.list`, `liveStreamingDetails`
- WebSub/PubSubHubbub protocol — subscription, verification handshake, Atom XML parsing
- Vercel Cron Jobs for scheduled background tasks
- HTTP Cache-Control strategy — `no-store`, `s-maxage`, `stale-while-revalidate`
- API quota management and rate limiting

**Architecture & Engineering**
- Multi-tier fallback system design (webhook → verify → search)
- Race condition identification and resolution
- Single source of truth data architecture
- Parallel async data fetching with `Promise.all`
- Edge case handling (stale cache, clobbered state, expired subscriptions)

---

## Numbers

- **15+** public pages
- **19** API routes
- **35+** React components
- **1** codebase, solo built end-to-end
- **~0** quota units used on a typical non-live day
- **<30 seconds** from stream going live to appearing on the website

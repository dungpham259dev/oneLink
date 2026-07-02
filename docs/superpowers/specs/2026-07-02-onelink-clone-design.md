# OneLink Clone — Design Spec

**Date:** 2026-07-02
**Repo:** https://github.com/dungpham259dev/oneLink
**Domain:** buildsolo.online

## 1. Overview

A full clone of onelink.to: a smart deep-link service that turns one URL into a
device-aware redirect. A visitor opening `buildsolo.online/r/<slug>` is detected
by User-Agent (iOS / iPadOS / Android / Huawei / Windows / macOS / other) and
redirected to the matching app-store URL, falling back to a configured URL when
no match applies. Each link ships with a fully customizable QR code (brand logo,
colors, gradient, dot/eye styles). Owners get analytics (device, country,
referrer, UTM, redirect target) and manage everything from a dashboard. Billing
is Free vs Pro ($10/month) via Stripe.

## 2. Tech Stack

| Concern         | Choice                                                        |
|-----------------|---------------------------------------------------------------|
| Framework       | Next.js 15 (App Router, TypeScript, React Server Components)   |
| UI              | ShadCN/ui + TailwindCSS                                        |
| Hosting         | Vercel                                                         |
| Database        | Neon Postgres + Prisma ORM                                     |
| Auth            | NextAuth (Auth.js) v5 — email magic link + Google OAuth        |
| Billing         | Stripe (Checkout + Customer Portal + Webhooks)                |
| Edge cache/buffer | Upstash Redis (REST, edge-compatible)                       |
| Asset storage   | Vercel Blob (QR logo uploads)                                 |
| QR generation   | `qr-code-styling`                                             |
| Scheduled jobs  | Vercel Cron                                                   |
| Geo detection   | Vercel Edge `request.geo` (free, no external service)         |
| Validation      | Zod (all boundaries)                                          |
| Testing         | Vitest (unit/integration) + Playwright (E2E)                  |
| Language        | English UI                                                    |

## 3. Architecture — Three Flows

### 3.1 Public Redirect — `/r/[slug]` (Edge Runtime)

The performance-critical path. Runs at the edge, close to the visitor.

Flow:
1. Read link config from **Upstash Redis** by slug (fast, edge-compatible REST).
   Prisma does not run well on Edge — Postgres is never queried here.
2. Detect device from `User-Agent`: iOS, iPadOS, Android, Huawei (non-Google),
   Windows, macOS, other.
3. Select the destination URL for that device; if none, use `fallbackUrl`; if
   that is also empty, render the link's minimal landing page.
4. Issue a `302` redirect immediately.
5. **Fire-and-forget** an analytics event into Upstash (device, os, country from
   `request.geo`, referrer, UTM params, redirect target). Never blocks the redirect.

Cache sync: creating/updating a link in the dashboard writes Postgres **and**
upserts the slug→config JSON into Upstash. Deleting removes both.

### 3.2 Dashboard — `/app/*` (protected)

NextAuth-gated. Server Components + Server Actions. Sections:
- **Links list** — create / edit / delete, copy short URL, per-link stat counts.
- **Link config** — all destination URLs, fallback, custom slug (Pro), parameter
  forwarding (Pro).
- **QR studio** — live-preview customization, logo upload, export PNG (S/L) + SVG.
- **Analytics** — device / redirect / country / referrer / UTM breakdowns with a
  date-range picker; CSV export.
- **Billing** — current plan, upgrade to Pro (Checkout), manage via Customer Portal.

### 3.3 Marketing — public

Four pages mirroring onelink: `/` (Home), `/pricing`, `/about`, `/support`.

## 4. Data Model (Prisma)

- **User** — id, email, name, image, `stripeCustomerId`, `plan` (FREE | PRO),
  `planExpiresAt`. Plus NextAuth's Account, Session, VerificationToken.
- **Link** — id, `userId`, `slug` (unique; random for Free, custom allowed for Pro),
  `name` (internal label), `iosUrl`, `ipadUrl`, `androidUrl`, `huaweiUrl`,
  `windowsUrl` (Pro), `macUrl` (Pro), `fallbackUrl`, `parameterForwarding` (bool, Pro),
  `createdAt`, `updatedAt`.
- **QrConfig** — 1:1 with Link. JSON style: fg/bg color, gradient, dotStyle,
  cornerStyle (eye), logo (Vercel Blob URL), margin, size. Logo + gradient apply
  only for Pro.
- **AnalyticsEvent** — id, `linkId`, `timestamp`, `deviceType`, `os`, `country`,
  `referrer`, `utmSource`, `utmMedium`, `utmCampaign`, `redirectedTo`
  (matched | fallback | landing). Index on `(linkId, timestamp)`.
- **Subscription** — `userId`, `stripeSubscriptionId`, `status`, `currentPeriodEnd`.
  Stripe is the source of truth; this table mirrors webhook state.

Notes: QR logos live in Vercel Blob (never base64 in DB). AnalyticsEvent stores
raw rows for MVP (GROUP BY queries); daily aggregation is a future optimization.

## 5. Billing (Stripe)

1. "Upgrade to Pro" → create Stripe **Checkout Session** ($10/mo recurring) → redirect.
2. On success, Stripe **webhook** (`checkout.session.completed`,
   `customer.subscription.updated`, `customer.subscription.deleted`) hits a Node-runtime
   API route → verify signature → update `User.plan` + `Subscription`.
3. Manage/cancel via Stripe **Customer Portal**.

Principle: Stripe is the source of truth. `User.plan` is a fast-gate cache the
webhook keeps in sync. Never trust the client for plan state.

## 6. Feature Gating

Central config in `lib/plans.ts` defines every limit; no gating logic is
hardcoded elsewhere. Server Actions re-check the plan before every write.

| Capability            | Free                    | Pro ($10/mo)              |
|-----------------------|-------------------------|---------------------------|
| Link count            | 3                       | Unlimited                 |
| Custom slug           | ✗ (random)              | ✓                         |
| QR logo + gradient    | ✗ (basic color only)    | ✓                         |
| Desktop links (Win/Mac)| ✗                      | ✓                         |
| Parameter forwarding  | ✗                       | ✓                         |
| Analytics             | Device + total clicks   | Full: redirect/country/referrer/UTM |
| Ads / branding        | Present                 | Removed                   |

## 7. Analytics Pipeline

Edge redirect pushes events into **Upstash Redis** (a buffer list). A **Vercel Cron**
job periodically flushes buffered events into Postgres `AnalyticsEvent` in batches.
Dashboard reads aggregates from Postgres. Country comes from Vercel Edge `request.geo`.

## 8. Error Handling

- Unknown slug → friendly 404 page.
- No device match → `fallbackUrl`; if empty → link's minimal landing page.
- All boundaries validated with Zod: forms, Server Actions, webhook payloads, API routes.
- Webhook signature verification failures are logged and rejected (400).
- Errors are never silently swallowed; user-facing messages stay friendly, server
  logs carry detail.

## 9. Testing (target 80%+)

- **Unit (Vitest):** device detection, plan gating logic, QR config serialization,
  URL/UTM parsing.
- **Integration:** Server Actions (link CRUD, cache sync), Stripe webhook handler
  (mocked events), analytics flush job.
- **E2E (Playwright):** sign up → create link → redirect resolves correct device
  target → upgrade to Pro → Pro-gated feature unlocks.

## 10. Out of Scope (MVP)

Custom short domains per user, team/multi-seat, non-profit/enterprise tiers,
daily analytics aggregation tables, link folders/tags, link expiry, i18n.

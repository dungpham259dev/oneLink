# OneLink

A device-aware smart-link service (a OneLink.to / Linktree-style clone). Create a
single short link that redirects visitors to different destinations based on
their device (iOS / Android / Desktop), generate custom-styled QR codes, track
click analytics, and manage billing with Free and Pro tiers via Stripe.

- **Production domain:** `buildsolo.online`
- **Short links:** `buildsolo.online/r/<slug>`

## Tech Stack

| Concern | Technology |
|---|---|
| Framework | Next.js 16 (App Router), TypeScript |
| UI | ShadCN/ui, Tailwind CSS v4 |
| Database / ORM | Neon Postgres + Prisma |
| Auth | Auth.js / NextAuth v5 (Google OAuth + Email magic link) |
| Payments | Stripe (Checkout + Billing Portal + Webhooks) |
| Edge cache / rate limiting / analytics buffer | Upstash Redis |
| File storage | Vercel Blob (avatars, QR exports) |
| QR codes | qr-code-styling |
| Validation | Zod |
| Unit / integration tests | Vitest |
| E2E tests | Playwright |
| Hosting | Vercel (Edge + Serverless functions, Vercel Cron) |

## Architecture Notes

- The public redirect route `/r/<slug>` runs on the **Vercel Edge Runtime** and
  reads link configuration from **Upstash Redis** only. Prisma/Postgres is
  never touched on the hot redirect path, keeping redirects fast globally.
- Each redirect click is buffered into Upstash Redis and periodically
  **flushed to Postgres by a Vercel Cron job** (`/api/cron/flush-analytics`,
  every 5 minutes — see `vercel.json`). The cron endpoint is protected by the
  `CRON_SECRET` environment variable.
- **Stripe is the source of truth for subscription/plan state.** The
  application never flips a user's plan optimistically — plan changes only
  ever happen inside the `/api/webhooks/stripe` webhook handler, which mirrors
  the authoritative Stripe state into the Postgres `User`/`Subscription`
  records.

## Local Development

Prerequisites: Node.js (see `.nvmrc`/`package.json` engines if present), pnpm,
and a Postgres database (e.g. a free [Neon](https://neon.tech) project).

```bash
# 1. Install dependencies
pnpm install

# 2. Copy the env template and fill in values (see table below)
cp .env.example .env

# 3. Generate the Prisma client
pnpm dlx prisma generate

# 4. Push the schema to your database (requires DATABASE_URL)
pnpm dlx prisma db push

# 5. Run the dev server
pnpm dev
```

The app will be available at http://localhost:3000.

### Testing

```bash
# Unit / integration tests (Vitest)
pnpm test

# With coverage report
pnpm test:coverage

# End-to-end tests (Playwright)
# Requires the app to be running (pnpm dev) and at least one seeded link
# in the database to exercise the redirect flow against.
pnpm test:e2e
```

## Environment Variables

Copy `.env.example` to `.env` and fill in every value below before running the
app. All variables are required — the app validates configuration at startup
(and in some cases, such as the email transport, at build time) and will fail
fast if one is missing.

| Variable | Description | Where to get it |
|---|---|---|
| `DATABASE_URL` | Postgres connection string used by Prisma. | Create a free project at [Neon](https://neon.tech) and copy the pooled connection string. |
| `NEXTAUTH_SECRET` | Secret used by Auth.js/NextAuth to sign/encrypt session tokens and JWTs. | Generate locally: `openssl rand -base64 32`. |
| `NEXTAUTH_URL` | Canonical base URL of the app, used by NextAuth for callbacks. | `http://localhost:3000` locally; `https://buildsolo.online` in production. |
| `GOOGLE_CLIENT_ID` | OAuth client ID for "Sign in with Google". | [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → OAuth 2.0 Client ID. |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret paired with the above. | Same Google Cloud Console credential. |
| `EMAIL_SERVER` | SMTP connection URL used to send magic-link sign-in emails. | Any SMTP provider (e.g. Resend, Postmark, Gmail app password). Format: `smtp://user:pass@host:port`. **Note:** Nodemailer validates this eagerly, so the build/app will fail to start if it is unset — always provide a value, even a dummy one, for local builds without email sign-in. |
| `EMAIL_FROM` | The "From" address used on outgoing magic-link emails. | Any address verified with your SMTP provider, e.g. `OneLink <noreply@buildsolo.online>`. |
| `UPSTASH_REDIS_REST_URL` | REST endpoint for the Upstash Redis database used for link caching, rate limiting, and the analytics buffer. | [Upstash Console](https://console.upstash.com/) → create a Redis database → REST API section. |
| `UPSTASH_REDIS_REST_TOKEN` | REST auth token paired with the URL above. | Same Upstash Console database page. |
| `STRIPE_SECRET_KEY` | Server-side Stripe API key used to create Checkout Sessions and manage subscriptions. | [Stripe Dashboard](https://dashboard.stripe.com/apikeys) → Developers → API keys. |
| `STRIPE_WEBHOOK_SECRET` | Signing secret used to verify incoming Stripe webhook events. | Stripe Dashboard → Developers → Webhooks → your endpoint → "Signing secret" (or `stripe listen` CLI output locally). |
| `STRIPE_PRO_PRICE_ID` | Price ID for the Pro plan subscription product. | Stripe Dashboard → Product Catalog → Pro product → Price ID (`price_...`). |
| `BLOB_READ_WRITE_TOKEN` | Read/write token for Vercel Blob storage (avatars, exported QR images). | Vercel Dashboard → Storage → Blob store → `.env.local` tab, or `vercel env pull`. |
| `NEXT_PUBLIC_APP_URL` | Public base URL of the app, exposed to the client bundle (used for building absolute short-link/QR URLs). | `http://localhost:3000` locally; `https://buildsolo.online` in production. |
| `CRON_SECRET` | Shared secret that guards the `/api/cron/flush-analytics` endpoint so only Vercel Cron (or an authorized caller) can trigger the analytics flush. | Self-generated random string, e.g. `openssl rand -hex 32`. In production, set the same value as a Vercel environment variable — Vercel Cron automatically sends it as a bearer token to cron routes. |

## Deployment

The following steps require live Vercel/Stripe accounts and cannot be executed
from this development environment — they are documented here for whoever
performs the production deployment.

1. **Push the repository** to GitHub (or your Git provider of choice).
2. **Import the project into the [Vercel dashboard](https://vercel.com/new)**,
   selecting this repository. Vercel will auto-detect the Next.js framework.
3. **Set all environment variables** listed in the table above in the
   Vercel project's Settings → Environment Variables (for both Production and
   Preview environments as appropriate). Use production values for Stripe keys,
   the production Neon database URL, etc.
4. **Add the custom domain** `buildsolo.online` under Settings → Domains, and
   follow Vercel's instructions to point your DNS at Vercel.
5. **Cron job**: `vercel.json` already declares a cron that hits
   `/api/cron/flush-analytics` every 5 minutes. Vercel automatically
   registers and runs this cron once the project is deployed — no manual
   setup needed, beyond ensuring `CRON_SECRET` is set in the project's
   environment variables.
6. **Configure the Stripe production webhook**:
   - In the [Stripe Dashboard](https://dashboard.stripe.com/webhooks), add an
     endpoint pointing to `https://buildsolo.online/api/webhooks/stripe`.
   - Subscribe it to the relevant subscription/checkout events (e.g.
     `checkout.session.completed`, `customer.subscription.updated`,
     `customer.subscription.deleted`).
   - Copy the endpoint's signing secret into the `STRIPE_WEBHOOK_SECRET`
     environment variable in Vercel, then redeploy.
7. **Smoke test production**:
   - Create a link in the app and confirm it appears in the dashboard.
   - Hit `https://buildsolo.online/r/<slug>` with an iPhone user agent (e.g.
     via `curl -A "Mozilla/5.0 (iPhone...)"`) and confirm you get a `302`
     redirect to the configured iOS destination.
   - Upgrade a test account to Pro using a Stripe test card
     (`4242 4242 4242 4242`) and confirm the account's plan flips to `PRO`
     only after the Stripe webhook fires (i.e. it is not flipped
     optimistically on the client).

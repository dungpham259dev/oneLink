# OneLink Clone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a device-aware smart-link service (onelink.to clone) with customizable QR codes, analytics, and Free/Pro Stripe billing, deployed on Vercel.

**Architecture:** Next.js 15 App Router. Public redirect runs at the Edge reading link config from Upstash Redis (Prisma never touches Edge). Dashboard uses Server Components + Server Actions backed by Neon Postgres via Prisma. Analytics events buffer in Upstash and flush to Postgres via Vercel Cron. Stripe is the source of truth for plan state, mirrored into Postgres by webhook.

**Tech Stack:** Next.js 15, TypeScript, ShadCN/ui, TailwindCSS, Prisma + Neon Postgres, NextAuth (Auth.js) v5, Stripe, Upstash Redis, Vercel Blob, qr-code-styling, Zod, Vitest, Playwright.

## Global Constraints

- Node version floor: Node 20+ (Next.js 15 requirement).
- Package manager: pnpm.
- Domain: `buildsolo.online`. Short links live at `buildsolo.online/r/<slug>`.
- UI language: English.
- Plan values: Free = 3 links, random slug, basic-color QR only, device+total-clicks analytics, branding shown. Pro = $10/month, unlimited links, custom slug, QR logo+gradient, Windows+Mac links, parameter forwarding, full analytics, no branding.
- Edge runtime code (redirect path) MUST NOT import Prisma or any Node-only module. It reads only from Upstash Redis REST client.
- All boundaries (forms, Server Actions, webhooks, API routes) validate input with Zod.
- Stripe is the source of truth for `User.plan`; only webhooks mutate plan state.
- TDD: write failing test → verify fail → minimal implementation → verify pass → commit.

---

## Phase 0 — Project Foundation

### Task 0.1: Scaffold Next.js project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `.gitignore`, `app/layout.tsx`, `app/page.tsx`, `.env.example`

**Interfaces:**
- Produces: a running Next.js 15 App Router project with TypeScript and Tailwind.

- [ ] **Step 1: Scaffold**

```bash
pnpm create next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*" --use-pnpm --eslint
```

- [ ] **Step 2: Verify dev server boots**

Run: `pnpm dev` then curl `http://localhost:3000`
Expected: HTTP 200, default Next.js page HTML.

- [ ] **Step 3: Create `.env.example`**

```
DATABASE_URL=
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
EMAIL_SERVER=
EMAIL_FROM=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRO_PRICE_ID=
BLOB_READ_WRITE_TOKEN=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore: scaffold Next.js 15 project with Tailwind"
```

### Task 0.2: Install ShadCN/ui and testing tooling

**Files:**
- Create: `components.json`, `vitest.config.ts`, `vitest.setup.ts`, `playwright.config.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `pnpm test` (Vitest) and `pnpm test:e2e` (Playwright) scripts; ShadCN CLI usable.

- [ ] **Step 1: Init ShadCN**

```bash
pnpm dlx shadcn@latest init -d
pnpm dlx shadcn@latest add button input card dialog table tabs form label select badge sonner
```

- [ ] **Step 2: Install test deps**

```bash
pnpm add -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom @playwright/test
```

- [ ] **Step 3: Write `vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: { environment: "jsdom", setupFiles: ["./vitest.setup.ts"], globals: true },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
});
```

- [ ] **Step 4: Write `vitest.setup.ts`**

```typescript
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 5: Add scripts to `package.json`**

```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest",
  "test:e2e": "playwright test"
}
```

- [ ] **Step 6: Add a smoke test `lib/__tests__/smoke.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
describe("smoke", () => { it("runs", () => { expect(1 + 1).toBe(2); }); });
```

- [ ] **Step 7: Run tests**

Run: `pnpm test`
Expected: 1 passing test.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "chore: add ShadCN/ui and Vitest/Playwright tooling"
```

### Task 0.3: Prisma + Neon setup with schema

**Files:**
- Create: `prisma/schema.prisma`, `lib/db.ts`
- Modify: `.env` (local), `package.json`

**Interfaces:**
- Produces: `db` (PrismaClient singleton) exported from `lib/db.ts`; models User, Account, Session, VerificationToken, Link, QrConfig, AnalyticsEvent, Subscription.

- [ ] **Step 1: Install Prisma**

```bash
pnpm add @prisma/client && pnpm add -D prisma
pnpm dlx prisma init --datasource-provider postgresql
```

- [ ] **Step 2: Write `prisma/schema.prisma`**

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

enum Plan { FREE PRO }
enum DeviceType { IOS IPADOS ANDROID HUAWEI WINDOWS MACOS OTHER }
enum RedirectTarget { MATCHED FALLBACK LANDING }

model User {
  id             String    @id @default(cuid())
  name           String?
  email          String    @unique
  emailVerified  DateTime?
  image          String?
  plan           Plan      @default(FREE)
  planExpiresAt  DateTime?
  stripeCustomerId String? @unique
  accounts       Account[]
  sessions       Session[]
  links          Link[]
  subscription   Subscription?
  createdAt      DateTime  @default(now())
}

model Account {
  id                String @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime
  @@unique([identifier, token])
}

model Link {
  id                  String   @id @default(cuid())
  userId              String
  slug                String   @unique
  name                String?
  iosUrl              String?
  ipadUrl             String?
  androidUrl          String?
  huaweiUrl           String?
  windowsUrl          String?
  macUrl              String?
  fallbackUrl         String?
  parameterForwarding Boolean  @default(false)
  user     User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  qrConfig QrConfig?
  events   AnalyticsEvent[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([userId])
}

model QrConfig {
  id          String  @id @default(cuid())
  linkId      String  @unique
  fgColor     String  @default("#000000")
  bgColor     String  @default("#ffffff")
  gradient    Json?
  dotStyle    String  @default("square")
  cornerStyle String  @default("square")
  logoUrl     String?
  margin      Int     @default(10)
  size        Int     @default(300)
  link Link @relation(fields: [linkId], references: [id], onDelete: Cascade)
}

model AnalyticsEvent {
  id           String         @id @default(cuid())
  linkId       String
  timestamp    DateTime       @default(now())
  deviceType   DeviceType
  os           String?
  country      String?
  referrer     String?
  utmSource    String?
  utmMedium    String?
  utmCampaign  String?
  redirectedTo RedirectTarget
  link Link @relation(fields: [linkId], references: [id], onDelete: Cascade)
  @@index([linkId, timestamp])
}

model Subscription {
  id                   String   @id @default(cuid())
  userId               String   @unique
  stripeSubscriptionId String   @unique
  status               String
  currentPeriodEnd     DateTime
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

- [ ] **Step 3: Write `lib/db.ts`**

```typescript
import { PrismaClient } from "@prisma/client";
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const db = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

- [ ] **Step 4: Push schema to Neon**

Run: `pnpm dlx prisma db push` (with `DATABASE_URL` set to a Neon dev branch)
Expected: "Your database is now in sync with your Prisma schema."

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add Prisma schema and Neon database client"
```

---

## Phase 1 — Plan Config & Device Detection (pure logic, no I/O)

### Task 1.1: Central plan config

**Files:**
- Create: `lib/plans.ts`, `lib/__tests__/plans.test.ts`

**Interfaces:**
- Produces: `PLAN_LIMITS: Record<Plan, PlanLimits>`; `PlanLimits` type with fields `maxLinks: number | null` (null = unlimited), `customSlug: boolean`, `qrLogo: boolean`, `qrGradient: boolean`, `desktopLinks: boolean`, `parameterForwarding: boolean`, `fullAnalytics: boolean`, `showBranding: boolean`. Function `canCreateLink(plan, currentCount): boolean`.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { PLAN_LIMITS, canCreateLink } from "@/lib/plans";

describe("plan limits", () => {
  it("free allows 3 links max", () => {
    expect(PLAN_LIMITS.FREE.maxLinks).toBe(3);
    expect(canCreateLink("FREE", 2)).toBe(true);
    expect(canCreateLink("FREE", 3)).toBe(false);
  });
  it("pro is unlimited", () => {
    expect(PLAN_LIMITS.PRO.maxLinks).toBeNull();
    expect(canCreateLink("PRO", 9999)).toBe(true);
  });
  it("pro unlocks qr logo and custom slug", () => {
    expect(PLAN_LIMITS.PRO.qrLogo).toBe(true);
    expect(PLAN_LIMITS.FREE.qrLogo).toBe(false);
    expect(PLAN_LIMITS.PRO.customSlug).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test lib/__tests__/plans.test.ts`
Expected: FAIL — cannot find module `@/lib/plans`.

- [ ] **Step 3: Write minimal implementation**

```typescript
import type { Plan } from "@prisma/client";

export type PlanLimits = {
  maxLinks: number | null;
  customSlug: boolean;
  qrLogo: boolean;
  qrGradient: boolean;
  desktopLinks: boolean;
  parameterForwarding: boolean;
  fullAnalytics: boolean;
  showBranding: boolean;
};

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  FREE: { maxLinks: 3, customSlug: false, qrLogo: false, qrGradient: false,
    desktopLinks: false, parameterForwarding: false, fullAnalytics: false, showBranding: true },
  PRO: { maxLinks: null, customSlug: true, qrLogo: true, qrGradient: true,
    desktopLinks: true, parameterForwarding: true, fullAnalytics: true, showBranding: false },
};

export function canCreateLink(plan: Plan, currentCount: number): boolean {
  const max = PLAN_LIMITS[plan].maxLinks;
  return max === null || currentCount < max;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test lib/__tests__/plans.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add central plan limits config"
```

### Task 1.2: Device detection from User-Agent

**Files:**
- Create: `lib/device.ts`, `lib/__tests__/device.test.ts`

**Interfaces:**
- Consumes: `DeviceType` enum from `@prisma/client`.
- Produces: `detectDevice(userAgent: string): { device: DeviceType; os: string }`.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { detectDevice } from "@/lib/device";

describe("detectDevice", () => {
  it("detects iPhone", () => {
    expect(detectDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)").device).toBe("IOS");
  });
  it("detects iPad", () => {
    expect(detectDevice("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)").device).toBe("IPADOS");
  });
  it("detects Huawei device", () => {
    expect(detectDevice("Mozilla/5.0 (Linux; Android 10; HUAWEI P40 Build/HUAWEIANA)").device).toBe("HUAWEI");
  });
  it("detects generic Android", () => {
    expect(detectDevice("Mozilla/5.0 (Linux; Android 13; Pixel 7)").device).toBe("ANDROID");
  });
  it("detects Windows", () => {
    expect(detectDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64)").device).toBe("WINDOWS");
  });
  it("detects macOS", () => {
    expect(detectDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)").device).toBe("MACOS");
  });
  it("falls back to OTHER", () => {
    expect(detectDevice("curl/8.0").device).toBe("OTHER");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test lib/__tests__/device.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write minimal implementation**

```typescript
import type { DeviceType } from "@prisma/client";

export function detectDevice(userAgent: string): { device: DeviceType; os: string } {
  const ua = userAgent || "";
  if (/iPad/.test(ua)) return { device: "IPADOS", os: "iPadOS" };
  if (/iPhone|iPod/.test(ua)) return { device: "IOS", os: "iOS" };
  if (/Android/.test(ua)) {
    if (/HUAWEI|HarmonyOS|; HMSCore/i.test(ua)) return { device: "HUAWEI", os: "HarmonyOS/Android" };
    return { device: "ANDROID", os: "Android" };
  }
  if (/Windows NT/.test(ua)) return { device: "WINDOWS", os: "Windows" };
  if (/Macintosh|Mac OS X/.test(ua)) return { device: "MACOS", os: "macOS" };
  return { device: "OTHER", os: "unknown" };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test lib/__tests__/device.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add device detection from user-agent"
```

### Task 1.3: Destination resolution logic

**Files:**
- Create: `lib/resolve.ts`, `lib/__tests__/resolve.test.ts`

**Interfaces:**
- Consumes: `DeviceType`, `RedirectTarget` from `@prisma/client`; `detectDevice` from `lib/device.ts`.
- Produces: type `LinkConfig` = `{ slug: string; iosUrl?: string|null; ipadUrl?: string|null; androidUrl?: string|null; huaweiUrl?: string|null; windowsUrl?: string|null; macUrl?: string|null; fallbackUrl?: string|null; parameterForwarding: boolean }`. Function `resolveDestination(config: LinkConfig, device: DeviceType, incomingQuery: string): { url: string | null; target: RedirectTarget }`.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { resolveDestination, type LinkConfig } from "@/lib/resolve";

const base: LinkConfig = {
  slug: "abc", iosUrl: "https://apps.apple.com/x", androidUrl: "https://play.google.com/y",
  ipadUrl: null, huaweiUrl: null, windowsUrl: null, macUrl: null,
  fallbackUrl: "https://example.com", parameterForwarding: false,
};

describe("resolveDestination", () => {
  it("returns iOS url for IOS device as MATCHED", () => {
    const r = resolveDestination(base, "IOS", "");
    expect(r.url).toBe("https://apps.apple.com/x");
    expect(r.target).toBe("MATCHED");
  });
  it("falls back when no device url", () => {
    const r = resolveDestination(base, "WINDOWS", "");
    expect(r.url).toBe("https://example.com");
    expect(r.target).toBe("FALLBACK");
  });
  it("ipad falls back to ios url when ipadUrl empty", () => {
    const r = resolveDestination(base, "IPADOS", "");
    expect(r.url).toBe("https://apps.apple.com/x");
    expect(r.target).toBe("MATCHED");
  });
  it("returns landing when no url at all", () => {
    const r = resolveDestination({ ...base, iosUrl: null, androidUrl: null, fallbackUrl: null }, "IOS", "");
    expect(r.url).toBeNull();
    expect(r.target).toBe("LANDING");
  });
  it("forwards query params when enabled", () => {
    const r = resolveDestination({ ...base, parameterForwarding: true }, "IOS", "utm_source=fb");
    expect(r.url).toBe("https://apps.apple.com/x?utm_source=fb");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test lib/__tests__/resolve.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write minimal implementation**

```typescript
import type { DeviceType, RedirectTarget } from "@prisma/client";

export type LinkConfig = {
  slug: string;
  iosUrl?: string | null; ipadUrl?: string | null; androidUrl?: string | null;
  huaweiUrl?: string | null; windowsUrl?: string | null; macUrl?: string | null;
  fallbackUrl?: string | null; parameterForwarding: boolean;
};

function pickUrl(c: LinkConfig, device: DeviceType): string | null {
  switch (device) {
    case "IOS": return c.iosUrl ?? null;
    case "IPADOS": return c.ipadUrl ?? c.iosUrl ?? null;
    case "ANDROID": return c.androidUrl ?? null;
    case "HUAWEI": return c.huaweiUrl ?? c.androidUrl ?? null;
    case "WINDOWS": return c.windowsUrl ?? null;
    case "MACOS": return c.macUrl ?? null;
    default: return null;
  }
}

function appendQuery(url: string, query: string): string {
  if (!query) return url;
  return url.includes("?") ? `${url}&${query}` : `${url}?${query}`;
}

export function resolveDestination(
  config: LinkConfig, device: DeviceType, incomingQuery: string
): { url: string | null; target: RedirectTarget } {
  const matched = pickUrl(config, device);
  if (matched) {
    const url = config.parameterForwarding ? appendQuery(matched, incomingQuery) : matched;
    return { url, target: "MATCHED" };
  }
  if (config.fallbackUrl) {
    const url = config.parameterForwarding ? appendQuery(config.fallbackUrl, incomingQuery) : config.fallbackUrl;
    return { url, target: "FALLBACK" };
  }
  return { url: null, target: "LANDING" };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test lib/__tests__/resolve.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add destination resolution logic"
```

### Task 1.4: Slug generation

**Files:**
- Create: `lib/slug.ts`, `lib/__tests__/slug.test.ts`

**Interfaces:**
- Produces: `generateSlug(length?: number): string` (default length 6, chars `a-z0-9`); `isValidCustomSlug(slug: string): boolean` (3–32 chars, `[a-z0-9-]`, no leading/trailing dash).

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { generateSlug, isValidCustomSlug } from "@/lib/slug";

describe("slug", () => {
  it("generates 6-char lowercase alnum slug", () => {
    const s = generateSlug();
    expect(s).toMatch(/^[a-z0-9]{6}$/);
  });
  it("validates custom slugs", () => {
    expect(isValidCustomSlug("my-app")).toBe(true);
    expect(isValidCustomSlug("ab")).toBe(false);
    expect(isValidCustomSlug("-bad")).toBe(false);
    expect(isValidCustomSlug("Bad Caps")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test lib/__tests__/slug.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write minimal implementation**

```typescript
const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

export function generateSlug(length = 6): string {
  let out = "";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export function isValidCustomSlug(slug: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/.test(slug);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test lib/__tests__/slug.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add slug generation and validation"
```

---

## Phase 2 — Authentication (NextAuth v5)

### Task 2.1: NextAuth configuration with Prisma adapter

**Files:**
- Create: `auth.ts`, `app/api/auth/[...nextauth]/route.ts`, `lib/auth-helpers.ts`
- Modify: `.env`

**Interfaces:**
- Consumes: `db` from `lib/db.ts`.
- Produces: `auth`, `handlers`, `signIn`, `signOut` exports from `auth.ts`. `getCurrentUser()` from `lib/auth-helpers.ts` returning the DB `User` or `null`. Session includes `user.id` and `user.plan`.

- [ ] **Step 1: Install deps**

```bash
pnpm add next-auth@beta @auth/prisma-adapter nodemailer
```

- [ ] **Step 2: Write `auth.ts`**

```typescript
import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import Nodemailer from "next-auth/providers/nodemailer";
import { db } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "database" },
  providers: [
    Google({ clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET! }),
    Nodemailer({ server: process.env.EMAIL_SERVER!, from: process.env.EMAIL_FROM! }),
  ],
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      // @ts-expect-error augmented below
      session.user.plan = (user as { plan?: string }).plan ?? "FREE";
      return session;
    },
  },
  pages: { signIn: "/login" },
});
```

- [ ] **Step 3: Write `app/api/auth/[...nextauth]/route.ts`**

```typescript
import { handlers } from "@/auth";
export const { GET, POST } = handlers;
```

- [ ] **Step 4: Write `lib/auth-helpers.ts`**

```typescript
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return db.user.findUnique({ where: { id: session.user.id } });
}
```

- [ ] **Step 5: Write test `lib/__tests__/auth-helpers.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { user: { findUnique: vi.fn() } } }));

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";

describe("getCurrentUser", () => {
  beforeEach(() => vi.clearAllMocks());
  it("returns null when no session", async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    expect(await getCurrentUser()).toBeNull();
  });
  it("returns user when session exists", async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: "u1" } });
    (db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "u1", plan: "FREE" });
    expect((await getCurrentUser())?.id).toBe("u1");
  });
});
```

- [ ] **Step 6: Run test to verify pass**

Run: `pnpm test lib/__tests__/auth-helpers.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: configure NextAuth v5 with Prisma adapter"
```

### Task 2.2: Login page and route protection middleware

**Files:**
- Create: `app/login/page.tsx`, `middleware.ts`
- Test: `middleware.test.ts` is skipped (middleware tested via E2E in Phase 8).

**Interfaces:**
- Consumes: `signIn` from `auth.ts`, `auth` for the matcher guard.
- Produces: `/login` page with Google + email options; middleware redirecting unauthenticated `/app/*` requests to `/login`.

- [ ] **Step 1: Write `app/login/page.tsx`**

```tsx
import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <form action={async () => { "use server"; await signIn("google", { redirectTo: "/app" }); }}>
        <Button className="w-full" type="submit">Continue with Google</Button>
      </form>
      <form className="flex flex-col gap-2"
        action={async (fd: FormData) => { "use server"; await signIn("nodemailer", { email: String(fd.get("email")), redirectTo: "/app" }); }}>
        <Input name="email" type="email" placeholder="you@example.com" required />
        <Button className="w-full" variant="outline" type="submit">Email me a magic link</Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Write `middleware.ts`**

```typescript
import { auth } from "@/auth";

export default auth((req) => {
  const isApp = req.nextUrl.pathname.startsWith("/app");
  if (isApp && !req.auth) {
    const url = new URL("/login", req.nextUrl.origin);
    return Response.redirect(url);
  }
});

export const config = { matcher: ["/app/:path*"] };
```

- [ ] **Step 3: Manual verification**

Run: `pnpm dev`, visit `http://localhost:3000/app`
Expected: redirected to `/login`.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add login page and app route protection"
```

---

## Phase 3 — Link CRUD & Upstash Cache Sync

### Task 3.1: Upstash Redis client and link-cache module

**Files:**
- Create: `lib/redis.ts`, `lib/link-cache.ts`, `lib/__tests__/link-cache.test.ts`

**Interfaces:**
- Consumes: `LinkConfig` from `lib/resolve.ts`.
- Produces: `redis` (Upstash Redis client) from `lib/redis.ts`. From `lib/link-cache.ts`: `cacheKey(slug): string` (= `link:<slug>`), `putLinkCache(config: LinkConfig): Promise<void>`, `getLinkCache(slug: string): Promise<LinkConfig | null>`, `deleteLinkCache(slug: string): Promise<void>`.

- [ ] **Step 1: Install Upstash**

```bash
pnpm add @upstash/redis
```

- [ ] **Step 2: Write `lib/redis.ts`**

```typescript
import { Redis } from "@upstash/redis";
export const redis = Redis.fromEnv();
```

- [ ] **Step 3: Write the failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const store = new Map<string, unknown>();
vi.mock("@/lib/redis", () => ({
  redis: {
    set: vi.fn(async (k: string, v: unknown) => { store.set(k, v); }),
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    del: vi.fn(async (k: string) => { store.delete(k); }),
  },
}));

import { putLinkCache, getLinkCache, deleteLinkCache, cacheKey } from "@/lib/link-cache";
import type { LinkConfig } from "@/lib/resolve";

const cfg: LinkConfig = { slug: "abc", iosUrl: "https://a", androidUrl: null, ipadUrl: null,
  huaweiUrl: null, windowsUrl: null, macUrl: null, fallbackUrl: null, parameterForwarding: false };

describe("link-cache", () => {
  beforeEach(() => store.clear());
  it("builds namespaced key", () => { expect(cacheKey("abc")).toBe("link:abc"); });
  it("round-trips a config", async () => {
    await putLinkCache(cfg);
    expect(await getLinkCache("abc")).toEqual(cfg);
  });
  it("returns null for missing slug", async () => {
    expect(await getLinkCache("nope")).toBeNull();
  });
  it("deletes a config", async () => {
    await putLinkCache(cfg); await deleteLinkCache("abc");
    expect(await getLinkCache("abc")).toBeNull();
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm test lib/__tests__/link-cache.test.ts`
Expected: FAIL — cannot find module `@/lib/link-cache`.

- [ ] **Step 5: Write minimal implementation**

```typescript
import { redis } from "@/lib/redis";
import type { LinkConfig } from "@/lib/resolve";

export function cacheKey(slug: string): string { return `link:${slug}`; }

export async function putLinkCache(config: LinkConfig): Promise<void> {
  await redis.set(cacheKey(config.slug), config);
}

export async function getLinkCache(slug: string): Promise<LinkConfig | null> {
  return (await redis.get<LinkConfig>(cacheKey(slug))) ?? null;
}

export async function deleteLinkCache(slug: string): Promise<void> {
  await redis.del(cacheKey(slug));
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm test lib/__tests__/link-cache.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: add Upstash link config cache"
```

### Task 3.2: Link Zod schemas and CRUD Server Actions

**Files:**
- Create: `lib/validation/link.ts`, `app/app/links/actions.ts`, `lib/__tests__/link-actions.test.ts`

**Interfaces:**
- Consumes: `getCurrentUser` (auth-helpers), `db`, `PLAN_LIMITS`/`canCreateLink` (plans), `generateSlug`/`isValidCustomSlug` (slug), `putLinkCache`/`deleteLinkCache` (link-cache).
- Produces: Zod `linkInputSchema`; Server Actions `createLink(input)`, `updateLink(id, input)`, `deleteLink(id)`. Each returns `{ ok: true; slug?: string } | { ok: false; error: string }`. A shared `toLinkConfig(link): LinkConfig` maps a DB row to cache config.

- [ ] **Step 1: Write `lib/validation/link.ts`**

```typescript
import { z } from "zod";

const optionalUrl = z.string().url().optional().or(z.literal("").transform(() => undefined));

export const linkInputSchema = z.object({
  name: z.string().max(100).optional(),
  customSlug: z.string().optional(),
  iosUrl: optionalUrl, ipadUrl: optionalUrl, androidUrl: optionalUrl, huaweiUrl: optionalUrl,
  windowsUrl: optionalUrl, macUrl: optionalUrl, fallbackUrl: optionalUrl,
  parameterForwarding: z.boolean().default(false),
});

export type LinkInput = z.infer<typeof linkInputSchema>;
```

- [ ] **Step 2: Write the failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-helpers", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { link: { count: vi.fn(), create: vi.fn(), findFirst: vi.fn(),
  update: vi.fn(), delete: vi.fn() } } }));
vi.mock("@/lib/link-cache", () => ({ putLinkCache: vi.fn(), deleteLinkCache: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { createLink } from "@/app/app/links/actions";

const asMock = (f: unknown) => f as ReturnType<typeof vi.fn>;

describe("createLink", () => {
  beforeEach(() => vi.clearAllMocks());
  it("rejects when unauthenticated", async () => {
    asMock(getCurrentUser).mockResolvedValue(null);
    const r = await createLink({ parameterForwarding: false });
    expect(r).toEqual({ ok: false, error: "Unauthorized" });
  });
  it("blocks 4th link on free plan", async () => {
    asMock(getCurrentUser).mockResolvedValue({ id: "u1", plan: "FREE" });
    asMock(db.link.count).mockResolvedValue(3);
    const r = await createLink({ parameterForwarding: false });
    expect(r).toEqual({ ok: false, error: "Link limit reached for your plan" });
  });
  it("rejects custom slug on free plan", async () => {
    asMock(getCurrentUser).mockResolvedValue({ id: "u1", plan: "FREE" });
    asMock(db.link.count).mockResolvedValue(0);
    const r = await createLink({ customSlug: "my-app", parameterForwarding: false });
    expect(r).toEqual({ ok: false, error: "Custom slugs require Pro" });
  });
  it("creates link with random slug and caches it", async () => {
    asMock(getCurrentUser).mockResolvedValue({ id: "u1", plan: "FREE" });
    asMock(db.link.count).mockResolvedValue(0);
    asMock(db.link.findFirst).mockResolvedValue(null);
    asMock(db.link.create).mockImplementation(async ({ data }: { data: { slug: string } }) =>
      ({ id: "l1", parameterForwarding: false, ...data }));
    const r = await createLink({ iosUrl: "https://apps.apple.com/x", parameterForwarding: false });
    expect(r.ok).toBe(true);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test lib/__tests__/link-actions.test.ts`
Expected: FAIL — cannot find module `@/app/app/links/actions`.

- [ ] **Step 4: Write minimal implementation `app/app/links/actions.ts`**

```typescript
"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { canCreateLink, PLAN_LIMITS } from "@/lib/plans";
import { generateSlug, isValidCustomSlug } from "@/lib/slug";
import { putLinkCache, deleteLinkCache } from "@/lib/link-cache";
import { linkInputSchema, type LinkInput } from "@/lib/validation/link";
import type { LinkConfig } from "@/lib/resolve";

type Result = { ok: true; slug?: string } | { ok: false; error: string };

function toLinkConfig(link: {
  slug: string; iosUrl: string | null; ipadUrl: string | null; androidUrl: string | null;
  huaweiUrl: string | null; windowsUrl: string | null; macUrl: string | null;
  fallbackUrl: string | null; parameterForwarding: boolean;
}): LinkConfig {
  return { slug: link.slug, iosUrl: link.iosUrl, ipadUrl: link.ipadUrl, androidUrl: link.androidUrl,
    huaweiUrl: link.huaweiUrl, windowsUrl: link.windowsUrl, macUrl: link.macUrl,
    fallbackUrl: link.fallbackUrl, parameterForwarding: link.parameterForwarding };
}

async function uniqueSlug(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const s = generateSlug();
    if (!(await db.link.findFirst({ where: { slug: s } }))) return s;
  }
  return generateSlug(8);
}

export async function createLink(input: LinkInput): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Unauthorized" };
  const parsed = linkInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const data = parsed.data;

  const count = await db.link.count({ where: { userId: user.id } });
  if (!canCreateLink(user.plan, count)) return { ok: false, error: "Link limit reached for your plan" };

  let slug: string;
  if (data.customSlug) {
    if (!PLAN_LIMITS[user.plan].customSlug) return { ok: false, error: "Custom slugs require Pro" };
    if (!isValidCustomSlug(data.customSlug)) return { ok: false, error: "Invalid slug format" };
    if (await db.link.findFirst({ where: { slug: data.customSlug } }))
      return { ok: false, error: "Slug already taken" };
    slug = data.customSlug;
  } else {
    slug = await uniqueSlug();
  }

  if (!PLAN_LIMITS[user.plan].desktopLinks) { data.windowsUrl = undefined; data.macUrl = undefined; }
  if (!PLAN_LIMITS[user.plan].parameterForwarding) data.parameterForwarding = false;

  const link = await db.link.create({ data: {
    userId: user.id, slug, name: data.name, iosUrl: data.iosUrl, ipadUrl: data.ipadUrl,
    androidUrl: data.androidUrl, huaweiUrl: data.huaweiUrl, windowsUrl: data.windowsUrl,
    macUrl: data.macUrl, fallbackUrl: data.fallbackUrl, parameterForwarding: data.parameterForwarding,
  }});
  await putLinkCache(toLinkConfig(link));
  revalidatePath("/app/links");
  return { ok: true, slug };
}

export async function updateLink(id: string, input: LinkInput): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Unauthorized" };
  const existing = await db.link.findFirst({ where: { id, userId: user.id } });
  if (!existing) return { ok: false, error: "Not found" };
  const parsed = linkInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const data = parsed.data;
  if (!PLAN_LIMITS[user.plan].desktopLinks) { data.windowsUrl = undefined; data.macUrl = undefined; }
  if (!PLAN_LIMITS[user.plan].parameterForwarding) data.parameterForwarding = false;

  const link = await db.link.update({ where: { id }, data: {
    name: data.name, iosUrl: data.iosUrl, ipadUrl: data.ipadUrl, androidUrl: data.androidUrl,
    huaweiUrl: data.huaweiUrl, windowsUrl: data.windowsUrl, macUrl: data.macUrl,
    fallbackUrl: data.fallbackUrl, parameterForwarding: data.parameterForwarding,
  }});
  await putLinkCache(toLinkConfig(link));
  revalidatePath("/app/links");
  return { ok: true, slug: link.slug };
}

export async function deleteLink(id: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Unauthorized" };
  const existing = await db.link.findFirst({ where: { id, userId: user.id } });
  if (!existing) return { ok: false, error: "Not found" };
  await db.link.delete({ where: { id } });
  await deleteLinkCache(existing.slug);
  revalidatePath("/app/links");
  return { ok: true };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test lib/__tests__/link-actions.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: add link CRUD server actions with plan gating and cache sync"
```

### Task 3.3: Links dashboard UI

**Files:**
- Create: `app/app/layout.tsx`, `app/app/links/page.tsx`, `app/app/links/link-form.tsx`, `app/app/links/link-list.tsx`

**Interfaces:**
- Consumes: `getCurrentUser`, `db`, the Server Actions from Task 3.2, `PLAN_LIMITS`.
- Produces: `/app/links` page listing the user's links with a create/edit dialog form and delete button; form hides Pro-only fields (custom slug, desktop URLs, parameter forwarding) for Free users.

- [ ] **Step 1: Write `app/app/layout.tsx`**

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <div className="mx-auto max-w-5xl p-6">
      <nav className="mb-6 flex gap-4 border-b pb-3 text-sm">
        <Link href="/app/links">Links</Link>
        <Link href="/app/billing">Billing</Link>
        <span className="ml-auto text-muted-foreground">{user.email} · {user.plan}</span>
      </nav>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Write `app/app/links/link-list.tsx`** (client component with delete + copy)

```tsx
"use client";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteLink } from "./actions";

type Row = { id: string; slug: string; name: string | null };

export function LinkList({ links, appUrl }: { links: Row[]; appUrl: string }) {
  const [pending, start] = useTransition();
  return (
    <ul className="divide-y">
      {links.map((l) => (
        <li key={l.id} className="flex items-center gap-3 py-3">
          <div className="flex-1">
            <div className="font-medium">{l.name ?? l.slug}</div>
            <a className="text-sm text-blue-600" href={`${appUrl}/r/${l.slug}`}>{appUrl}/r/{l.slug}</a>
          </div>
          <Button variant="outline" size="sm"
            onClick={() => navigator.clipboard.writeText(`${appUrl}/r/${l.slug}`)}>Copy</Button>
          <Button variant="destructive" size="sm" disabled={pending}
            onClick={() => start(() => { void deleteLink(l.id); })}>Delete</Button>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 3: Write `app/app/links/link-form.tsx`** (client form calling createLink/updateLink)

```tsx
"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { createLink } from "./actions";

export function LinkForm({ isPro }: { isPro: boolean }) {
  const [pending, start] = useTransition();
  const [form, setForm] = useState({ name: "", iosUrl: "", androidUrl: "", fallbackUrl: "", customSlug: "" });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });
  return (
    <form className="grid gap-3"
      action={() => start(async () => {
        const r = await createLink({
          name: form.name || undefined, iosUrl: form.iosUrl || undefined,
          androidUrl: form.androidUrl || undefined, fallbackUrl: form.fallbackUrl || undefined,
          customSlug: isPro && form.customSlug ? form.customSlug : undefined, parameterForwarding: false,
        });
        if (r.ok) toast.success("Link created"); else toast.error(r.error);
      })}>
      <Input placeholder="Name (internal)" value={form.name} onChange={set("name")} />
      {isPro && <Input placeholder="Custom slug" value={form.customSlug} onChange={set("customSlug")} />}
      <Input placeholder="iOS App Store URL" value={form.iosUrl} onChange={set("iosUrl")} />
      <Input placeholder="Google Play URL" value={form.androidUrl} onChange={set("androidUrl")} />
      <Input placeholder="Fallback URL" value={form.fallbackUrl} onChange={set("fallbackUrl")} />
      <Button type="submit" disabled={pending}>Create link</Button>
    </form>
  );
}
```

- [ ] **Step 4: Write `app/app/links/page.tsx`**

```tsx
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { LinkForm } from "./link-form";
import { LinkList } from "./link-list";

export default async function LinksPage() {
  const user = await getCurrentUser();
  const links = await db.link.findMany({ where: { userId: user!.id }, orderBy: { createdAt: "desc" } });
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  return (
    <div className="grid gap-8">
      <section><h1 className="mb-4 text-xl font-semibold">Create a Onelink</h1>
        <LinkForm isPro={user!.plan === "PRO"} /></section>
      <section><h2 className="mb-2 text-lg font-medium">Your Onelinks</h2>
        <LinkList links={links} appUrl={appUrl} /></section>
    </div>
  );
}
```

- [ ] **Step 5: Manual verification**

Run: `pnpm dev`, sign in, create a link on `/app/links`.
Expected: link appears in the list; copy button copies the `/r/<slug>` URL.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: add links dashboard UI"
```

---

## Phase 4 — Edge Redirect

### Task 4.1: Analytics event enqueue helper (edge-safe)

**Files:**
- Create: `lib/analytics-queue.ts`, `lib/__tests__/analytics-queue.test.ts`

**Interfaces:**
- Consumes: `redis` from `lib/redis.ts`.
- Produces: type `AnalyticsPayload` = `{ linkId: string; deviceType: DeviceType; os: string; country: string | null; referrer: string | null; utmSource: string | null; utmMedium: string | null; utmCampaign: string | null; redirectedTo: RedirectTarget; timestamp: string }`. `ANALYTICS_QUEUE_KEY = "analytics:queue"`. `enqueueEvent(payload): Promise<void>` (rpush JSON). `drainEvents(max): Promise<AnalyticsPayload[]>` (lpop up to max, parse).

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const list: string[] = [];
vi.mock("@/lib/redis", () => ({
  redis: {
    rpush: vi.fn(async (_k: string, v: string) => { list.push(v); }),
    lpop: vi.fn(async (_k: string, n: number) => list.splice(0, n)),
  },
}));

import { enqueueEvent, drainEvents, type AnalyticsPayload } from "@/lib/analytics-queue";

const evt: AnalyticsPayload = { linkId: "l1", deviceType: "IOS", os: "iOS", country: "US",
  referrer: null, utmSource: null, utmMedium: null, utmCampaign: null, redirectedTo: "MATCHED",
  timestamp: "2026-07-02T00:00:00.000Z" };

describe("analytics-queue", () => {
  beforeEach(() => { list.length = 0; });
  it("enqueues and drains events", async () => {
    await enqueueEvent(evt);
    const drained = await drainEvents(10);
    expect(drained).toHaveLength(1);
    expect(drained[0].linkId).toBe("l1");
  });
  it("drains nothing when empty", async () => {
    expect(await drainEvents(10)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test lib/__tests__/analytics-queue.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write minimal implementation**

```typescript
import type { DeviceType, RedirectTarget } from "@prisma/client";
import { redis } from "@/lib/redis";

export const ANALYTICS_QUEUE_KEY = "analytics:queue";

export type AnalyticsPayload = {
  linkId: string; deviceType: DeviceType; os: string; country: string | null;
  referrer: string | null; utmSource: string | null; utmMedium: string | null;
  utmCampaign: string | null; redirectedTo: RedirectTarget; timestamp: string;
};

export async function enqueueEvent(payload: AnalyticsPayload): Promise<void> {
  await redis.rpush(ANALYTICS_QUEUE_KEY, JSON.stringify(payload));
}

export async function drainEvents(max: number): Promise<AnalyticsPayload[]> {
  const raw = (await redis.lpop(ANALYTICS_QUEUE_KEY, max)) as string[] | null;
  if (!raw || raw.length === 0) return [];
  return raw.map((r) => (typeof r === "string" ? JSON.parse(r) : r) as AnalyticsPayload);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test lib/__tests__/analytics-queue.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add edge-safe analytics event queue"
```

### Task 4.2: UTM parsing helper

**Files:**
- Create: `lib/utm.ts`, `lib/__tests__/utm.test.ts`

**Interfaces:**
- Produces: `parseUtm(searchParams: URLSearchParams): { utmSource: string | null; utmMedium: string | null; utmCampaign: string | null }`.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { parseUtm } from "@/lib/utm";

describe("parseUtm", () => {
  it("extracts utm params", () => {
    const r = parseUtm(new URLSearchParams("utm_source=fb&utm_medium=cpc&utm_campaign=launch"));
    expect(r).toEqual({ utmSource: "fb", utmMedium: "cpc", utmCampaign: "launch" });
  });
  it("returns nulls when absent", () => {
    expect(parseUtm(new URLSearchParams(""))).toEqual({ utmSource: null, utmMedium: null, utmCampaign: null });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test lib/__tests__/utm.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write minimal implementation**

```typescript
export function parseUtm(sp: URLSearchParams) {
  return {
    utmSource: sp.get("utm_source"),
    utmMedium: sp.get("utm_medium"),
    utmCampaign: sp.get("utm_campaign"),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test lib/__tests__/utm.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add UTM parsing helper"
```

### Task 4.3: Edge redirect route

**Files:**
- Create: `app/r/[slug]/route.ts`, `app/r/[slug]/landing/landing.tsx` (minimal landing rendered inline)

**Interfaces:**
- Consumes: `getLinkCache` (link-cache), `detectDevice` (device), `resolveDestination` (resolve), `parseUtm` (utm), `enqueueEvent` (analytics-queue). Note: link-cache and analytics-queue both import only the Upstash REST client — edge-safe.
- Produces: `GET` handler at `/r/[slug]` running on Edge; `export const runtime = "edge"`.

- [ ] **Step 1: Write `app/r/[slug]/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getLinkCache } from "@/lib/link-cache";
import { detectDevice } from "@/lib/device";
import { resolveDestination } from "@/lib/resolve";
import { parseUtm } from "@/lib/utm";
import { enqueueEvent } from "@/lib/analytics-queue";

export const runtime = "edge";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const config = await getLinkCache(slug);
  if (!config) return new NextResponse("Link not found", { status: 404 });

  const ua = req.headers.get("user-agent") ?? "";
  const { device, os } = detectDevice(ua);
  const query = req.nextUrl.search.replace(/^\?/, "");
  const { url, target } = resolveDestination({ ...config, slug }, device, query);

  const utm = parseUtm(req.nextUrl.searchParams);
  // Fire-and-forget: never block the redirect on analytics.
  void enqueueEvent({
    linkId: slug, deviceType: device, os, country: req.geo?.country ?? null,
    referrer: req.headers.get("referer"), ...utm, redirectedTo: target,
    timestamp: new Date().toISOString(),
  });

  if (url) return NextResponse.redirect(url, 302);
  return new NextResponse(`This link has no destination configured.`, {
    status: 200, headers: { "content-type": "text/html" },
  });
}
```

> Note: `linkId` here is the slug. The flush job (Task 5.1) resolves slug→link id before insert, since the Edge cache is keyed by slug. This keeps the Edge path free of DB lookups.

- [ ] **Step 2: Manual verification**

Run: `pnpm dev`, create a link with an iOS URL, then:
`curl -A "iPhone" -i http://localhost:3000/r/<slug>`
Expected: `HTTP/1.1 302` with `location:` set to the iOS URL.

- [ ] **Step 3: Verify unknown slug 404s**

Run: `curl -i http://localhost:3000/r/doesnotexist`
Expected: `HTTP/1.1 404`.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add edge redirect route with device detection and analytics enqueue"
```

---

## Phase 5 — Analytics Flush & Dashboard

### Task 5.1: Analytics flush cron endpoint

**Files:**
- Create: `app/api/cron/flush-analytics/route.ts`, `vercel.json`, `lib/__tests__/flush.test.ts`
- Create: `lib/flush.ts` (testable core, imported by the route)

**Interfaces:**
- Consumes: `drainEvents` (analytics-queue), `db`.
- Produces: `flushAnalytics(batchMax: number): Promise<{ inserted: number }>` in `lib/flush.ts`. Resolves each event's `linkId` (currently a slug) to the DB link id; drops events whose slug no longer exists. Route guards on `Authorization: Bearer <CRON_SECRET>`.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/analytics-queue", () => ({ drainEvents: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: {
  link: { findMany: vi.fn() }, analyticsEvent: { createMany: vi.fn() } } }));

import { drainEvents } from "@/lib/analytics-queue";
import { db } from "@/lib/db";
import { flushAnalytics } from "@/lib/flush";

const asMock = (f: unknown) => f as ReturnType<typeof vi.fn>;

describe("flushAnalytics", () => {
  beforeEach(() => vi.clearAllMocks());
  it("maps slug to link id and inserts", async () => {
    asMock(drainEvents).mockResolvedValue([
      { linkId: "abc", deviceType: "IOS", os: "iOS", country: "US", referrer: null,
        utmSource: null, utmMedium: null, utmCampaign: null, redirectedTo: "MATCHED",
        timestamp: "2026-07-02T00:00:00.000Z" },
    ]);
    asMock(db.link.findMany).mockResolvedValue([{ id: "link1", slug: "abc" }]);
    asMock(db.analyticsEvent.createMany).mockResolvedValue({ count: 1 });
    const r = await flushAnalytics(100);
    expect(r.inserted).toBe(1);
    expect(asMock(db.analyticsEvent.createMany).mock.calls[0][0].data[0].linkId).toBe("link1");
  });
  it("drops events for missing slugs", async () => {
    asMock(drainEvents).mockResolvedValue([
      { linkId: "gone", deviceType: "IOS", os: "iOS", country: null, referrer: null,
        utmSource: null, utmMedium: null, utmCampaign: null, redirectedTo: "MATCHED",
        timestamp: "2026-07-02T00:00:00.000Z" },
    ]);
    asMock(db.link.findMany).mockResolvedValue([]);
    const r = await flushAnalytics(100);
    expect(r.inserted).toBe(0);
  });
  it("returns zero when queue empty", async () => {
    asMock(drainEvents).mockResolvedValue([]);
    expect((await flushAnalytics(100)).inserted).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test lib/__tests__/flush.test.ts`
Expected: FAIL — cannot find module `@/lib/flush`.

- [ ] **Step 3: Write minimal implementation `lib/flush.ts`**

```typescript
import { drainEvents } from "@/lib/analytics-queue";
import { db } from "@/lib/db";

export async function flushAnalytics(batchMax: number): Promise<{ inserted: number }> {
  const events = await drainEvents(batchMax);
  if (events.length === 0) return { inserted: 0 };

  const slugs = [...new Set(events.map((e) => e.linkId))];
  const links = await db.link.findMany({ where: { slug: { in: slugs } }, select: { id: true, slug: true } });
  const bySlug = new Map(links.map((l) => [l.slug, l.id]));

  const rows = events
    .filter((e) => bySlug.has(e.linkId))
    .map((e) => ({
      linkId: bySlug.get(e.linkId)!, deviceType: e.deviceType, os: e.os, country: e.country,
      referrer: e.referrer, utmSource: e.utmSource, utmMedium: e.utmMedium,
      utmCampaign: e.utmCampaign, redirectedTo: e.redirectedTo, timestamp: new Date(e.timestamp),
    }));
  if (rows.length === 0) return { inserted: 0 };

  await db.analyticsEvent.createMany({ data: rows });
  return { inserted: rows.length };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test lib/__tests__/flush.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write route `app/api/cron/flush-analytics/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { flushAnalytics } from "@/lib/flush";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`)
    return new NextResponse("Unauthorized", { status: 401 });
  const result = await flushAnalytics(1000);
  return NextResponse.json(result);
}
```

- [ ] **Step 6: Write `vercel.json`**

```json
{ "crons": [ { "path": "/api/cron/flush-analytics", "schedule": "*/5 * * * *" } ] }
```

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: add analytics flush cron job"
```

### Task 5.2: Analytics aggregation queries

**Files:**
- Create: `lib/analytics.ts`, `lib/__tests__/analytics.test.ts`

**Interfaces:**
- Consumes: `db`.
- Produces: `getLinkStats(linkId: string, from: Date, to: Date): Promise<{ total: number; byDevice: Record<string, number>; byCountry: Record<string, number>; byReferrer: Record<string, number>; byTarget: Record<string, number> }>`. Uses `db.analyticsEvent.groupBy`.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({ db: {
  analyticsEvent: { count: vi.fn(), groupBy: vi.fn() } } }));

import { db } from "@/lib/db";
import { getLinkStats } from "@/lib/analytics";

const asMock = (f: unknown) => f as ReturnType<typeof vi.fn>;

describe("getLinkStats", () => {
  beforeEach(() => vi.clearAllMocks());
  it("aggregates counts by dimension", async () => {
    asMock(db.analyticsEvent.count).mockResolvedValue(5);
    asMock(db.analyticsEvent.groupBy).mockImplementation(async ({ by }: { by: string[] }) => {
      if (by[0] === "deviceType") return [{ deviceType: "IOS", _count: { _all: 3 } }, { deviceType: "ANDROID", _count: { _all: 2 } }];
      if (by[0] === "country") return [{ country: "US", _count: { _all: 5 } }];
      if (by[0] === "referrer") return [{ referrer: null, _count: { _all: 5 } }];
      return [{ redirectedTo: "MATCHED", _count: { _all: 5 } }];
    });
    const r = await getLinkStats("l1", new Date("2026-06-01"), new Date("2026-07-01"));
    expect(r.total).toBe(5);
    expect(r.byDevice.IOS).toBe(3);
    expect(r.byCountry.US).toBe(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test lib/__tests__/analytics.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write minimal implementation**

```typescript
import { db } from "@/lib/db";

type Counts = Record<string, number>;

async function group(linkId: string, from: Date, to: Date, field: "deviceType" | "country" | "referrer" | "redirectedTo"): Promise<Counts> {
  const rows = await db.analyticsEvent.groupBy({
    by: [field] as never,
    where: { linkId, timestamp: { gte: from, lte: to } },
    _count: { _all: true },
  }) as Array<Record<string, unknown> & { _count: { _all: number } }>;
  const out: Counts = {};
  for (const row of rows) out[String(row[field] ?? "unknown")] = row._count._all;
  return out;
}

export async function getLinkStats(linkId: string, from: Date, to: Date) {
  const total = await db.analyticsEvent.count({ where: { linkId, timestamp: { gte: from, lte: to } } });
  const [byDevice, byCountry, byReferrer, byTarget] = await Promise.all([
    group(linkId, from, to, "deviceType"),
    group(linkId, from, to, "country"),
    group(linkId, from, to, "referrer"),
    group(linkId, from, to, "redirectedTo"),
  ]);
  return { total, byDevice, byCountry, byReferrer, byTarget };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test lib/__tests__/analytics.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add analytics aggregation queries"
```

### Task 5.3: Analytics dashboard page (plan-gated)

**Files:**
- Create: `app/app/links/[id]/stats/page.tsx`

**Interfaces:**
- Consumes: `getCurrentUser`, `db`, `getLinkStats` (analytics), `PLAN_LIMITS`.
- Produces: `/app/links/[id]/stats` page. Free users see only `total` + `byDevice`; Pro users additionally see country/referrer/target breakdowns. A default 30-day window.

- [ ] **Step 1: Write `app/app/links/[id]/stats/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { getLinkStats } from "@/lib/analytics";
import { PLAN_LIMITS } from "@/lib/plans";

function Table({ title, data }: { title: string; data: Record<string, number> }) {
  return (
    <div className="rounded border p-4">
      <h3 className="mb-2 font-medium">{title}</h3>
      <ul className="text-sm">
        {Object.entries(data).map(([k, v]) => (
          <li key={k} className="flex justify-between"><span>{k}</span><span>{v}</span></li>
        ))}
      </ul>
    </div>
  );
}

export default async function StatsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const link = await db.link.findFirst({ where: { id, userId: user!.id } });
  if (!link) notFound();
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  const stats = await getLinkStats(id, from, to);
  const full = PLAN_LIMITS[user!.plan].fullAnalytics;
  return (
    <div className="grid gap-4">
      <h1 className="text-xl font-semibold">Stats · {link.name ?? link.slug}</h1>
      <div className="text-3xl font-bold">{stats.total} <span className="text-base font-normal text-muted-foreground">total requests (30d)</span></div>
      <div className="grid gap-4 md:grid-cols-2">
        <Table title="Devices" data={stats.byDevice} />
        {full && <Table title="Countries" data={stats.byCountry} />}
        {full && <Table title="Referrers" data={stats.byReferrer} />}
        {full && <Table title="Redirect target" data={stats.byTarget} />}
      </div>
      {!full && <p className="text-sm text-muted-foreground">Upgrade to Pro for country, referrer, and UTM stats.</p>}
    </div>
  );
}
```

- [ ] **Step 2: Manual verification**

Run: `pnpm dev`, open a link's stats page after generating some redirects and running the flush endpoint manually with the `CRON_SECRET` bearer.
Expected: device counts render; Free account hides country/referrer tables.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add plan-gated analytics dashboard page"
```

---

## Phase 6 — QR Code Studio

### Task 6.1: QR config Zod schema and Server Action

**Files:**
- Create: `lib/validation/qr.ts`, `app/app/links/[id]/qr/actions.ts`, `lib/__tests__/qr-actions.test.ts`

**Interfaces:**
- Consumes: `getCurrentUser`, `db`, `PLAN_LIMITS`.
- Produces: Zod `qrConfigSchema` (fgColor/bgColor hex, dotStyle enum `square|rounded|dots`, cornerStyle enum `square|rounded`, margin int, size int, optional gradient, optional logoUrl). Server Action `saveQrConfig(linkId, input)` returning `{ ok: true } | { ok: false; error: string }`; strips `logoUrl`+`gradient` for Free plans.

- [ ] **Step 1: Write `lib/validation/qr.ts`**

```typescript
import { z } from "zod";
const hex = z.string().regex(/^#([0-9a-fA-F]{6})$/);
export const qrConfigSchema = z.object({
  fgColor: hex.default("#000000"),
  bgColor: hex.default("#ffffff"),
  dotStyle: z.enum(["square", "rounded", "dots"]).default("square"),
  cornerStyle: z.enum(["square", "rounded"]).default("square"),
  margin: z.number().int().min(0).max(50).default(10),
  size: z.number().int().min(100).max(1000).default(300),
  gradient: z.object({ from: hex, to: hex, type: z.enum(["linear", "radial"]) }).nullable().default(null),
  logoUrl: z.string().url().nullable().default(null),
});
export type QrConfigInput = z.infer<typeof qrConfigSchema>;
```

- [ ] **Step 2: Write the failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-helpers", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { link: { findFirst: vi.fn() }, qrConfig: { upsert: vi.fn() } } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { saveQrConfig } from "@/app/app/links/[id]/qr/actions";

const asMock = (f: unknown) => f as ReturnType<typeof vi.fn>;
const baseInput = { fgColor: "#000000", bgColor: "#ffffff", dotStyle: "square" as const,
  cornerStyle: "square" as const, margin: 10, size: 300, gradient: null, logoUrl: "https://blob/logo.png" };

describe("saveQrConfig", () => {
  beforeEach(() => vi.clearAllMocks());
  it("strips logo for free plan", async () => {
    asMock(getCurrentUser).mockResolvedValue({ id: "u1", plan: "FREE" });
    asMock(db.link.findFirst).mockResolvedValue({ id: "l1" });
    asMock(db.qrConfig.upsert).mockResolvedValue({});
    const r = await saveQrConfig("l1", baseInput);
    expect(r.ok).toBe(true);
    const arg = asMock(db.qrConfig.upsert).mock.calls[0][0];
    expect(arg.create.logoUrl).toBeNull();
  });
  it("keeps logo for pro plan", async () => {
    asMock(getCurrentUser).mockResolvedValue({ id: "u1", plan: "PRO" });
    asMock(db.link.findFirst).mockResolvedValue({ id: "l1" });
    asMock(db.qrConfig.upsert).mockResolvedValue({});
    await saveQrConfig("l1", baseInput);
    const arg = asMock(db.qrConfig.upsert).mock.calls[0][0];
    expect(arg.create.logoUrl).toBe("https://blob/logo.png");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test lib/__tests__/qr-actions.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 4: Write minimal implementation `app/app/links/[id]/qr/actions.ts`**

```typescript
"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { PLAN_LIMITS } from "@/lib/plans";
import { qrConfigSchema, type QrConfigInput } from "@/lib/validation/qr";

type Result = { ok: true } | { ok: false; error: string };

export async function saveQrConfig(linkId: string, input: QrConfigInput): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Unauthorized" };
  const link = await db.link.findFirst({ where: { id: linkId, userId: user.id } });
  if (!link) return { ok: false, error: "Not found" };
  const parsed = qrConfigSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid QR config" };
  const data = parsed.data;
  if (!PLAN_LIMITS[user.plan].qrLogo) data.logoUrl = null;
  if (!PLAN_LIMITS[user.plan].qrGradient) data.gradient = null;

  await db.qrConfig.upsert({
    where: { linkId },
    create: { linkId, ...data },
    update: { ...data },
  });
  revalidatePath(`/app/links/${linkId}/qr`);
  return { ok: true };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test lib/__tests__/qr-actions.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: add QR config server action with plan gating"
```

### Task 6.2: Logo upload via Vercel Blob

**Files:**
- Create: `app/api/upload-logo/route.ts`

**Interfaces:**
- Consumes: `getCurrentUser`, `PLAN_LIMITS`, `@vercel/blob`.
- Produces: `POST /api/upload-logo` accepting `multipart/form-data` field `file`, returning `{ url }`. Rejects non-Pro users (403) and non-image / >1MB files (400).

- [ ] **Step 1: Install Vercel Blob**

```bash
pnpm add @vercel/blob
```

- [ ] **Step 2: Write `app/api/upload-logo/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getCurrentUser } from "@/lib/auth-helpers";
import { PLAN_LIMITS } from "@/lib/plans";

const MAX = 1024 * 1024;

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!PLAN_LIMITS[user.plan].qrLogo) return NextResponse.json({ error: "Pro required" }, { status: 403 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "Must be an image" }, { status: 400 });
  if (file.size > MAX) return NextResponse.json({ error: "Max 1MB" }, { status: 400 });

  const blob = await put(`qr-logos/${user.id}/${Date.now()}-${file.name}`, file, { access: "public" });
  return NextResponse.json({ url: blob.url });
}
```

- [ ] **Step 3: Manual verification**

Run: `pnpm dev`, `curl -F file=@logo.png http://localhost:3000/api/upload-logo` while signed in as Pro.
Expected: JSON `{ "url": "https://...blob..." }`.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add QR logo upload via Vercel Blob"
```

### Task 6.3: QR studio UI with live preview and export

**Files:**
- Create: `app/app/links/[id]/qr/page.tsx`, `app/app/links/[id]/qr/qr-studio.tsx`, `lib/qr-options.ts`, `lib/__tests__/qr-options.test.ts`

**Interfaces:**
- Consumes: `db`, `getCurrentUser`, `saveQrConfig`, the `QrConfigInput` type, `qr-code-styling`.
- Produces: `lib/qr-options.ts` exporting `buildQrOptions(data: string, cfg: QrConfigInput): Options` mapping our config to `qr-code-styling` `Options`. `qr-studio.tsx` client component rendering live preview, controls, PNG(S/L)+SVG export, and logo upload (Pro).

- [ ] **Step 1: Install qr-code-styling**

```bash
pnpm add qr-code-styling
```

- [ ] **Step 2: Write the failing test `lib/__tests__/qr-options.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { buildQrOptions } from "@/lib/qr-options";

describe("buildQrOptions", () => {
  it("maps colors and dot style", () => {
    const o = buildQrOptions("https://x", { fgColor: "#111111", bgColor: "#eeeeee",
      dotStyle: "rounded", cornerStyle: "square", margin: 8, size: 320, gradient: null, logoUrl: null });
    expect(o.data).toBe("https://x");
    expect(o.width).toBe(320);
    expect(o.dotsOptions?.color).toBe("#111111");
    expect(o.dotsOptions?.type).toBe("rounded");
    expect(o.backgroundOptions?.color).toBe("#eeeeee");
  });
  it("includes image when logoUrl present", () => {
    const o = buildQrOptions("https://x", { fgColor: "#000000", bgColor: "#ffffff",
      dotStyle: "square", cornerStyle: "square", margin: 10, size: 300, gradient: null, logoUrl: "https://blob/l.png" });
    expect(o.image).toBe("https://blob/l.png");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test lib/__tests__/qr-options.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 4: Write minimal implementation `lib/qr-options.ts`**

```typescript
import type { Options } from "qr-code-styling";
import type { QrConfigInput } from "@/lib/validation/qr";

export function buildQrOptions(data: string, cfg: QrConfigInput): Options {
  const dotColor = cfg.gradient
    ? undefined
    : cfg.fgColor;
  return {
    type: "svg",
    data,
    width: cfg.size,
    height: cfg.size,
    margin: cfg.margin,
    image: cfg.logoUrl ?? undefined,
    dotsOptions: {
      color: dotColor,
      type: cfg.dotStyle,
      gradient: cfg.gradient
        ? { type: cfg.gradient.type, colorStops: [{ offset: 0, color: cfg.gradient.from }, { offset: 1, color: cfg.gradient.to }] }
        : undefined,
    },
    cornersSquareOptions: { type: cfg.cornerStyle === "rounded" ? "extra-rounded" : "square" },
    backgroundOptions: { color: cfg.bgColor },
    imageOptions: { crossOrigin: "anonymous", margin: 4 },
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test lib/__tests__/qr-options.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Write `app/app/links/[id]/qr/qr-studio.tsx`**

```tsx
"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { buildQrOptions } from "@/lib/qr-options";
import type { QrConfigInput } from "@/lib/validation/qr";
import { saveQrConfig } from "./actions";

export function QrStudio({ linkId, url, initial, isPro }: {
  linkId: string; url: string; initial: QrConfigInput; isPro: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const qrRef = useRef<import("qr-code-styling").default | null>(null);
  const [cfg, setCfg] = useState<QrConfigInput>(initial);
  const [pending, start] = useTransition();

  useEffect(() => {
    let active = true;
    import("qr-code-styling").then(({ default: QRCodeStyling }) => {
      if (!active || !ref.current) return;
      qrRef.current = new QRCodeStyling(buildQrOptions(url, cfg));
      ref.current.innerHTML = "";
      qrRef.current.append(ref.current);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => { qrRef.current?.update(buildQrOptions(url, cfg)); }, [cfg, url]);

  const download = (ext: "png" | "svg", size?: number) => {
    if (size) qrRef.current?.update({ ...buildQrOptions(url, cfg), width: size, height: size });
    qrRef.current?.download({ name: "qr", extension: ext });
    if (size) qrRef.current?.update(buildQrOptions(url, cfg));
  };

  const uploadLogo = async (file: File) => {
    const fd = new FormData(); fd.append("file", file);
    const res = await fetch("/api/upload-logo", { method: "POST", body: fd });
    const json = await res.json();
    if (res.ok) setCfg({ ...cfg, logoUrl: json.url }); else toast.error(json.error);
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div ref={ref} className="flex items-center justify-center rounded border p-4" />
      <div className="grid gap-3">
        <label className="text-sm">Foreground
          <Input type="color" value={cfg.fgColor} onChange={(e) => setCfg({ ...cfg, fgColor: e.target.value })} /></label>
        <label className="text-sm">Background
          <Input type="color" value={cfg.bgColor} onChange={(e) => setCfg({ ...cfg, bgColor: e.target.value })} /></label>
        <label className="text-sm">Dot style
          <select className="w-full rounded border p-2" value={cfg.dotStyle}
            onChange={(e) => setCfg({ ...cfg, dotStyle: e.target.value as QrConfigInput["dotStyle"] })}>
            <option value="square">Square</option><option value="rounded">Rounded</option><option value="dots">Dots</option>
          </select></label>
        {isPro && <label className="text-sm">Logo
          <Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} /></label>}
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => download("png", 300)}>PNG S</Button>
          <Button variant="outline" onClick={() => download("png", 1024)}>PNG L</Button>
          <Button variant="outline" onClick={() => download("svg")}>SVG</Button>
        </div>
        <Button disabled={pending}
          onClick={() => start(async () => {
            const r = await saveQrConfig(linkId, cfg);
            if (r.ok) toast.success("QR saved"); else toast.error(r.error);
          })}>Save</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Write `app/app/links/[id]/qr/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { qrConfigSchema } from "@/lib/validation/qr";
import { QrStudio } from "./qr-studio";

export default async function QrPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const link = await db.link.findFirst({ where: { id, userId: user!.id }, include: { qrConfig: true } });
  if (!link) notFound();
  const initial = qrConfigSchema.parse(link.qrConfig ?? {});
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/r/${link.slug}`;
  return (
    <div className="grid gap-4">
      <h1 className="text-xl font-semibold">QR Code · {link.name ?? link.slug}</h1>
      <QrStudio linkId={id} url={url} initial={initial} isPro={user!.plan === "PRO"} />
    </div>
  );
}
```

- [ ] **Step 8: Manual verification**

Run: `pnpm dev`, open `/app/links/<id>/qr`, change colors/dot style (preview updates live), download PNG/SVG, and (as Pro) upload a logo.
Expected: live preview reflects changes; downloads succeed; Save persists.

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat: add QR studio with live preview and export"
```

---

## Phase 7 — Stripe Billing

### Task 7.1: Stripe client and checkout Server Action

**Files:**
- Create: `lib/stripe.ts`, `app/app/billing/actions.ts`, `lib/__tests__/billing-actions.test.ts`

**Interfaces:**
- Consumes: `getCurrentUser`, `db`, `stripe` client.
- Produces: `stripe` from `lib/stripe.ts`. Server Actions `createCheckoutSession(): Promise<{ url: string } | { error: string }>` and `createPortalSession(): Promise<{ url: string } | { error: string }>`. Creates/reuses `stripeCustomerId` on the user.

- [ ] **Step 1: Install Stripe**

```bash
pnpm add stripe
```

- [ ] **Step 2: Write `lib/stripe.ts`**

```typescript
import Stripe from "stripe";
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2025-05-28.basil" });
```

- [ ] **Step 3: Write the failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-helpers", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { user: { update: vi.fn() } } }));
vi.mock("@/lib/stripe", () => ({ stripe: {
  customers: { create: vi.fn() },
  checkout: { sessions: { create: vi.fn() } },
} }));

import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { createCheckoutSession } from "@/app/app/billing/actions";

const asMock = (f: unknown) => f as ReturnType<typeof vi.fn>;

describe("createCheckoutSession", () => {
  beforeEach(() => vi.clearAllMocks());
  it("errors when unauthenticated", async () => {
    asMock(getCurrentUser).mockResolvedValue(null);
    expect(await createCheckoutSession()).toEqual({ error: "Unauthorized" });
  });
  it("creates a customer then a checkout url", async () => {
    asMock(getCurrentUser).mockResolvedValue({ id: "u1", email: "a@b.c", stripeCustomerId: null });
    asMock(stripe.customers.create).mockResolvedValue({ id: "cus_1" });
    asMock(db.user.update).mockResolvedValue({});
    asMock(stripe.checkout.sessions.create).mockResolvedValue({ url: "https://checkout" });
    expect(await createCheckoutSession()).toEqual({ url: "https://checkout" });
    expect(asMock(stripe.checkout.sessions.create).mock.calls[0][0].customer).toBe("cus_1");
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm test lib/__tests__/billing-actions.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 5: Write minimal implementation `app/app/billing/actions.ts`**

```typescript
"use server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";

const APP = process.env.NEXT_PUBLIC_APP_URL!;

async function ensureCustomer(user: { id: string; email: string; stripeCustomerId: string | null }): Promise<string> {
  if (user.stripeCustomerId) return user.stripeCustomerId;
  const customer = await stripe.customers.create({ email: user.email, metadata: { userId: user.id } });
  await db.user.update({ where: { id: user.id }, data: { stripeCustomerId: customer.id } });
  return customer.id;
}

export async function createCheckoutSession(): Promise<{ url: string } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };
  const customer = await ensureCustomer(user);
  const session = await stripe.checkout.sessions.create({
    customer, mode: "subscription",
    line_items: [{ price: process.env.STRIPE_PRO_PRICE_ID!, quantity: 1 }],
    success_url: `${APP}/app/billing?success=1`,
    cancel_url: `${APP}/app/billing?canceled=1`,
  });
  if (!session.url) return { error: "Could not create checkout session" };
  return { url: session.url };
}

export async function createPortalSession(): Promise<{ url: string } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };
  if (!user.stripeCustomerId) return { error: "No subscription" };
  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId, return_url: `${APP}/app/billing`,
  });
  return { url: session.url };
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm test lib/__tests__/billing-actions.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: add Stripe checkout and portal server actions"
```

### Task 7.2: Stripe webhook handler

**Files:**
- Create: `lib/webhook-handler.ts`, `app/api/webhooks/stripe/route.ts`, `lib/__tests__/webhook-handler.test.ts`

**Interfaces:**
- Consumes: `db`.
- Produces: `handleStripeEvent(event: Stripe.Event): Promise<void>` in `lib/webhook-handler.ts` — on `checkout.session.completed` and `customer.subscription.updated` sets user plan to PRO and upserts Subscription; on `customer.subscription.deleted` sets plan to FREE. Route verifies signature via `stripe.webhooks.constructEvent`, Node runtime, then delegates.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({ db: {
  user: { findFirst: vi.fn(), update: vi.fn() },
  subscription: { upsert: vi.fn() },
} }));

import { db } from "@/lib/db";
import { handleStripeEvent } from "@/lib/webhook-handler";

const asMock = (f: unknown) => f as ReturnType<typeof vi.fn>;

describe("handleStripeEvent", () => {
  beforeEach(() => vi.clearAllMocks());
  it("upgrades user to PRO on subscription updated", async () => {
    asMock(db.user.findFirst).mockResolvedValue({ id: "u1" });
    asMock(db.user.update).mockResolvedValue({});
    asMock(db.subscription.upsert).mockResolvedValue({});
    await handleStripeEvent({
      type: "customer.subscription.updated",
      data: { object: { id: "sub_1", customer: "cus_1", status: "active",
        current_period_end: 1893456000 } },
    } as never);
    expect(asMock(db.user.update).mock.calls[0][0].data.plan).toBe("PRO");
  });
  it("downgrades to FREE on subscription deleted", async () => {
    asMock(db.user.findFirst).mockResolvedValue({ id: "u1" });
    asMock(db.user.update).mockResolvedValue({});
    await handleStripeEvent({
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_1", customer: "cus_1", status: "canceled",
        current_period_end: 1893456000 } },
    } as never);
    expect(asMock(db.user.update).mock.calls[0][0].data.plan).toBe("FREE");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test lib/__tests__/webhook-handler.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write minimal implementation `lib/webhook-handler.ts`**

```typescript
import type Stripe from "stripe";
import { db } from "@/lib/db";

async function userByCustomer(customerId: string) {
  return db.user.findFirst({ where: { stripeCustomerId: customerId } });
}

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
    case "customer.subscription.updated": {
      const obj = event.data.object as { id: string; customer: string; status: string; current_period_end: number };
      const customerId = typeof obj.customer === "string" ? obj.customer : "";
      const user = await userByCustomer(customerId);
      if (!user) return;
      const periodEnd = new Date((obj.current_period_end ?? 0) * 1000);
      await db.user.update({ where: { id: user.id }, data: { plan: "PRO", planExpiresAt: periodEnd } });
      if (obj.id?.startsWith("sub_")) {
        await db.subscription.upsert({
          where: { userId: user.id },
          create: { userId: user.id, stripeSubscriptionId: obj.id, status: obj.status, currentPeriodEnd: periodEnd },
          update: { stripeSubscriptionId: obj.id, status: obj.status, currentPeriodEnd: periodEnd },
        });
      }
      break;
    }
    case "customer.subscription.deleted": {
      const obj = event.data.object as { customer: string };
      const customerId = typeof obj.customer === "string" ? obj.customer : "";
      const user = await userByCustomer(customerId);
      if (!user) return;
      await db.user.update({ where: { id: user.id }, data: { plan: "FREE", planExpiresAt: null } });
      break;
    }
    default: break;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test lib/__tests__/webhook-handler.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Write route `app/api/webhooks/stripe/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { handleStripeEvent } from "@/lib/webhook-handler";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new NextResponse("Missing signature", { status: 400 });
  const body = await req.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error("Webhook signature verification failed", err);
    return new NextResponse("Invalid signature", { status: 400 });
  }
  await handleStripeEvent(event);
  return NextResponse.json({ received: true });
}
```

- [ ] **Step 6: Manual verification**

Run: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`, then `stripe trigger checkout.session.completed`.
Expected: `200` response; user plan updates in DB (when customer matches).

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: add Stripe webhook handler"
```

### Task 7.3: Billing page UI

**Files:**
- Create: `app/app/billing/page.tsx`, `app/app/billing/billing-buttons.tsx`

**Interfaces:**
- Consumes: `getCurrentUser`, the billing Server Actions.
- Produces: `/app/billing` showing current plan; Free users get an "Upgrade to Pro" button (→ checkout URL); Pro users get a "Manage subscription" button (→ portal URL).

- [ ] **Step 1: Write `app/app/billing/billing-buttons.tsx`**

```tsx
"use client";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { createCheckoutSession, createPortalSession } from "./actions";

export function BillingButtons({ isPro }: { isPro: boolean }) {
  const [pending, start] = useTransition();
  const go = (fn: () => Promise<{ url: string } | { error: string }>) =>
    start(async () => { const r = await fn(); if ("url" in r) window.location.href = r.url; else toast.error(r.error); });
  return isPro
    ? <Button disabled={pending} onClick={() => go(createPortalSession)}>Manage subscription</Button>
    : <Button disabled={pending} onClick={() => go(createCheckoutSession)}>Upgrade to Pro — $10/mo</Button>;
}
```

- [ ] **Step 2: Write `app/app/billing/page.tsx`**

```tsx
import { getCurrentUser } from "@/lib/auth-helpers";
import { BillingButtons } from "./billing-buttons";

export default async function BillingPage() {
  const user = await getCurrentUser();
  const isPro = user!.plan === "PRO";
  return (
    <div className="grid gap-4">
      <h1 className="text-xl font-semibold">Billing</h1>
      <p>Current plan: <strong>{user!.plan}</strong></p>
      <BillingButtons isPro={isPro} />
    </div>
  );
}
```

- [ ] **Step 3: Manual verification**

Run: `pnpm dev`, open `/app/billing`, click Upgrade → redirected to Stripe Checkout (test mode).
Expected: Checkout page loads with $10/mo price.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add billing page UI"
```

---

## Phase 8 — Marketing Pages & E2E

### Task 8.1: Marketing pages

**Files:**
- Create: `app/(marketing)/layout.tsx`, `app/(marketing)/page.tsx`, `app/(marketing)/pricing/page.tsx`, `app/(marketing)/about/page.tsx`, `app/(marketing)/support/page.tsx`
- Modify: remove default `app/page.tsx` (replaced by marketing home)

**Interfaces:**
- Produces: public Home, Pricing (Free vs Pro table from `PLAN_LIMITS`), About, Support pages with a shared marketing nav/footer.

- [ ] **Step 1: Write `app/(marketing)/layout.tsx`**

```tsx
import Link from "next/link";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <header className="flex items-center gap-6 border-b p-4">
        <Link href="/" className="font-bold">OneLink</Link>
        <nav className="flex gap-4 text-sm">
          <Link href="/">Home</Link><Link href="/about">About</Link>
          <Link href="/pricing">Pricing</Link><Link href="/support">Support</Link>
        </nav>
        <Link href="/app/links" className="ml-auto text-sm font-medium">My OneLinks</Link>
      </header>
      <main className="mx-auto max-w-4xl p-6">{children}</main>
      <footer className="border-t p-6 text-center text-sm text-muted-foreground">© OneLink</footer>
    </div>
  );
}
```

- [ ] **Step 2: Write `app/(marketing)/page.tsx`** (Home)

```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="grid gap-6 py-12 text-center">
      <h1 className="text-4xl font-bold">One link to your app on every store</h1>
      <p className="text-muted-foreground">Detect the visitor’s device and send them to the right app store — with a branded QR code.</p>
      <div><Button asChild><Link href="/app/links">Create your OneLink</Link></Button></div>
    </div>
  );
}
```

- [ ] **Step 3: Write `app/(marketing)/pricing/page.tsx`** (table from PLAN_LIMITS)

```tsx
import { PLAN_LIMITS } from "@/lib/plans";

const rows: { label: string; key: keyof typeof PLAN_LIMITS.FREE }[] = [
  { label: "Custom slug", key: "customSlug" },
  { label: "QR logo", key: "qrLogo" },
  { label: "QR gradient", key: "qrGradient" },
  { label: "Desktop links", key: "desktopLinks" },
  { label: "Parameter forwarding", key: "parameterForwarding" },
  { label: "Full analytics", key: "fullAnalytics" },
];

function cell(v: boolean | number | null) {
  if (v === true) return "✓"; if (v === false) return "—"; return v === null ? "Unlimited" : String(v);
}

export default function Pricing() {
  return (
    <div className="grid gap-6">
      <h1 className="text-center text-3xl font-bold">Pricing</h1>
      <table className="w-full border">
        <thead><tr><th className="p-3 text-left">Feature</th><th className="p-3">Free</th><th className="p-3">Pro — $10/mo</th></tr></thead>
        <tbody>
          <tr><td className="p-3">Links</td><td className="p-3 text-center">{cell(PLAN_LIMITS.FREE.maxLinks)}</td><td className="p-3 text-center">{cell(PLAN_LIMITS.PRO.maxLinks)}</td></tr>
          {rows.map((r) => (
            <tr key={r.key} className="border-t">
              <td className="p-3">{r.label}</td>
              <td className="p-3 text-center">{cell(PLAN_LIMITS.FREE[r.key])}</td>
              <td className="p-3 text-center">{cell(PLAN_LIMITS.PRO[r.key])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Write `app/(marketing)/about/page.tsx` and `support/page.tsx`** (simple static content)

```tsx
// about/page.tsx
export default function About() {
  return <div className="prose"><h1>About OneLink</h1><p>OneLink turns a single URL into a smart, device-aware redirect to your app on every store, with branded QR codes and analytics.</p></div>;
}
```

```tsx
// support/page.tsx
export default function Support() {
  return <div className="prose"><h1>Support</h1><p>Need help? Email <a href="mailto:support@buildsolo.online">support@buildsolo.online</a>.</p></div>;
}
```

- [ ] **Step 5: Delete default home**

```bash
rm app/page.tsx
```

- [ ] **Step 6: Manual verification**

Run: `pnpm dev`, visit `/`, `/pricing`, `/about`, `/support`.
Expected: all render; pricing table reflects `PLAN_LIMITS`.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: add marketing pages"
```

### Task 8.2: E2E critical-path test

**Files:**
- Create: `e2e/redirect.spec.ts`

**Interfaces:**
- Consumes: a running app + seeded link. Uses Playwright request context to assert redirect behavior without a real browser session.

- [ ] **Step 1: Write `e2e/redirect.spec.ts`**

```typescript
import { test, expect } from "@playwright/test";

// Requires a seeded link with slug "e2e-demo" whose iosUrl points to a known URL,
// and its config present in Upstash. Set BASE_URL in playwright.config.ts.
test("iOS user-agent redirects to iOS store", async ({ request }) => {
  const res = await request.get("/r/e2e-demo", {
    headers: { "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" },
    maxRedirects: 0,
  });
  expect(res.status()).toBe(302);
  expect(res.headers()["location"]).toContain("apps.apple.com");
});

test("unknown slug returns 404", async ({ request }) => {
  const res = await request.get("/r/nope-nope", { maxRedirects: 0 });
  expect(res.status()).toBe(404);
});
```

- [ ] **Step 2: Configure `playwright.config.ts`**

```typescript
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: process.env.BASE_URL ?? "http://localhost:3000" },
});
```

- [ ] **Step 3: Run E2E**

Run: seed a link with slug `e2e-demo` (create via dashboard), then `pnpm test:e2e`
Expected: both tests PASS.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "test: add E2E redirect critical-path tests"
```

### Task 8.3: Full test suite & coverage gate

**Files:**
- Modify: `package.json` (add coverage script), `vitest.config.ts`

**Interfaces:**
- Produces: `pnpm test:coverage` producing a coverage report; verify ≥80% on `lib/` logic modules.

- [ ] **Step 1: Add coverage dep and script**

```bash
pnpm add -D @vitest/coverage-v8
```

Add to `package.json`: `"test:coverage": "vitest run --coverage"`.

- [ ] **Step 2: Enable coverage in `vitest.config.ts`**

Add under `test`:
```typescript
coverage: { provider: "v8", include: ["lib/**/*.ts"], exclude: ["lib/**/__tests__/**", "lib/db.ts", "lib/redis.ts", "lib/stripe.ts"] },
```

- [ ] **Step 3: Run coverage**

Run: `pnpm test:coverage`
Expected: all tests pass; `lib/` coverage ≥80%. If below, add tests for the uncovered branch.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "test: add coverage reporting and verify 80% on lib logic"
```

---

## Phase 9 — Deployment

### Task 9.1: Vercel deploy configuration

**Files:**
- Create: `README.md` (deploy + env docs)
- Verify: `vercel.json` cron, all env vars.

**Interfaces:**
- Produces: deployable app on Vercel bound to `buildsolo.online`.

- [ ] **Step 1: Document required env vars in `README.md`**

List every var from `.env.example` plus `CRON_SECRET`, with notes on where each comes from (Neon, Upstash, Stripe dashboard, Google console, Vercel Blob).

- [ ] **Step 2: Push repo and import into Vercel**

```bash
git push origin main
```
Then: import the repo in the Vercel dashboard, set all env vars, add domain `buildsolo.online`.

- [ ] **Step 3: Configure Stripe production webhook**

Point a Stripe webhook endpoint at `https://buildsolo.online/api/webhooks/stripe`; copy the signing secret into `STRIPE_WEBHOOK_SECRET`.

- [ ] **Step 4: Smoke test production**

Create a link, hit `https://buildsolo.online/r/<slug>` with an iPhone UA, confirm 302; upgrade via Stripe test card; confirm plan flips to PRO after webhook.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "docs: add deployment README"
```

---

## Self-Review Notes

- **Spec coverage:** Redirect (P4), QR full customization + logo/gradient/export (P6), analytics device/country/referrer/UTM/target (P4 capture, P5 aggregate + gated display), Stripe Free/Pro billing (P7), gating via `lib/plans.ts` (P1, enforced in every Server Action), marketing 4 pages (P8), Edge-safe redirect with Upstash cache + no Prisma (P3/P4), analytics buffer + Vercel Cron flush (P4/P5), Vercel Blob logo (P6), NextAuth (P2), error handling (404/fallback/landing in P4, Zod at every boundary), testing 80%+ (P8.3). All spec sections mapped.
- **Edge constraint check:** `app/r/[slug]/route.ts` imports only `link-cache`, `device`, `resolve`, `utm`, `analytics-queue` — none import Prisma or Node built-ins; all Redis access is via `@upstash/redis` REST. Confirmed edge-safe.
- **Type consistency:** `LinkConfig` shape is identical across `resolve.ts`, `link-cache.ts`, and the redirect route. `AnalyticsPayload.linkId` carries the slug at the Edge and is remapped to the DB link id in `flush.ts` (documented note in Task 4.3 and handled in Task 5.1). `QrConfigInput` used consistently in QR schema, action, options builder, and studio.
- **Known follow-ups (not blockers):** `req.geo` is deprecated in favor of `geolocation()` from `@vercel/functions` in newer Vercel runtimes — implementer should use whichever the installed Next.js version supports; the plan's intent (country from edge geo) is unchanged.

# Research: Next.js + Neon + Vercel free-tier stack, auth, zero-cost deploy

**Project:** upper-i (group expense splitting, <10 users, VND, mobile-first PWA)
**Researched:** 2026-10-06
**Overall confidence:** HIGH (primary vendor docs, dated 2026; npm registry for versions)
**Mode:** Ecosystem + feasibility

---

## Key Findings (decision-ready)

- **0 VND/month is comfortably achievable.** For <10 users this app uses roughly 1–2% of every relevant free-tier limit. Nothing here is a squeeze.
- **Two constraints in PROJECT.md are stale and should be corrected.** Vercel Hobby function timeout is **300s**, not 10s. Neon free storage is **1 GB/project (20 GB account)**, not 0.5 GB. Both changes are in your favour; neither blocks anything.
- **Neon cold start is a non-issue.** Scale-to-zero fires after 5 min idle and resumes in **a few hundred milliseconds**. Budget ~500ms on the first request after idle. Do not architect around this.
- **A keep-alive cron is impossible on Hobby and pointless anyway.** Vercel Hobby caps cron at **once per day**; `*/5 * * * *` fails at deploy time. It would also burn your 100 CU-hour budget for a 300ms saving. Skip it.
- **Compute hours are the only limit worth watching, and you have ~10x headroom.** 100 CU-hours/month at 0.25 CU ≈ 400 active hours. A 10-person group generates maybe 30–40 active hours/month.
- **Use `@prisma/adapter-neon` over the pooled (`-pooler`) connection string.** Pooled for the app, direct/unpooled for migrations. Non-negotiable in serverless.
- **Pin `prisma@7`.** `npm i prisma` currently resolves to **8.0.0-rc.20** while `@prisma/client` latest is 7.10.0 — a version split that breaks the build. This is the single most likely setup failure.
- **NextAuth v5 is still beta** (`5.0.0-beta.32`; npm `latest` is still v4.24.15). It is the correct choice for App Router regardless, but pin the exact beta — betas have shipped breaking changes.
- **Next.js 16 renamed `middleware.ts` → `proxy.ts`.** Most tutorials you will find are wrong on this. Upside: `proxy.ts` runs on the Node runtime, so the old "Prisma doesn't work in middleware" edge problem is gone.
- **Restrict signup via the `signIn` callback against a DB allowlist table**, not a hardcoded array — it lets you invite members without a redeploy.
- **Use database sessions (not JWT).** With `<10` users the extra query is irrelevant, and it gives instant revocation plus a real `user.id` in session.
- **Use Cloudflare R2 for receipts, not Vercel Blob.** R2 free = **10 GB + free egress**; Blob Hobby = **1 GB + 2,000 advanced ops/month**. Blob's op ceiling is the real risk, not the storage.
- **Receipt photos exceed the 4.5 MB server-action limit.** Compress client-side (`canvas`) before upload — which also solves the Blob/R2 size question entirely.
- **PWA: skip Serwist initially.** Next.js has first-party `app/manifest.ts`. "Installable + fast" is enough; `next-pwa` is abandoned (last publish **2022**).
- **Total setup time: ~60–75 minutes**, of which Google OAuth consent screen is the slowest (~20 min).

---

## 1. Free tier limits (verified 2026)

### Vercel Hobby

Source: [vercel.com/docs/plans/hobby](https://vercel.com/docs/plans/hobby) (docs `last_updated: 2026-09-14`), [vercel.com/docs/limits/fair-use-guidelines](https://vercel.com/docs/limits/fair-use-guidelines)

| Resource | Hobby included | This app's realistic use |
|---|---|---|
| Fast Data Transfer | 100 GB | <1 GB |
| Fast Origin Transfer | 10 GB | <0.5 GB |
| CDN Requests | 1,000,000 | ~20k |
| Function Invocations | 1,000,000 | ~20k |
| **Active CPU** | **4 CPU-hours** | ~10–20 min |
| Provisioned Memory | 360 GB-hrs | low |
| Image Optimization Transformations | 5,000/mo | **watch this** (see below) |
| Image Cache Reads / Writes | 300k / 100k | fine |

**Function duration — PROJECT.md is stale.**

> "Maximum duration — Hobby: **300s** default and maximum. Pro and Enterprise: 300s default, 800s maximum…"
> — [vercel.com/docs/functions/limitations](https://vercel.com/docs/functions/limitations)

Vercel's changelog confirms the progression ("Vercel Functions for Hobby can now run up to 60 seconds", later raised). **Update the PROJECT.md constraint from 10s → 300s.** Debt-simplification over a <10-person ledger runs in milliseconds, so this was never binding — but it removes an imagined constraint from the design.

**Non-commercial restriction — exact wording:**

> "Hobby teams are restricted to non-commercial personal use only. All commercial usage of the platform requires either a Pro or Enterprise plan. Commercial usage is defined as any Deployment that is used for the purpose of financial gain of anyone involved in any part of the production of the project, including a paid employee or consultant writing the code."

**Verdict for upper-i: clearly compliant.** Friends tracking shared meal costs is not financial gain from the deployment; no one is paid to build it. The one thing that would break this: if you later charge other groups to use it, you must move to Pro ($20/mo).

**Exceeding limits:** no overage billing on Hobby — the feature pauses and you "wait until 30 days have passed." Good: you cannot be surprised by a bill. Bad: a runaway loop could take the app offline for the rest of the month.

#### What could actually bite

1. **Image Optimization: 5,000 transformations/month.** The sharpest edge on the list. If you render receipt photos through `next/image` with multiple sizes, each unique source+size+quality combo is a transformation. 300 receipts × 2 sizes = 600 — fine. But a careless `sizes` prop that generates 8 variants per image puts you near the ceiling. **Mitigation:** set `unoptimized` on receipt thumbnails, or serve them straight from R2 (R2 egress is free). Reserve `next/image` for your own static assets.
2. **Active CPU 4 CPU-hrs.** Only a risk if you put heavy work in a request path. Your ledger math is trivial; ignore.
3. **Cron once/day** — see §2.

### Neon Free

Source: [neon.com/docs/introduction/plans](https://neon.com/docs/introduction/plans)

| Feature | Free plan |
|---|---|
| Price | $0/month |
| Projects | 100 |
| Branches | 10/project |
| **Compute** | **100 CU-hours/project/month** |
| Autoscaling | up to 2 CU (8 GB RAM) |
| **Scale to zero** | **after 5 min — fixed, cannot disable on Free** |
| **Storage** | **1 GB/project, 20 GB account total** |
| Public network transfer | 5 GB/project |
| History window | 6 hours, up to 1 GB-month |
| Snapshots | 1 manual snapshot |
| Support | Community |

**PROJECT.md says 0.5 GB — update to 1 GB/project.**

#### Will 1 GB hold the ledger?

Yes, by a wide margin. A VND expense row with splits is ~200–400 bytes. 10 people × 10 expenses/week × 52 weeks ≈ 5,200 rows/year ≈ **~2 MB/year**. You would need **centuries** to fill 1 GB. Storage is a non-issue; **never store receipt images in Postgres** (that is the only way to blow this limit).

#### Compute hours — the only real budget

100 CU-hours/month. At minimum 0.25 CU, that is **400 wall-clock hours of active compute**. With 5-min autosuspend, each burst of usage costs ~5 min minimum. Rough model:

```
10 users × 3 app sessions/day × 5 min billed = 150 min/day
150 min/day × 30 = 75 hours/month wall-clock
75 h × 0.25 CU = ~19 CU-hours  →  19% of budget
```

Comfortable. **What would break it:** a keep-alive cron pinging every 5 minutes keeps compute permanently awake = 730 h × 0.25 = **182 CU-hours = 182% of budget.** That alone disqualifies the keep-alive idea (§2).

#### Free-tier gotchas worth noting

- **History window is only 6 hours.** Point-in-time restore beyond 6h is unavailable. For a financial ledger this matters: if someone corrupts data and you notice tomorrow, Neon cannot roll you back. **Mitigation:** your append-only ledger design is already the defence; add a weekly `pg_dump` to a local machine or a GitHub Actions artifact. Low effort, high value.
- **Community support only.** No SLA. Acceptable for a friend group.

---

## 2. Neon cold start / autosuspend

### How bad is it, really?

> "When your database is inactive, it automatically scales to zero after 5 minutes… Once you query the database again, it **reactivates automatically within a few hundred milliseconds**."
> — [neon.com/docs/introduction/scale-to-zero](https://neon.com/docs/introduction/scale-to-zero)

Budget **~500ms added to the first request** after a 5-min idle gap. On 4G at a restaurant, your network RTT is already 100–300ms, so the user perceives one slightly slow first tap, then normal speed. **This does not justify architectural complexity.**

Practical mitigation that costs nothing: make the first paint not depend on the DB. Render the app shell/layout statically, then stream the data in with Suspense. The cold start hides behind the shell render.

### HTTP vs WebSocket vs TCP

Neon's own guidance:

> "Use the driver over **HTTP** by default. The `neon()` function sends each query as an HTTP fetch request, which is the fastest option for single queries… Switch to **WebSockets**, with the `Pool` or `Client` constructors, **only if you need interactive transactions**, sessions, or compatibility with node-postgres."
> — [neon.com/docs/serverless/serverless-driver](https://neon.com/docs/serverless/serverless-driver)

| Option | Use when | For upper-i |
|---|---|---|
| `neon()` HTTP | single queries, one-shot transactions | fast, but Prisma needs more |
| `Pool`/`Client` WebSocket | interactive transactions, pg compat | **what `@prisma/adapter-neon` uses** |
| `pg` over raw TCP | long-lived servers | ✗ wrong for serverless |

**Your ledger needs interactive transactions** (insert expense + N split rows atomically), so the WebSocket path via the Prisma adapter is correct. The HTTP driver cannot express a multi-statement interactive transaction.

### Why pooling is mandatory

Each serverless invocation can open its own connection. Neon at 0.25 CU allows `max_connections = 104`, minus 7 reserved = **97 usable**. Without pooling, a modest burst of concurrent lambdas exhausts this and you get `too many connections`. Neon's PgBouncer (transaction mode) accepts **up to 10,000 client connections**.

The pooled host has **`-pooler`** in the hostname. **Transaction-mode caveats:** `SET`, session-level state, `LISTEN/NOTIFY`, temp tables, and SQL-level `PREPARE` are unsupported on pooled connections — which is exactly why migrations must use the direct URL.

### Recommended setup: Prisma + Neon + Vercel

**⚠️ Version gotcha — the most likely thing to break your first install.** As of 2026-10, npm `latest` for the `prisma` CLI is **`8.0.0-rc.20`** while `@prisma/client` is **`7.10.0`**. An unpinned `npm i prisma` gives you a mismatched RC CLI. Neon's docs flag this explicitly. **Pin `@7` on all three.** Requires Node 20.19+/22.12+/24+.

```bash
npm install @prisma/client@7 @prisma/adapter-neon@7 @neondatabase/serverless
npm install -D prisma@7 tsx
```

`.env` — two connection strings, both from the Neon Console "Connect" dialog:

```ini
# Pooled — has "-pooler" in hostname. Used by the app at runtime.
DATABASE_URL="postgresql://USER:PASS@ep-xxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"

# Direct — no "-pooler". Used by Prisma CLI for migrations only.
DATABASE_URL_UNPOOLED="postgresql://USER:PASS@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
```

> **Naming note:** Neon's current docs use `DATABASE_URL_UNPOOLED` (and the Vercel integration injects that name). Older Prisma docs call it `DIRECT_URL` via `directUrl` in `schema.prisma`. In **Prisma 7 the `directUrl` property is gone** — it moved to `prisma.config.ts`. Use `DATABASE_URL_UNPOOLED` to match what the integration gives you for free.

`prisma/schema.prisma` — note **no `url` field** in Prisma 7:

```prisma
generator client {
  provider = "prisma-client-js"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}
```

`prisma.config.ts` (project root) — tells the CLI to migrate over the **direct** connection:

```typescript
import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL_UNPOOLED'),
  },
})
```

`src/lib/db.ts` — singleton guard prevents connection exhaustion from HMR in dev:

```typescript
import { PrismaClient } from '@/generated/prisma'
import { PrismaNeon } from '@prisma/adapter-neon'

const makeClient = () =>
  new PrismaClient({
    adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL! }),
  })

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof makeClient>
}

export const prisma = globalForPrisma.prisma ?? makeClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

### Keep-alive cron: do NOT do this

Two independent reasons:

1. **Technically impossible on Hobby.** "Hobby accounts are limited to cron jobs that run once per day. Cron expressions that would run more frequently **will fail during deployment**" with error: `Hobby accounts are limited to daily cron jobs.` ([vercel.com/docs/cron-jobs/usage-and-pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing)). A 5-minute keep-alive will not deploy.
2. **Counterproductive even if it were possible.** Keeping compute permanently awake costs ~182 CU-hours/month against a 100 CU-hour budget — you would exhaust the free tier to save 300ms.

**Decision: accept the cold start.** Hide it behind a static app shell.

---

## 3. Auth.js (NextAuth v5) + Google OAuth, App Router

### Version reality check (flag as likely-to-change)

```
next-auth  latest: 4.24.15   ← still v4!
next-auth  beta:   5.0.0-beta.32
@auth/prisma-adapter latest: 2.11.3
```

**NextAuth v5 has been in beta for years and is still beta.** It is nonetheless the right choice for App Router (v4 predates server components). **Pin the exact beta version** — beta-to-beta breaking changes are common.

> **Strategic signal worth knowing:** the Auth.js docs site now banners *"The Auth.js project is now part of Better Auth"* and carries a "Migrate to Better Auth" nav item; the footer reads "Auth.js © Better Auth Inc. - 2026". Auth.js still works and is documented, but **this is a project in transition**. For a 10-person app the switching cost later is small (one `auth.ts` + a schema). If you want to avoid a future migration, evaluating `better-auth` up front is defensible. **Recommendation: stay on NextAuth v5 beta** — its Prisma adapter and Google provider are battle-tested and your surface area is tiny.

```bash
npm install next-auth@5.0.0-beta.32 @auth/prisma-adapter
```

### Google Cloud Console setup (~20 min, the slow part)

1. [console.cloud.google.com](https://console.cloud.google.com) → create project `upper-i`.
2. **APIs & Services → OAuth consent screen**:
   - User type: **External** (needed for arbitrary `@gmail.com` accounts; "Internal" requires Google Workspace).
   - App name, support email, developer email. No logo needed.
   - **Scopes:** only `userinfo.email`, `userinfo.profile`, `openid`. Do not add more — extra scopes trigger Google's verification review.
   - **Publishing status: leave in "Testing".** In Testing mode you add **up to 100 test users** by email — which *is a second allowlist layer, for free*. Google will not let non-listed accounts even reach your app.
   - ⚠️ **Testing-mode caveat:** refresh tokens expire after **7 days** in Testing. Irrelevant if you use database sessions and never need offline Google API access (your case). If you ever do, click "Publish app" — with only these three basic scopes, publishing requires no verification review.
3. **Credentials → Create Credentials → OAuth client ID → Web application**:
   - Authorized JavaScript origins: `http://localhost:3000`, `https://upper-i.vercel.app`
   - **Authorized redirect URIs** (exact — the single most common failure):
     ```
     http://localhost:3000/api/auth/callback/google
     https://upper-i.vercel.app/api/auth/callback/google
     ```
   - Copy Client ID + Client Secret.

> Preview deployments get random URLs (`upper-i-git-abc123.vercel.app`) which you cannot pre-register. Either accept that Google sign-in only works on localhost + production, or add a stable preview alias. For this project, accept it.

### `auth.ts`

```typescript
import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/db'

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [Google],
  session: { strategy: 'database' },

  callbacks: {
    // THE ALLOWLIST GATE — private group, no public signup.
    async signIn({ profile, account }) {
      if (account?.provider !== 'google') return false
      if (!profile?.email || !profile.email_verified) return false

      const invited = await prisma.allowedEmail.findUnique({
        where: { email: profile.email.toLowerCase() },
      })
      return Boolean(invited) // false -> redirected to /api/auth/error?error=AccessDenied
    },

    // Expose the stable internal id to the app.
    async session({ session, user }) {
      session.user.id = user.id
      return session
    },
  },

  pages: { signIn: '/login', error: '/login' },
})
```

**Why a DB table and not a hardcoded array:** adding an 11th housemate becomes an INSERT, not a code change + redeploy. Auth.js's own docs show the hardcoded/domain form (`profile.email.endsWith("@example.com")`) — that works for a company domain but not for a set of personal Gmail addresses.

Belt-and-braces: Google Console "Testing" mode is allowlist #1, `AllowedEmail` is allowlist #2. Either alone would do.

### Route handler

`app/api/auth/[...nextauth]/route.ts`:

```typescript
import { handlers } from '@/auth'
export const { GET, POST } = handlers
```

### Proxy (⚠️ renamed in Next.js 16)

> "**Note:** The middleware file convention is deprecated and has been renamed to proxy."
> — [nextjs.org/docs/app/api-reference/file-conventions/proxy](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)

`proxy.ts` in the project root (use `middleware.ts` if you are on Next.js 15 or earlier):

```typescript
export { auth as proxy } from '@/auth'

export const config = {
  matcher: ['/((?!api/auth|login|manifest.webmanifest|icons|_next/static|_next/image|favicon.ico).*)'],
}
```

Bonus from the rename: `proxy.ts` runs on the **Node.js runtime**, so the old "Prisma/database sessions break in edge middleware" problem is gone. Auth.js's Prisma docs confirm: *"In Next.js 16+, proxy.ts runs on the Node.js runtime, so this may no longer be necessary."* No split-config workaround needed.

### Session access

Server component:

```typescript
import { auth } from '@/auth'

export default async function Page() {
  const session = await auth()
  if (!session?.user) return null
  const expenses = await prisma.expense.findMany({
    where: { payerId: session.user.id },
  })
  return <ExpenseList items={expenses} />
}
```

Server action — **re-check auth inside every action**; the proxy matcher does not protect server actions:

```typescript
'use server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function addExpense(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Unauthorized')

  const amountVnd = Number(formData.get('amount'))
  if (!Number.isInteger(amountVnd) || amountVnd <= 0) {
    throw new Error('Amount must be a positive integer (VND)')
  }

  await prisma.expense.create({
    data: { amountVnd, payerId: session.user.id, /* … */ },
  })
}
```

### Database sessions vs JWT

| | JWT | Database |
|---|---|---|
| DB query per request | none | one |
| Revoke access instantly | ✗ (valid till expiry) | ✓ delete row |
| `user.id` in session | needs jwt+session callbacks | native |
| Works on edge | ✓ | needs Node (fine in Next 16) |
| Removing a member | up to 30 days stale | immediate |

**Recommendation: `strategy: 'database'`.** With 10 users the extra query is noise (~5ms on warm Neon), and instant revocation matters for an app holding money records. JWT's only real advantage — avoiding DB hits at the edge — is irrelevant here since you query the DB on virtually every page anyway.

---

## 4. Stable user identity

The old system used display names as primary keys; `norm_` didn't strip accents or lowercase, so `"quinn" ≠ "Quinn"`, and renames broke history. The fix is structural: **identity is a surrogate key, display name is just an attribute.**

```prisma
// ---- Auth.js required models (names/fields fixed by the adapter) ----

model User {
  id            String    @id @default(cuid())  // ← THE key. Never changes, never displayed.
  name          String?                          // mutable label, safe to rename
  email         String?   @unique                // from Google, stable identity link
  emailVerified DateTime?
  image         String?

  accounts      Account[]
  sessions      Session[]

  // ---- app relations ----
  paidExpenses  Expense[]      @relation("payer")
  splits        ExpenseSplit[]
  createdAt     DateTime  @default(now())
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String   // "google"
  providerAccountId String   // Google's immutable subject ("sub")
  refresh_token     String?  @db.Text
  access_token      String?  @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?  @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String
  expires    DateTime
  @@unique([identifier, token])
}

// ---- app models ----

model AllowedEmail {
  email     String   @id              // lowercase on write
  label     String?                   // "Quinn" — pre-login display hint only
  invitedAt DateTime @default(now())
}

model Expense {
  id         String   @id @default(cuid())
  amountVnd  BigInt                    // integer đồng. NEVER Float/Decimal.
  note       String?
  payerId    String
  payer      User     @relation("payer", fields: [payerId], references: [id])
  splits     ExpenseSplit[]
  createdAt  DateTime @default(now())

  @@index([createdAt])
}

model ExpenseSplit {
  id        String  @id @default(cuid())
  expenseId String
  userId    String                      // FK to User.id — survives renames
  shareVnd  BigInt                      // integer; remainder distributed deterministically

  expense   Expense @relation(fields: [expenseId], references: [id], onDelete: Cascade)
  user      User    @relation(fields: [userId], references: [id])

  @@unique([expenseId, userId])
}
```

**The three layers of identity, kept separate:**

| Layer | Field | Mutable? | Role |
|---|---|---|---|
| Internal | `User.id` (cuid) | never | FK target for all ledger rows |
| External | `Account.providerAccountId` (Google `sub`) | never | links Google login → User |
| Display | `User.name` | freely | UI label only, never a key |

Renaming is now `UPDATE users SET name = 'Quỳnh'` and every historical row still resolves. The accent/case problem disappears because names are never compared.

> **`BigInt` note:** `BigInt` doesn't `JSON.stringify` by default. Either convert at the serialization boundary (`Number(x)` is safe — VND totals stay far below 2^53) or add a global `BigInt.prototype.toJSON`. Given VND amounts, plain `Int` (max ~2.1 billion đồng) is arguably sufficient and simpler; `BigInt` is the conservative choice. **Pick one before writing code** — changing later is a migration.

### Seeding the ~10 known members

You cannot create real `User` rows before first login — Auth.js creates those, and you don't know their Google `sub`. **Seed the allowlist instead; `User` rows materialize on first sign-in.**

`prisma/seed.ts`:

```typescript
import { PrismaClient } from '../src/generated/prisma'
const prisma = new PrismaClient()

const MEMBERS = [
  { email: 'quinn@gmail.com',  label: 'Quỳnh' },
  { email: 'an@gmail.com',     label: 'An' },
  // … ~10 total
]

async function main() {
  for (const m of MEMBERS) {
    await prisma.allowedEmail.upsert({
      where:  { email: m.email.toLowerCase() },
      update: { label: m.label },
      create: { email: m.email.toLowerCase(), label: m.label },
    })
  }
}

main().finally(() => prisma.$disconnect())
```

Run once: `npx tsx prisma/seed.ts`.

**Consequence worth designing around:** a member has no `User.id` until they first log in, so you cannot assign them an expense share before that. Two options:

- **(a) Recommended — require everyone to log in once at setup.** Send the link, have all 10 tap "Sign in with Google" on day one. Takes 5 minutes total and keeps the schema clean.
- (b) Allow "ghost" members (a `User` row with `email` but no `Account`) and merge on first login by matching email. More flexible, meaningfully more code and edge cases. **Not worth it for 10 people who share a dining table.**

---

## 5. Deploy story, start to finish

### Minimal sequence (~60–75 min)

**1. Repo + app (5 min)**
```bash
npx create-next-app@latest upper-i --typescript --app --tailwind
cd upper-i && git init && git add -A && git commit -m "init"
gh repo create upper-i --private --source=. --push
```

**2. Neon database (5 min)** — [console.neon.tech](https://console.neon.tech) → New Project → **region `ap-southeast-1` (Singapore)**, the closest to Vietnam. Copy both connection strings from "Connect".

**3. Vercel project (5 min)** — [vercel.com/new](https://vercel.com/new) → import the repo → set the **Function Region to `sin1` (Singapore)** to match Neon. Deploy (it will fail without env vars — expected).

> **Region matters more than anything else here.** Vercel defaults to `iad1` (Washington DC). Leaving function region US + database Singapore adds ~250ms round-trip *per query* for Vietnamese users. Set both to Singapore.

**4. Google OAuth (20 min)** — as in §3.

**5. Env vars (5 min)** — Vercel → Settings → Environment Variables:

| Variable | Value | Notes |
|---|---|---|
| `DATABASE_URL` | pooled, `-pooler` host | app runtime |
| `DATABASE_URL_UNPOOLED` | direct host | migrations |
| `AUTH_SECRET` | `npx auth secret` | sign/encrypt tokens |
| `AUTH_GOOGLE_ID` | from Console | auto-detected by name |
| `AUTH_GOOGLE_SECRET` | from Console | auto-detected by name |
| `AUTH_URL` | *omit* | see below |
| `AUTH_TRUST_HOST` | `true` | needed on Vercel |

> **`AUTH_URL` is usually unnecessary on Vercel.** NextAuth v5 infers the host from `VERCEL_URL`. Set `AUTH_TRUST_HOST=true` instead. Only set `AUTH_URL` if you attach a custom domain and callbacks start pointing at the wrong host.

**6. Migrations in the build command (5 min)** — `package.json`:

```json
{
  "scripts": {
    "build": "prisma generate && prisma migrate deploy && next build"
  }
}
```

**Why this is the common pattern:** Vercel has no post-deploy hook on Hobby, so the build is the only place to run migrations automatically on `git push`. `migrate deploy` is the non-interactive, production-safe command — it applies pending migrations and never generates or resets.

**Caveats, honestly:**
- **It runs against production from every build, including preview builds** — unless previews use their own branch DB (below). Guard with `vercel env` scoping or a `VERCEL_ENV` check.
- **No rollback.** A failed migration mid-way leaves the DB partially migrated and the deploy red. For a 10-person app, acceptable; recover by hand.
- **Brief window where new schema meets old running code.** Irrelevant at this scale, real at larger ones. The fix (expand/contract migrations) is overkill here.
- **`prisma generate` must come first** — Vercel caches `node_modules`, so a stale client is a classic cause of "column does not exist" at runtime.
- `migrate deploy` uses `DATABASE_URL_UNPOOLED` via `prisma.config.ts` — correct, since DDL cannot run through PgBouncer transaction mode.

**7. Push → live (2 min)**
```bash
git push    # Vercel builds, migrates, deploys
```

**8. Seed the allowlist (3 min)**
```bash
npx tsx prisma/seed.ts   # with prod DATABASE_URL_UNPOOLED in env
```

### Preview-deployment database strategy

Neon's Vercel integration supports **Automated Preview Branching** — a copy-on-write branch per preview deployment ([neon.com/docs/guides/vercel-native-integration](https://neon.com/docs/guides/vercel-native-integration)).

**Verdict for this project: skip it.** Reasons:

1. Google OAuth redirect URIs cannot be registered for random preview URLs, so **you cannot log in to a preview anyway** — which is most of the app.
2. Free plan allows 10 branches/project; stale preview branches accumulate and eat the quota.
3. Solo/small-group dev means `main` → production is the whole workflow. Test locally against a single long-lived Neon dev branch instead.

Better free alternative: create **one** manual Neon branch called `dev`, point `.env.local` at it, and keep previews pointed at production-read or simply ignore them.

### Integration vs manual connection string

| | Vercel-Managed integration | Manual |
|---|---|---|
| Env vars | auto-injected | copy/paste once |
| Billing | via Vercel invoice | separate Neon account |
| `neon` CLI login | **not supported** | supported |
| Neon Console access | limited | full |

**Recommendation: manual connection strings.** It is 2 minutes of copy/paste, keeps full Neon Console access (branch management, SQL editor, monitoring), and avoids coupling your DB's existence to the Vercel project. The integration's main benefit — unified billing — is meaningless at $0.

---

## 6. PWA on Next.js App Router

### Library landscape (verified via npm registry, 2026-10-06)

| Package | Latest | Last publish | Status |
|---|---|---|---|
| `next-pwa` | 5.6.0 | **2022-08-23** | ☠️ abandoned (4 years) |
| `@ducanh2912/next-pwa` | 10.2.9 | **2024-09-18** | ⚠️ stale (2 years); author moved to Serwist |
| `serwist` / `@serwist/next` | **9.5.13** | **2026-10-04** | ✅ actively maintained |

**If you need a service worker, Serwist is the only live option.** `next-pwa` is dead; its successor `@ducanh2912/next-pwa` was written by the same author who then created Serwist.

### Is offline support worth it here?

**No — "installable + fast" is enough for v1.** Reasoning specific to this app:

- The core action is *writing* (log an expense), not reading. Offline writes require a sync queue with conflict resolution — and your PROJECT.md explicitly calls out that the old system died from concurrent-write bugs. **Adding an offline write queue reintroduces exactly the class of bug you are rewriting to escape.**
- The app's value depends on shared, current state ("who owes whom right now"). Stale offline balances are worse than a spinner.
- Restaurants have 4G. The realistic failure is *slow*, not *absent*.

**Do this instead:** `manifest.ts` for installability + aggressive server-component rendering for speed. Revisit Serwist only if real-world use shows dead zones.

### Minimal setup — zero dependencies

`app/manifest.ts` (Next.js first-party, [docs](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/manifest)):

```typescript
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Upper-I — Chia tiền nhóm',
    short_name: 'Upper-I',
    description: 'Chia tiền và theo dõi nợ nhóm',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#0f172a',
    lang: 'vi',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icons/maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
```

Served automatically at `/manifest.webmanifest` — **remember to exclude it from the auth proxy matcher** (done in §3) or the manifest 302s to the login page and install silently fails. This is a real and confusing failure mode.

`app/layout.tsx` — iOS needs extra hints; iOS ignores `manifest.json` for install:

```typescript
import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'Upper-I',
  appleWebApp: {
    capable: true,
    title: 'Upper-I',
    statusBarStyle: 'default',
  },
}

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,       // stops iOS zooming on input focus
  viewportFit: 'cover',  // handles the notch
}
```

**Icons needed** (`public/icons/`): `icon-192.png`, `icon-512.png`, `maskable-512.png` (keep art within the centre 80% safe zone), plus `apple-touch-icon.png` (180×180) in `public/`.

**iOS gotchas (stable, long-standing):** no install prompt — users must use Share → "Add to Home Screen" manually; tell them explicitly. No push notifications unless installed to home screen (iOS 16.4+).

---

## 7. Image storage for receipt photos

### Free tier comparison

| | Vercel Blob (Hobby) | Cloudflare R2 | Supabase Storage | UploadThing |
|---|---|---|---|---|
| Storage | **1 GB** | **10 GB** | 1 GB | 2 GB |
| Egress | 10 GB data transfer | **unlimited, free** | 5 GB | included |
| Write ops | **2,000 advanced/mo** | 1M Class A/mo | — | — |
| Read ops | 10,000 simple/mo | 10M Class B/mo | — | — |
| Card required | no | **yes** (not charged) | no | no |
| Setup effort | lowest (1 click) | medium (S3 creds) | medium | low |
| Risk | pauses 30 days at cap | — | project pauses when idle | vendor lock |

Sources: [vercel.com/docs/vercel-blob/usage-and-pricing](https://vercel.com/docs/vercel-blob/usage-and-pricing), [developers.cloudflare.com/r2/pricing](https://developers.cloudflare.com/r2/pricing/)

### Recommendation: **Cloudflare R2**

Sizing a few hundred receipts: 300 photos × ~1.5 MB (compressed) ≈ **450 MB**.

- Against Blob's 1 GB that is ~45% used in year one — **you would hit the cap in year two.**
- Against R2's 10 GB it is 4.5% — **years of headroom.**
- **Blob's real constraint is operations, not bytes:** 2,000 advanced ops/month, and *every `put()` and every `list()` counts*. 300 uploads plus repeated list calls on a dashboard can approach this faster than expected. R2 gives 1M Class A ops.
- R2's **free egress** means you can serve receipt images directly from a public R2 bucket and bypass Vercel's Fast Data Transfer *and* the 5,000 image-transformation limit (§1) entirely.

**Caveat (be aware before committing):** R2 requires a credit card on file even for the free tier. If the user's hard constraint is "no card anywhere", choose **Vercel Blob** and plan to prune old receipts annually — the 1 GB/2k-ops ceiling is then a real operational task, not a theoretical one. **This is a genuine trade-off worth asking the user about.**

### Upload flow — compress first (mandatory)

> "Server uploads are perfectly fine as long as you do not need to upload files larger than **4.5 MB** on Vercel."
> — [vercel.com/docs/vercel-blob/server-upload](https://vercel.com/docs/vercel-blob/server-upload)

A modern phone camera produces 3–8 MB JPEGs, so **raw receipt photos will exceed the server-action body limit.** Compressing client-side solves this *and* shrinks storage ~5x — do it regardless of which provider you choose.

Client component:

```tsx
'use client'

async function compress(file: File, maxEdge = 1600, quality = 0.7): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * scale)
  canvas.height = Math.round(bmp.height * scale)
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  return new Promise((res) =>
    canvas.toBlob((b) => res(b!), 'image/jpeg', quality),
  )
}

export function ReceiptInput({ expenseId }: { expenseId: string }) {
  return (
    <input
      type="file"
      accept="image/*"
      capture="environment"   // opens the camera directly on mobile
      onChange={async (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        const small = await compress(file)          // ~8 MB -> ~300 KB
        const fd = new FormData()
        fd.append('expenseId', expenseId)
        fd.append('receipt', small, 'receipt.jpg')
        await uploadReceipt(fd)
      }}
    />
  )
}
```

Server action (R2 via the S3 API — `@aws-sdk/client-s3`):

```typescript
'use server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { randomUUID } from 'crypto'

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

export async function uploadReceipt(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Unauthorized')

  const file = formData.get('receipt') as File
  const expenseId = formData.get('expenseId') as string
  if (!file || file.size > 4 * 1024 * 1024) throw new Error('File too large')

  const key = `receipts/${expenseId}/${randomUUID()}.jpg`

  await r2.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET!,
      Key: key,
      Body: Buffer.from(await file.arrayBuffer()),
      ContentType: 'image/jpeg',
    }),
  )

  await prisma.expense.update({
    where: { id: expenseId },
    data: { receiptKey: key },   // store the KEY, not a full URL
  })
}
```

Store the **key**, not a URL — so you can switch between a public bucket URL and signed URLs without a data migration.

**Vercel Blob equivalent**, if you pick it instead (simpler, no S3 client):

```typescript
'use server'
import { put } from '@vercel/blob'

const blob = await put(`receipts/${expenseId}.jpg`, file, {
  access: 'public',
  addRandomSuffix: true,
})
// blob.url -> store on the Expense row
```

---

## Confidence & staleness

| Area | Confidence | Basis |
|---|---|---|
| Vercel Hobby limits | HIGH | official docs, `last_updated 2026-09-14` |
| Neon free limits | HIGH | official plans page, 2026 |
| Cold start behaviour | HIGH | Neon docs; **but "a few hundred ms" is vendor-stated, not independently measured** |
| Prisma + Neon config | HIGH | Neon's own Prisma guide, current |
| Auth.js v5 patterns | MEDIUM-HIGH | official docs; **still beta, API can shift between betas** |
| Package versions | HIGH | npm registry, queried 2026-10-06 |
| PWA approach | HIGH | Next.js first-party docs + registry publish dates |
| Storage comparison | HIGH | both vendors' pricing pages |
| Setup time estimate | MEDIUM | experience-based, not measured |

### Most likely to go stale

1. **NextAuth v5 beta number.** Pin it; re-check before starting.
2. **`prisma` npm `latest` → 8.x.** When Prisma 8 goes stable, the `@7` pinning advice should be revisited (the two-connection-string architecture will not change).
3. **Auth.js → Better Auth transition.** Watch for Auth.js entering maintenance-only. Low urgency; small blast radius here.
4. **Next.js `proxy.ts`.** New in 16; most tutorials still say `middleware.ts`. Verify against your installed version.

### Open questions for the user

- **Credit card on file for Cloudflare R2 — acceptable?** If not, Vercel Blob with annual pruning is the fallback.
- **`BigInt` vs `Int` for VND amounts** — decide before schema is written; changing later is a migration.
- **Will all 10 members log in once during setup?** If yes, the clean allowlist approach works; if no, ghost-user merging adds real complexity.

### Sources

- https://vercel.com/docs/plans/hobby
- https://vercel.com/docs/limits/fair-use-guidelines
- https://vercel.com/docs/functions/limitations
- https://vercel.com/docs/cron-jobs/usage-and-pricing
- https://vercel.com/docs/vercel-blob/usage-and-pricing
- https://vercel.com/docs/vercel-blob/server-upload
- https://neon.com/docs/introduction/plans
- https://neon.com/docs/introduction/scale-to-zero
- https://neon.com/docs/connect/connection-pooling
- https://neon.com/docs/serverless/serverless-driver
- https://neon.com/docs/guides/prisma
- https://neon.com/docs/guides/vercel-native-integration
- https://authjs.dev/getting-started/providers/google
- https://authjs.dev/getting-started/adapters/prisma
- https://nextjs.org/docs/app/api-reference/file-conventions/proxy
- https://nextjs.org/docs/app/guides/progressive-web-apps
- https://nextjs.org/docs/app/api-reference/file-conventions/metadata/manifest
- https://developers.cloudflare.com/r2/pricing/
- npm registry (versions queried 2026-10-06)

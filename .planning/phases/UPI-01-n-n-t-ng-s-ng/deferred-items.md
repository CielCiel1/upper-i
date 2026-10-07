# Deferred Items — Phase UPI-01

## From plan 01-03 (out of scope)

Logged at 01-03 execution time. `pnpm lint` fails on two files owned by the
concurrent plan 01-02, not by 01-03. Not fixed here — touching them would
violate the disjoint-file-set contract between the two wave-2 plans.

| File | Issue | Owner |
|------|-------|-------|
| `prisma/seed.ts` | `assist/source/organizeImports` — imports not sorted | 01-02 |
| `src/lib/allowlist.test.ts` | formatter diff on a long `expect(...)` call | 01-02 |

Both are auto-fixable with `pnpm format` once 01-02 has committed its files.
Scoped lint over 01-03's own files passes clean:
`pnpm exec biome check src/app/globals.css src/app/layout.tsx src/components/ui/`

## From code review (ME-02) — email in the rejection URL

The address of a rejected sign-in travels in the query string of
`/chua-duoc-moi?error=AccessDenied&email=…`. That exposes it three ways:

| Exposure | Mitigated in Phase 1? | By what |
|---|---|---|
| `Referer` header | yes | `metadata.referrer = "no-referrer"`, verified present in served HTML |
| Browser history | **no** | nothing — the URL persists on a possibly shared device |
| Server logs | **no** | nothing — Vercel logs request URLs including query strings |

The accepted-risk argument stands: the value is the user's own address, returned
to them. Not a secret, not a credential, opens nothing. Showing it is what makes
the screen useful, because the dominant real cause of a rejection is tapping the
wrong one of several Google accounts already signed in on the phone.

What was wrong was the claim, not the decision — the comments described two
mitigations as "mandatory" in a way that read as covering the exposure, when they
cover one of its three legs. The comments in `src/app/chua-duoc-moi/page.tsx` now
state the scope precisely.

**To close the remaining two** (~15 lines): redirect to `/chua-duoc-moi` with no
query string and carry the address in a short-lived `HttpOnly` cookie set on the
redirect, read server-side by the page. It stays out of history, out of logs, and
out of `Referer`.

Deferred because it changes the `(marker, email)` entry contract that the page
shares with the `signIn` callback in `src/auth.ts`. It also resolves ME-03 as a
side effect: a cookie-carried address cannot be forged into someone else's
browser, whereas the current URL can be sent to a group member to tell them, in
the app's own chrome, that they are not a member.

## From code review (ME-01) — `-pooler` suffix is not Neon-specific — REJECTED, do not apply

The review proposed anchoring `isPooledConnectionString` with
`&& hostname.endsWith(".neon.tech")`, since `evil-pooler.attacker.com` and a bare
host of `-pooler` both currently pass.

**Do not apply it.** The phase's own build gate (`01-05-PLAN.md`) uses the
placeholder host `db-pooler.local`, which is deliberately not a Neon domain
because no database exists until 01-06. Executed both predicates against it:

```
db-pooler.local            current=true   neon-anchored=false   <- would break every CI build
ep-x-1-pooler...neon.tech  current=true   neon-anchored=true
evil-pooler.attacker.com   current=true   neon-anchored=false
```

The anchor would make `next build` fail at the documented gate. The review states
its own threat model — `DATABASE_URL` is operator-supplied, so the risk is typo,
not adversary — and a typo does not produce `evil-pooler.attacker.com`.

Revisit only if the build placeholder is changed to a Neon-shaped host, in which
case the anchor becomes free.

## From code review (LO-03) — no `updatedAt` on `User`, no timestamps on `Account`/`Session`

Noted, deliberately not fixed. Phase 2 owns the ledger schema and a phase fixing
a review must not touch `prisma/schema.prisma`. Additive and trivial when Phase 2
wants it for audit questions ("when did this member join relative to this
expense").

## From code review (LO-02) — ordering at the 01-06 checkpoint

`"build": "prisma generate && prisma migrate deploy && next build"` means
`migrate deploy` needs `DATABASE_URL_UNPOOLED` to resolve at build time via
`prisma.config.ts`, which throws rather than returning undefined when it is
missing. If the Neon database or that variable is not in place before the first
`git push`, the first deploy fails with a Prisma error naming neither Vercel nor
the missing variable.

Not a code defect — per CONTEXT the fail-loud behaviour is intended. It is a
sequencing requirement for the human checkpoint:

1. Create the Neon database
2. Set **both** `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (direct) in Vercel
3. *Then* push

Paste both values **without surrounding quotes** — the Vercel dashboard field
does not strip them the way `dotenv` does. `.env.example` now says so, and the
`DATABASE_URL` error message now names quoting as a possible cause (HI-03).

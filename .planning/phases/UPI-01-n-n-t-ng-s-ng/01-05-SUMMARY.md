---
phase: UPI-01-n-n-t-ng-s-ng
plan: 05
subsystem: ui
tags: [nextjs, ppr, suspense, auth-ui, vietnamese, infra-07]
status: complete

requires:
  - "src/auth.ts — auth() and the AccessDenied redirect contract (plan 04)"
  - "src/lib/auth-actions.ts — signInWithGoogle, signOutAction (plan 04)"
  - "src/components/ui/{button,card,skeleton,submit-button}.tsx (plan 03)"
  - "src/app/layout.tsx — static shell, safe-area geometry (plan 03)"
  - "src/proxy.ts — route guard whose wiring this plan's gate proves (plan 04)"
provides:
  - "Three Phase 1 screens at /, /dang-nhap, /chua-duoc-moi"
  - "INFRA-07 satisfied and machine-proven: no app route renders fully dynamic"
  - "Executable build-output gate for the route guard and for prerendering"
  - "Known-good route-table baseline for Phase 2"
affects:
  - "Any future page that reads cookies/headers/searchParams must follow the Suspense pattern here"

tech-stack:
  added: []
  patterns:
    - "Session read isolated in a Suspense child so the route partial-prerenders"
    - "Server-action <form> instead of onClick, so controls are live before hydration"
    - "Verbatim UI copy written as JSX string expressions, immune to formatter rewrap"

key-files:
  created:
    - src/app/dang-nhap/page.tsx
    - src/app/chua-duoc-moi/page.tsx
    - src/components/google-mark.tsx
    - src/components/sign-in-button.tsx
    - src/components/sign-out-button.tsx
  modified:
    - src/app/page.tsx

decisions:
  - "Verbatim Vietnamese copy is written as {\"...\"} string expressions, not bare JSX text — the formatter rewraps the latter and silently breaks the exact-match contract grep"
  - "The /chua-duoc-moi direct-access guard requires ?error=AccessDenied and redirects to /dang-nhap otherwise — a usability gate, explicitly not an authentication boundary"
  - "Home page keeps a redirect('/dang-nhap') on a null session as a second line behind the route guard, so a guard/session disagreement fails closed rather than rendering 'Chào undefined'"
  - "The proxy gate was validated by live negative control: moving src/proxy.ts to the repo root produces exit-0, warning-free build with the guard gone"

metrics:
  duration: ~35 min
  completed: 2026-10-07
  tasks: 3
  files: 6
---

# Phase 1 Plan 05: Three Screens and the Build-Output Gates — Summary

Built the sign-in, authenticated-home and rejection screens with verbatim UI-SPEC copy, and proved via the production route table that every app route partial-prerenders and that the route guard is actually wired.

## What Was Built

**Task 1 — Sign-in screen** (`07a6cb9`)

`/dang-nhap` suspends on nothing: no session read, no database import, zero awaits. It is the first thing a user on 4G sees, and nothing on it has a reason to wait on a round-trip. `GoogleMark` inlines the official four-colour G as `aria-hidden` decorative SVG — no icon dependency for one glyph. `SignInButton` is a `<form action={signInWithGoogle}>` with `SubmitButton` rendered *inside* the form, which is the only position where `useFormStatus` reports pending. Bordered variant, not accent-filled, per the UI-SPEC's branding argument.

**Task 2 — Home and rejection** (`ef61421`)

`src/app/page.tsx` is synchronous; the only session-dependent markup lives in an `<Identity/>` child inside `<Suspense>`. That placement is what makes `/` render `◐` rather than `ƒ`. Skeleton fallbacks are sized `h-[1.3em]` / `h-[1.4em]` inside wrappers carrying the matching type token, per the Skeleton sizing contract — a display line is 41.6px, which no 4px-scale utility can express.

`src/app/chua-duoc-moi/page.tsx` awaits `searchParams` inside the boundary, as `cacheComponents: true` requires. The reflected email is trimmed, capped at the RFC 5321 limit of 254, shape-checked, and dropped entirely if implausible; it renders as React text content, never markup. `metadata.referrer = "no-referrer"` keeps the address out of outbound `Referer` headers. Ordinary ink on a plain card — no red, no warning icon, no error styling.

**Task 3 — Build-output gates**

Both gates run exactly as the plan wrote them. Fixture validation first, then the real build, then a live negative control.

## Build Output

```
Route (app)
┌ ◐ /
├ ○ /_not-found
├ ƒ /api/auth/[...nextauth]
├ ◐ /chua-duoc-moi
└ ○ /dang-nhap

ƒ Proxy (Middleware)

○  (Static)             prerendered as static content
◐  (Partial Prerender)  prerendered as static HTML with dynamic server-streamed content
ƒ  (Dynamic)            server-rendered on demand
```

`/` and `/chua-duoc-moi` are `◐` because each has exactly one Suspense-wrapped dynamic read. `/dang-nhap` is `○` because it has none. The only `ƒ` is the auth API route, which is correct for an API endpoint and is the gate's single exclusion.

## Gate Results

**INFRA-07 gate (no app route fully dynamic) — PASSED.** Validated 6/6 against fixtures before being trusted:

| Fixture | Expected | Actual |
|---|---|---|
| `good` | PASSED | PASSED |
| `bad` (home forced `ƒ`) | FAIL dynamic | FAIL: an app route is fully dynamic |
| `noproxy` | FAIL guard | FAIL: route guard NOT wired |
| `badroot` (`/chua-duoc-moi` forced `ƒ`) | FAIL dynamic | FAIL: an app route is fully dynamic |
| `routegroup` (`ƒ /(auth)/dang-nhap`) | FAIL dynamic | FAIL: an app route is fully dynamic |
| `apidocs` (`ƒ /api-docs`) | FAIL dynamic | FAIL: an app route is fully dynamic |

The marker-then-slash anchor is doing the work: `ƒ Proxy (Middleware)` is followed by a letter, so it never enters the match, while `ƒ /api-docs` is correctly *not* excused by the `ƒ /api/` exclusion.

**Proxy-guard gate — PASSED, and verified by live negative control.** Temporarily moved `src/proxy.ts` to the repo root and rebuilt:

```
build_exit=0          ← green
Route (app)
┌ ◐ /
├ ○ /_not-found
├ ƒ /api/auth/[...nextauth]
├ ◐ /chua-duoc-moi
└ ○ /dang-nhap
                      ← no Proxy line. Guard silently gone.
```

Exit 0. No warning. Every protected route public. The gate caught it: `FAIL: route guard NOT wired`. `src/proxy.ts` was restored and confirmed byte-identical to its pre-test state; the working tree is clean.

`DATABASE_URL` placeholder coupling check: `placeholder coupling intact`.

## Verification

| Check | Result |
|---|---|
| `pnpm tsc --noEmit` | exit 0 |
| `pnpm lint` (biome check) | exit 0, 29 files |
| `pnpm test` (vitest) | 2 files, 27 tests passed |
| Production build | succeeds |
| Task 1 automated verify block | passed as written |
| Task 2 automated verify block | passed as written |
| Task 3 automated verify block | `BUILD GATES PASSED` |
| Token hygiene | no `text-primary`, no `bg-white`, no raw hex, no `leading-tight` |

Tokens actually emitted: `text-accent text-body text-caption text-display text-heading text-ink text-ink-muted text-ink-soft`. The sole `leading-tight` occurrence in the codebase is inside a comment forbidding it.

## Deviations from Plan

**1. [Rule 1 — Bug] Verbatim copy broken by the formatter**

- **Found during:** Task 2
- **Issue:** Biome rewraps bare JSX text across lines. Three UI-SPEC strings were split mid-phrase, so the plan's exact-match `grep -qF` assertions failed on copy that was in fact correct. This is a silent contract break: the rendered output is identical, only the machine check notices.
- **Fix:** wrote the three affected strings as `{"..."}` string expressions, which the formatter cannot break. The rejection sentence is split into string expressions either side of its `<strong>`.
- **Files:** `src/app/page.tsx`, `src/app/chua-duoc-moi/page.tsx`
- **Commit:** `ef61421`

**2. [Rule 3 — Blocker] Stale route typegen**

- **Found during:** Task 2
- **Issue:** `PageProps<"/chua-duoc-moi">` failed with `does not satisfy the constraint '"/"'` — `.next/types` predated the new routes.
- **Fix:** ran `pnpm typecheck`, which is `next typegen && tsc --noEmit`. No source change.

**3. [Rule 2 — Missing critical functionality] `AccessDenied` direct-access guard restored (carried-forward FLAG 1)**

- **Issue:** the review flagged the guard as dropped. Without it, anyone typing `/chua-duoc-moi` sees a "not invited" message having never attempted sign-in, and any hand-written `?email=` is reflected back.
- **Fix:** implemented inside the same Suspense boundary that reads the query string — `if (params.error !== "AccessDenied") redirect("/dang-nhap")`. Matches plan 04's stated entry contract `?error=AccessDenied&email=<encoded>`. Documented in-file as a usability gate, explicitly not an authentication boundary: the marker carries no secret and is trivially forged.
- **Commit:** `ef61421`

**4. [Rule 2] Null-session fallback on the home page**

- **Issue:** `/` is guarded by `src/proxy.ts`, but `<Identity/>` reads the session independently. If the two ever disagree, the page would render `Chào undefined`.
- **Fix:** `if (!session?.user) redirect("/dang-nhap")`. Fails closed.

## Carried-Forward FLAGs

| FLAG | Status |
|---|---|
| `AccessDenied` direct-access guard dropped | **Fixed** — see deviation 3 |
| Checklist step 12 vs 13 ordering conflict | **Reported, not mine.** Confirmed real in `01-06-PLAN.md`: step 12 says "confirm the plan tiers **before using anything**", but step 13 hands off to the checkpoint and then says to "return here and re-read the billing page one final time". Step 12 is both a precondition and a postcondition. Plan 01-06 owns this. |
| "Open Questions" lacking `(RESOLVED)` suffix | **Reported, not mine.** `01-RESEARCH.md:1259`. All three questions were in fact settled during execution: removal *is* automated in the seed (plan 02), `AGENTS.md` survived, and `Allowlist` was the name chosen. The heading was not updated. Research doc, not a plan-05 artifact. |

## Notes for the Human Checkpoint (01-06)

The application is **code-complete for Phase 1 and builds green with placeholder credentials**. Nothing here has ever reached a live database.

What exists and is proven offline:
- Three screens, verbatim copy, correct route table
- Route guard wired, proven by the gate and its negative control
- Allowlist gate in `src/auth.ts`, unit-tested at the parser level
- Offline initial migration, ready to apply

What 01-06 must supply, and which nothing here can substitute for:
- A Neon database — no live DB exists; no migration has been applied; no allowlist row exists
- Google OAuth client ID and secret — the build used literal `"placeholder"`
- A real `AUTH_SECRET`
- A Vercel deployment

The build-time `DATABASE_URL` placeholder is pooled-shaped (`db-pooler.local`) and `DATABASE_URL_UNPOOLED` is not (`localhost`). **Keep the asymmetry.** `src/lib/db.ts` throws at module load on a non-pooled host, and `next build` prerenders pages that import it — a plain-localhost placeholder fails the build outright. On Vercel the value is real, and that same throw catches a swapped connection string at deploy time instead of on first request.

Visual verification — dark mode, safe-area insets on a notched phone, diacritic rendering at 1.3 leading, focus ring, one-tap sign-in over mobile data — is deferred to 01-06, which is where a deployed URL and real credentials first exist.

## Self-Check: PASSED

All six files exist on disk; both commits are present in `git log`; the working tree is clean.

---
phase: UPI-01-n-n-t-ng-s-ng
plan: 04
subsystem: auth
tags: [auth, authjs, oauth, allowlist, route-guard, session]
status: complete
requires:
  - "01-02: prisma singleton over the pooled Neon adapter, Allowlist/User/Account/Session models"
  - "01-03: app shell and UI primitives (consumed by plan 05, not here)"
provides:
  - "src/auth.ts exporting handlers, auth, signIn, signOut"
  - "src/lib/auth-actions.ts exporting signInWithGoogle, signOutAction"
  - "src/proxy.ts route guard, verified present in the build route table"
  - "src/lib/allowlist.ts normalizeEmail, shared by the seed and the login lookup"
  - "rejection redirect contract: /chua-duoc-moi?error=AccessDenied&email=<encoded>"
affects:
  - "01-05: consumes the redirect contract, the server actions, and session.user.id"
  - "Phase 2: obtains the current user via auth(); server actions must self-authenticate"
tech-stack:
  added: []
  patterns:
    - "Database sessions over JWT, so removal is revocable by deleting one row"
    - "Server actions behind plain forms, functional before hydration"
    - "Route guard protects by default; the matcher lists exclusions, not inclusions"
key-files:
  created:
    - src/auth.ts
    - src/proxy.ts
    - src/app/api/auth/[...nextauth]/route.ts
    - src/lib/auth-actions.ts
  modified:
    - src/lib/allowlist.ts
    - src/lib/allowlist.test.ts
decisions:
  - "Rejection route is /chua-duoc-moi; the RESEARCH spelling /khong-duoc-moi is superseded"
  - "pages.error points at /dang-nhap, never at the rejection page"
  - "signIn returns a redirect string rather than false, to carry the attempted email"
  - "The session callback keeps a runtime guard the compiler does not require"
metrics:
  duration: ~25 min
  completed: 2026-10-07
---

# Phase UPI-01 Plan 04: Google Sign-In, Allowlist Gate and Route Guard Summary

Google one-tap sign-in gated on a database allowlist, with a 30-day database session and a route
guard proven wired by the build route table.

## What Was Built

| Task | Artifact | Commit |
|------|----------|--------|
| 1 | `src/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `normalizeEmail` + tests | `fa5fde2` |
| 2 | `src/proxy.ts` | `b2d4068` |
| 3 | `src/lib/auth-actions.ts` | `627f0b8` |

The allowlist now holds at two independent points. At login, the `signIn` callback decides whether
an account is ever created. On every request, `src/proxy.ts` decides whether a session is still
valid. Neither depends on the other.

## Verification

Every command the plan specifies was run. Actual output:

| Check | Result |
|-------|--------|
| `pnpm tsc --noEmit` | exit 0 |
| `pnpm lint` (`biome check`) | `Checked 24 files in 8ms. No fixes applied.` exit 0 |
| `pnpm vitest run src/lib` | `Test Files 2 passed (2) · Tests 27 passed (27)` |
| `test -f src/proxy.ts && test ! -f proxy.ts` | pass |
| `grep -rn 'middleware' --include=*.ts src/` | one hit, inside a comment in `src/proxy.ts` warning against the deprecated convention |
| Task 1 / 2 / 3 inline gates | all exit 0 |

The allowlist test file grew from 12 to 16 cases; the suite totals 27.

## Proxy Placement Evidence

This is the phase's one fail-open defect, so it was proven by experiment rather than by the file
existing. Build output with the file at `src/proxy.ts`:

```
Route (app)
┌ ○ /
├ ○ /_not-found
└ ƒ /api/auth/[...nextauth]

ƒ Proxy (Middleware)
```

Negative control — the same build with the file moved to the repository root:

```
Route (app)
┌ ○ /
├ ○ /_not-found
└ ƒ /api/auth/[...nextauth]
```

`✓ Compiled successfully`, zero warnings, and **no `ƒ Proxy (Middleware)` line**. The documented
failure reproduces exactly: at the repo root the build is green and every protected route is
public. The file was moved back and the line confirmed present again before committing.

Note the first attempt at this control used `git mv`, which failed because the file was still
untracked — that run proved nothing and was redone with `mv`. The result above is from the valid run.

## Key Decisions

**Rejection route `/chua-duoc-moi`.** RESEARCH §4.4 writes `/khong-duoc-moi`; UI-SPEC writes
`/chua-duoc-moi` and argues the distinction. The UI-SPEC won, per the plan. Used in `src/auth.ts`
and in the proxy matcher — the two places that must agree with plan 05 or production 404s.

**`pages.error` points at `/dang-nhap`, not the rejection page.** RESEARCH §4.1 pointed it at the
rejection route because `AccessDenied` lands there. That would show "chưa được mời" to an invited
member whose 4G dropped mid-callback. Allowlist refusal gets its own explicit redirect instead, so
the two causes never merge.

**No module augmentation, no workaround for AUTH-02.** Both confirmed against installed source
rather than docs.

## AUTH-02: Verified Against Installed Source

Confirmed in `@auth/core@0.41.3` (the installed version), `lib/actions/callback/index.js`:

```js
const redirect = await handleAuthorized({ ... }, options);   // line 63
if (redirect)
    return { redirect, cookies };                            // line 69
const { user, session, isNewUser } = await handleLoginOrRegister(...)  // line 70
```

And `handleAuthorized` itself (line 393):

```js
if (!authorized) throw new AccessDenied("AccessDenied");
if (typeof authorized !== "string") return;
return await redirect({ url: authorized, baseUrl: config.url.origin });
```

Both the `false` path and the string path exit at line 69, above the row-creating call at line 70.
No `User`, no `Account`, no `Session`.

One gap worth closing explicitly: the string path only short-circuits if `handleAuthorized` returns
something truthy, which means the default `redirect` callback must not return empty. Checked
`lib/init.js` line 13 — for a leading-`/` path it returns `` `${baseUrl}${url}` ``, always truthy.
The redirect emitted here starts with `/`, so the early return holds.

Empirical row-count confirmation still belongs to plan 06; this is the static half.

## Deviations from Plan

**1. [Rule 1 — Bug] The plan's stated reason for narrowing in the session callback is false.**

The plan asserts that `session.user.id = user.id` "does not compile under strict" and that this is
the corrected form. Tested by writing the bare assignment and running `tsc --noEmit`: **exit 0**.
The mutation was confirmed applied before concluding, because a silent no-op edit would have
produced the same green result.

The reason: the callback parameter is an intersection type, and on the `strategy: "database"` branch
`session.user` is `AdapterUser`, where `id: string` is required. The `user?: User` optional the plan
cites lives on `DefaultSession` — not on the type this callback actually receives.

The narrowed form the plan specifies was kept, but the justification comment was rewritten to say
what is true: the compiler does not require the `if`, and it is retained because the type describes
an adapter contract rather than a runtime guarantee. Keeping it converts a should-never-happen case
from a runtime TypeError into a session missing `id`. The comment also records that this leans the
opposite way from `src/lib/db.ts`, which throws loudly on purpose — justified because a
misconfiguration there must block deploy, whereas crashing a valid member's login fixes nothing.

Files: `src/auth.ts`. Folded into commit `fa5fde2`.

**2. [Rule 3 — Blocking] The plan's verification commands embed a non-pooled `DATABASE_URL`.**

Both inline gates pass `DATABASE_URL_UNPOOLED` with a `localhost:5432` host. That is fine for `tsc`,
which never evaluates the module. It is not fine for `next build`, which collects page data and
therefore loads `src/lib/db.ts`, whose module-load guard rejects any non-pooled hostname. The first
build attempt failed exactly there:

```
Error: Failed to collect configuration for /api/auth/[...nextauth]
  [cause]: DATABASE_URL không trỏ tới endpoint POOLED của Neon ...
      at module evaluation (src/lib/db.ts:35:9)
```

This is the guard from plan 01-02 working as designed, not a defect. Resolved by supplying a
pooled-shaped placeholder host (`ep-x-123456-pooler...`) for the build, exactly as plan 01-02's own
notes anticipate. The guard was not weakened or bypassed.

No source file changed; this affected how verification was run.

**3. [Rule 3 — Blocking] Simplified a branch in `signOutAction` that had identical arms.**

The first draft branched on `auth()` returning null and called `signOut({ redirectTo: '/dang-nhap' })`
in both arms — a conditional with no effect. Collapsed to a single unconditional call. The `auth()`
call itself is retained, because its purpose per the plan is to establish the self-authentication
pattern for Phase 2, not to change this action's behavior. The comment now states that the
no-session case is expected and reaches the same destination deliberately.

Files: `src/lib/auth-actions.ts`. Folded into commit `627f0b8`.

## Threat Mitigations Applied

| Threat ID | Status |
|-----------|--------|
| T-04-01 proxy placement | Mitigated and proven by the negative control above |
| T-04-02 unverified email | `!profile.email_verified` rejected before the allowlist lookup |
| T-04-03 non-member creation | Allowlist lookup in `signIn`; source-verified to precede all writes |
| T-04-04 removed member retains session | Database strategy; the in-file comment records that revocation is the seed's job, not automatic |
| T-04-05 unauthenticated server action | `signOutAction` re-checks `auth()`; the limitation is documented in `src/proxy.ts` |
| T-04-06 reflected email | `encodeURIComponent` on the redirect; rendering safety is plan 05's |
| T-04-07 over-broad scopes | Default `Google` provider, no extra scopes |
| T-04-08 email in URL | Accepted. The `no-referrer` policy is plan 05's task — **carry it forward, it is required, not optional** |

## What Plan 05 Needs From This Plan

1. **Entry contract for `/chua-duoc-moi`** — `?error=AccessDenied&email=<encodeURIComponent'd>`.
   Both params are emitted. Redirect to `/dang-nhap` when `error !== 'AccessDenied'`.
2. **Server actions** — import `signInWithGoogle` and `signOutAction` from `@/lib/auth-actions`.
   Do not import `signIn`/`signOut` from `@/auth` in a component.
3. **Session shape** — `session.user.id` is the stable `User.id`. `auth()` returns `null` when
   signed out; `session.user` is typed optional at read sites, so use optional chaining.
4. **Both public routes are already excluded** from the proxy matcher. Any further public route
   needs a matcher change here.
5. **Required, not optional:** the `no-referrer` metadata on the rejection page (T-04-08).
6. **Build gate** — `ƒ Proxy (Middleware)` must appear. A pooled-shaped `DATABASE_URL` placeholder
   is required for the build to get that far; `localhost` will fail at page-data collection.

## Deferred to Plan 06 (live database + real Google credentials)

Not faked, not stubbed — these cannot be proven without infrastructure that does not exist yet:

- One-tap sign-in completing end to end
- Row count unchanged after a refused attempt (the empirical half of AUTH-02)
- Session persisting across restarts (AUTH-03)
- Reseeding revoking a removed member's session
- Sign-out from a real session (AUTH-06)

## Self-Check: PASSED

All four created files exist on disk; both modified files contain the new code. All three commits
(`fa5fde2`, `b2d4068`, `627f0b8`) are present in `git log`. Working tree clean.

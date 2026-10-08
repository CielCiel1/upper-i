---
phase: UPI-01-nen-tang-song
reviewed: 2026-10-07T09:05:00Z
depth: deep
status: findings
files_reviewed: 37
findings:
  critical: 2
  high: 3
  medium: 5
  low: 4
  total: 14
gates_executed:
  tsc_noemit: pass
  biome_check: pass (29 files)
  vitest: pass (27/27)
  next_build: pass (route table matches 01-05 exactly, incl. `ƒ Proxy (Middleware)`)
  runtime_probe: FAIL — guard does not deny
---

# Phase 1 — Code Review

## Gate results

| Gate | Result |
|---|---|
| `pnpm tsc --noEmit` | pass |
| `pnpm lint` (biome check, 29 files) | pass |
| `pnpm vitest run` | 27/27 pass |
| `pnpm build` (pooled placeholder) | pass; route table byte-identical to 01-05 SUMMARY |
| `next start` + unauthenticated `curl` | **FAIL** — see CR-01 |

The build gate was the one gate that could not be faked, and it genuinely passes:
`ƒ Proxy (Middleware)` is present, `/` and `/chua-duoc-moi` are `◐`, `/dang-nhap` is `○`.
That gate proves the proxy file is *wired*. It does not prove the proxy *denies*, and
the distinction is the whole of CR-01.

---

## CRITICAL

### CR-01 — The route guard is wired but never denies. Every protected route is reachable without a session.

**File:** `src/proxy.ts:1`, with `src/auth.ts:37-115`

`src/proxy.ts` exports `auth` as the proxy with no `authorized` callback defined
anywhere in the project (`grep -rn "authorized" src/ prisma/` → no matches).

In the installed `next-auth@5.0.0-beta.32`, `node_modules/next-auth/lib/index.js:142-180`:

```js
let authorized = true;                                   // L146 — default ALLOW
if (config.callbacks?.authorized) {                      // L147 — never true here
    authorized = await config.callbacks.authorized({ request, auth });
}
let response = NextResponse.next?.();
...
else if (!authorized) {                                  // L171 — never reached
    // redirect to signIn page
}
```

With no `authorized` callback the variable is initialised `true` and never reassigned,
so `handleAuth` always falls through to `NextResponse.next()`. The matcher is correct,
the file location is correct, the build table lists it — and it lets everything through.

**Proven at runtime, not inferred.** Built with a pooled placeholder, `next start -p 3999`,
no cookies:

```
GET /             → 200   (expected 307 → /dang-nhap)
GET /chua-duoc-moi → 200
```

The response *did* carry `set-cookie: authjs.csrf-token=...`, which confirms the proxy
executed — it ran and chose to allow. This is not a mis-wiring; it is a missing deny.

**Why it matters.** This is the requirement the phase exists to deliver. The allowlist is
the app's only access control, and the second of its two layers is inert. The phase is
currently protected by exactly one thing: the `signIn` callback, which runs only on the
OAuth callback path. Phase 2 will add money routes on the stated assumption that "a new
route is protected by default" (`src/proxy.ts:34-38`) — that assumption is false today,
and every route added under it inherits the hole.

What currently saves `/` is the page-level `if (!session?.user) redirect("/dang-nhap")`
at `src/app/page.tsx:30` — I confirmed the streamed RSC payload contains
`replace;/dang-nhap;307`. So `/` is defended by its own in-page check, the thing the
comment at `src/app/page.tsx:26-29` calls "a second line rather than the first". It is
in fact the only line. Any future page that omits that redirect is public.

**Fix** — add the deny to `src/auth.ts` callbacks:

```ts
authorized({ auth }) {
  return !!auth?.user;
},
```

Then re-run the runtime probe; `GET /` with no cookie must return 307 to `/dang-nhap`.
Add that curl assertion to the phase gate — the build table cannot catch this class of bug.

---

### CR-02 — Seed deletes allowlist rows and revokes sessions on input it never validates as email-shaped.

**File:** `src/lib/allowlist.ts:31-51`, consumed by `prisma/seed.ts:36,76-92`

`parseAllowlist` throws only when the parse yields *zero* entries. It performs no
shape check on what it does yield. Verified by execution:

```
"an@example.com;binh@example.com" => [{"email":"an@example.com;binh@example.com"}]   // 1 entry, semicolons
"garbage"                         => [{"email":"garbage"}]                            // 1 entry
"an@example.com binh@example.com" => [{"email":"an@example.com binh@example.com"}]    // 1 entry, space-separated
":label-only"                     => [{"email":"","label":"label-only"}]              // EMPTY email entry
```

The empty-string case is the sharpest: `":x"` produces `email: ""`, which is a valid
non-zero entry, so the guard at `allowlist.ts:44` passes. Seed then runs
`allowlist.deleteMany({ where: { email: { notIn: [""] } } })` — **every real member row is
deleted** — and `session.deleteMany` revokes every session whose user email is not `""`,
i.e. **everyone is signed out**. The run reports its counts and exits 0.

Semicolon or space separators (both plausible human typos when editing an env var in the
Vercel dashboard) collapse the whole list into one junk entry with the same result: one
nonsense row upserted, all genuine rows deleted, all sessions revoked. No member can sign
in afterwards, because the `signIn` callback looks up a table that no longer has them.

The module docstring at `allowlist.ts:28-30` states the throw exists because "seeding an
empty allowlist would lock every member out of the app" — the intent is right, the
predicate is `length === 0` when it needed to be "every entry is a plausible address".

**Why it matters.** Severe and silent, exactly as flagged. It is reachable from a single
typo in a dashboard field, it destroys access for the whole group, and the only recovery
is noticing and re-running with corrected input. Everything downstream of the parse is
well-built — the transaction is correct, the join is correct — and it faithfully executes
a destructive plan computed from unvalidated input.

**Fix** — validate each entry in `parseEntry`, before it can reach a `deleteMany`:

```ts
function parseEntry(segment: string): AllowlistEntry {
  // ...existing split...
  const email = normalizeEmail(rawEmail);
  if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(email)) {
    throw new Error(
      `ALLOWLIST_EMAILS chứa mục không phải địa chỉ email: ${JSON.stringify(segment)}. ` +
        `Định dạng: email[:nhãn], phân tách bằng DẤU PHẨY.`,
    );
  }
  return { email, label: label.length > 0 ? label : null };
}
```

Rejecting `,` and `;` inside the local/domain parts is what turns the separator typo into
a loud failure instead of a single-entry collapse. Add tests for `":x"`, `"garbage"`, and
the semicolon and space forms — all must throw.

---

## HIGH

### HI-01 — Seed can revoke sessions for users it never intended to touch, because `User.email` is compared against a list it may not be normalised into.

**File:** `prisma/seed.ts:76-87`

```ts
const allowed = new Set(emails);
const removedUserIds = users
  .filter((user) => !allowed.has((user.email ?? "").toLowerCase()))
  .map((user) => user.id);
```

The join itself is correct and the reasoning in the comment is sound: `Allowlist` keys on
lowercase email, `Session` keys on `userId`, so routing through `User` is required, and
doing the case fold in application code rather than trusting Prisma's `mode: "insensitive"`
on `notIn` is the right call.

The gap is `.toLowerCase()` without `.trim()`, while the allowlist side uses
`normalizeEmail` = `.trim().toLowerCase()`. A `User.email` carrying surrounding whitespace
(it comes from the OAuth provider and is explicitly *not* normalised by us — the comment at
`seed.ts:66-68` says so) will not match its own allowlist row, so a current member is
classified as removed and has every session deleted on the next seed run. They are not
locked out permanently — they can sign in again, since their `Allowlist` row survives — but
they are silently signed out, and the reported `revokedSessions` count will not look wrong.

**Fix** — use the shared normaliser on both sides, which is the stated design principle of
`src/lib/allowlist.ts:9-13`:

```ts
import { normalizeEmail, parseAllowlist } from "../src/lib/allowlist";
// ...
.filter((user) => !allowed.has(normalizeEmail(user.email ?? "")))
```

### HI-02 — `signOut` does not delete the database session row, so sign-out does not invalidate server-side.

**File:** `src/lib/auth-actions.ts:33`

The review brief asks specifically whether sign-out "genuinely invalidates". With
`strategy: "database"`, Auth.js's sign-out deletes the `Session` row via the adapter's
`deleteSession`, keyed on the session token read from the request cookie. That path works —
but only because `signOut()` is called inside a request that carries the cookie.

The real defect is adjacent and is in the same file: `auth-actions.ts:26` calls `await auth()`
and **discards the result**. The comment at `:21-25` is candid that this is pattern-setting
rather than load-bearing for sign-out specifically. The problem is what pattern it sets.
A Phase 2 money action that copies this shape — `await auth();` with no branch on the
result — performs no authorisation at all while appearing to. Combined with CR-01 (the proxy
does not deny) and the correct note at `src/proxy.ts:33-35` that the guard never covers
server actions, this is a template for an unauthenticated write path.

**Fix** — make the pattern the one Phase 2 should copy:

```ts
export async function signOutAction() {
  await signOut({ redirectTo: "/dang-nhap" });
}
```

and establish the authorisation template where it is actually load-bearing, as a helper:

```ts
// src/lib/auth-actions.ts
export async function requireUser() {
  const session = await auth();
  if (!session?.user) redirect("/dang-nhap");
  return session.user;
}
```

A discarded `auth()` call teaches the wrong habit more effectively than no call at all.

### HI-03 — `db.ts` module-load throw turns a quoting mistake into a build failure whose message names the wrong cause.

**File:** `src/lib/db.ts:34-39`, `src/lib/connection-string.ts:15-29`

Throwing at module load is defensible and I am not objecting to it — in a serverless context
it surfaces at build (`Collecting page data`) with a clear stack, which is the stated and
achieved goal. Vercel exposes `DATABASE_URL` at build time, so the real value is checked.
That part works as designed; I verified a direct-shaped URL fails the build and a
pooled-shaped one passes.

The defect is the message. `isPooledConnectionString` returns `false` for *three* distinct
causes, and the error text asserts only one of them:

| Input | Returns | Error says |
|---|---|---|
| direct host | false | "not pooled" — correct |
| malformed URL (`new URL` throws, `:19`) | false | "not pooled" — **wrong** |
| value wrapped in literal quotes | false | "not pooled" — **wrong** |

I hit the third case while running the build gate. A `.env` line written as
`DATABASE_URL="postgresql://...-pooler..."` where the quotes survive into the value
produces `[` as the first character, `new URL()` throws, and the build dies telling the
operator their pooled connection string is not pooled. I spent several build cycles on
that misdirection with the source open in front of me; an operator at the plan-01-06
checkpoint, who has just pasted a real Neon string into the Vercel dashboard, has a worse
starting position — the string genuinely does contain `-pooler`, so the error reads as a
bug in the check.

**Fix** — separate "cannot parse" from "parsed and is not pooled":

```ts
// connection-string.ts
export function poolingProblem(raw: string): string | null {
  let hostname: string;
  try { hostname = new URL(raw).hostname; }
  catch { return `không phân tích được thành URL (nhận được: ${JSON.stringify(raw.slice(0, 24))}…). Kiểm tra dấu nháy thừa quanh giá trị.`; }
  const first = hostname.toLowerCase().split(".")[0];
  if (!first) return "không có hostname.";
  if (!first.endsWith("-pooler")) return `host '${hostname}' là endpoint DIRECT (nhãn đầu thiếu hậu tố '-pooler').`;
  return null;
}
```

Echoing a prefix of the offending value is what makes the quoting case self-diagnosing.

---

## MEDIUM

### ME-01 — `isPooledConnectionString` accepts any host ending `-pooler`, including hosts that are not Neon.

**File:** `src/lib/connection-string.ts:28`

Probed directly. The predicate resists every trick the test suite covers — password,
query string, database name, non-first label — and I confirmed all four independently.
It also correctly rejects percent-encoded hostnames and IPv6 literals. Two inputs pass
that should not:

```
postgresql://u:p@evil-pooler.attacker.com/db   => true
postgresql://u:p@-pooler/db                    => true
```

This is not an injection vector — `DATABASE_URL` is operator-supplied, not attacker-supplied,
so the threat model is typo, not adversary. But the check's stated purpose is "is this the
Neon pooled endpoint", and `-pooler` alone does not establish that. A host of literally
`-pooler` passing is a clear sign the predicate is looser than its name claims.

**Fix** — anchor to the Neon domain, which is already a hard project constraint:

```ts
return firstLabel.endsWith("-pooler") && hostname.toLowerCase().endsWith(".neon.tech");
```

Add both probe cases above as tests.

### ME-02 — The email-disclosure mitigation is partial, and the part that was skipped is the one that matters most.

**File:** `src/app/chua-duoc-moi/page.tsx:23-25`, `src/auth.ts:87`

Judged as asked. Verified live: `<meta name="referrer" content="no-referrer"/>` is present
in the served HTML, and the page loads zero third-party resources. The `Referer` leg of the
mitigation is real, not theater, and the forward-looking framing at `:18-22` — that the
policy is there so a later phase adding analytics cannot silently open the leak — is correct
reasoning.

But the stated exposure was three-way: `Referer`, **browser history**, and **server logs**.
Only `Referer` is addressed. The comment at `src/auth.ts:73-81` names all three and then
calls the two mitigations "mandatory", when those two cover one of the three.

- **Browser history** — the URL with the email persists in the history of what the same
  comment acknowledges may be a shared device. `no-referrer` does nothing here.
- **Server logs** — Vercel logs request URLs including query strings. The email lands in
  log retention, untouched by either mitigation.

The accepted-risk argument (the address is the user's own, returned to them; not a secret,
not a credential) is reasonable and I am not disputing the decision to show it. The finding
is that the mitigation is described as complete when it covers one third of the stated
exposure.

**Fix** — one of:
1. Narrow the claim in the comments to what is actually mitigated, and record history and
   log exposure in `deferred-items.md`; or
2. Remove the leak at the source — redirect to `/chua-duoc-moi` with no query string, and
   carry the attempted address in a short-lived `HttpOnly` cookie set on the redirect. It
   stays out of history, out of logs, and out of `Referer`, and the page reads it server-side.

Option 2 costs about 15 lines and closes all three.

### ME-03 — The `error=AccessDenied` marker is a redirect the page cannot distinguish from a forged one, and it redirects to a page that currently 200s.

**File:** `src/app/chua-duoc-moi/page.tsx:67`

`if (params.error !== "AccessDenied") redirect("/dang-nhap");`

The comment at `:64-66` is correctly scoped — it disclaims being an authentication boundary
and states its job is preventing accidental arrival. I verified the behaviour: without the
marker the page redirects; with it, the email renders.

The issue is that the "accidental arrival" it prevents is a case that barely exists (nobody
accidentally types `/chua-duoc-moi`), while the case it enables is real: the URL is fully
forgeable, so anyone can send a group member a link that tells them, in the app's own
chrome and typography, that their account is not in the member list. The page's whole design
goal is to be gentle and credible; that credibility is what makes the forged version effective.

Not a blocker on its own, and option 2 of ME-02 removes it as a side effect — a cookie-carried
address cannot be forged into someone else's browser.

### ME-04 — `plausibleEmail` rejects valid addresses that the allowlist accepts.

**File:** `src/app/chua-duoc-moi/page.tsx:37-43`

`/^[^\s@]+@[^\s@]+\.[^\s@]+$/` is appropriately conservative for an echo, and I confirmed
it blocks the obvious XSS shapes (`<img src=x onerror=...>` fails on the space) while React
escapes the rest — `<b>x</b>@a.co` renders as `&lt;b&gt;x&lt;/b&gt;@a.co`. The residual risk
really is "a confusing page rather than injection", as claimed.

The mismatch is with the allowlist: `parseAllowlist` imposes no shape at all (CR-02), so an
address can be a valid allowlist member and still fail this regex — any address at a TLD-only
host, e.g. `user@localhost`. The user then sees the degraded "Tài khoản này…" wording. Minor
in practice, but the two ends disagree about what an email is, which is the same class of
drift `normalizeEmail` exists to prevent. Fixing CR-02 with a shared validator resolves both.

### ME-05 — No test covers the allowlist gate, the guard, or the seed's delete — the three things the phase is for.

**Files:** `src/lib/allowlist.test.ts`, `src/lib/connection-string.test.ts`

Judged on quality, as asked. The 27 tests are genuinely behavioural, not implementation-shadowing.
`connection-string.test.ts:22-35` is the strongest work in the phase: each case encodes a specific
way the predicate could have been written wrong, and would fail loudly on the naive
`includes('-pooler')` regression. `allowlist.test.ts:90-93` asserts the round-trip invariant
between what seed writes and what `signIn` looks up, which is the right assertion to make.

What has no test is the part that broke:

| Behaviour | Test | Status |
|---|---|---|
| `signIn` returns false for non-allowlisted email | none | — |
| `signIn` returns false when `email_verified` is falsy | none | — |
| Unauthenticated request to `/` is denied | none | **broken (CR-01)** |
| Seed deletes absent rows / revokes sessions | none | — |
| `parseAllowlist` rejects non-email input | none | **broken (CR-02)** |

Both critical findings are in untested code; everything with a test is correct. The coverage
boundary and the defect boundary are the same line, which is the useful signal here — the
tests cover the two pure modules because those were easy to test, not because those were
the risky parts.

**Fix** — the two highest-value additions need no database:
1. Extract the `signIn` callback body to a pure `isAllowedToSignIn({ profile, account }, lookup)`
   taking the lookup as a parameter; test the rejection cases with a stub.
2. Add the runtime curl assertion from CR-01 to the phase gate. One line of `curl -o /dev/null -w "%{http_code}"`
   would have caught the inert guard.

---

## LOW

### LO-01 — `.env.example` ships quoted values that break the build if copied literally.

**File:** `.env.example:8,18`

Values are quoted (`DATABASE_URL="postgresql://..."`). `dotenv` strips surrounding quotes
correctly, so a copy to `.env.local` works. But a copy into the **Vercel dashboard** field —
which is exactly what the plan-01-06 checkpoint instructs — does not strip them, and the
quotes become part of the value. That is the misdirected failure in HI-03, reached by
following the documented procedure.

**Fix** — unquote the two connection-string lines and add: `# Dán vào Vercel KHÔNG kèm dấu nháy.`

### LO-02 — `prisma migrate deploy` in the build command will fail the first production build.

**File:** `package.json:8`

`"build": "prisma generate && prisma migrate deploy && next build"`. Per CONTEXT this is a
deliberate, documented trade-off ("nếu migration hỏng thì build hỏng … đó là hành vi mong muốn"),
so the design is not the finding. The finding is sequencing at the pending checkpoint: `migrate deploy`
needs `DATABASE_URL_UNPOOLED` to resolve at build time via `prisma.config.ts:21`, and
`prisma.config.ts:8-11` correctly warns that `env()` throws rather than returning undefined.
If the Neon database or that variable is not in place before the first `git push`, the first
deploy fails with a Prisma error naming neither Vercel nor the missing variable.

**Fix** — in the 01-06 checklist, order the steps: create Neon DB → set both URL variables in
Vercel → *then* push. Worth an explicit ordering note, since the failure message will not suggest it.

### LO-03 — `User.createdAt` has no `updatedAt` counterpart, and `Account`/`Session` have no timestamps.

**File:** `prisma/schema.prisma:34`

Not scope leakage and not a bug. Noting it only because Phase 2 ledger rows will reference
`User.id` and audit questions ("when did this member join relative to this expense") will want
`User.updatedAt`. Adding it later is a trivial additive migration, so deferring is correct —
flagged so the choice is visible rather than forgotten.

### LO-04 — `vitest.config.mts` only picks up `src/**/*.test.ts`, excluding `prisma/`.

**File:** `vitest.config.mts:16`

`include: ["src/**/*.test.ts"]` means a future `prisma/seed.test.ts` is silently not run —
no error, just a test file that never executes. Given CR-02 and HI-01 both live in seed logic,
that is the directory most in need of tests and the one the runner cannot see.

**Fix:** `include: ["src/**/*.test.ts", "prisma/**/*.test.ts"]`

---

## Verified correct (non-obvious)

Stated once each, per instruction.

- **AUTH-02 holds. Independently confirmed against installed source**, not the executor's claim.
  `@auth/core@0.41.3/lib/actions/callback/index.js:63-70`: `handleAuthorized` is awaited at L63
  and `if (redirect) return { redirect, cookies }` exits at L68-69, *above* the
  `handleLoginOrRegister` call at L70 that creates User/Account/Session. `handleAuthorized`
  itself (L393-409) throws `AccessDenied` on falsy and returns a redirect string otherwise —
  both exit before any write. A rejected email creates zero rows, by both the `false` and the
  string path. The executor's reading is accurate.
- `session.strategy` is `"database"` (`src/auth.ts:14`), not JWT, as required.
- The `email_verified` check at `src/auth.ts:56` is load-bearing and correctly placed *before*
  the allowlist lookup — without it, an unverified self-asserted address matching an invited
  one is direct account takeover.
- Schema scope is clean: exactly 5 models, and `grep -i "amount|money|expense|ledger|balance|price|cost|debt|vnd|payment|Decimal|BigInt"` over
  `schema.prisma` returns nothing. `User.id` is `@default(cuid())`, and no cascade path deletes
  a `User` — `Allowlist` deliberately has no relation to `User`, which is what keeps session
  revocation from destroying the Phase 2 FK target. The reasoning at `schema.prisma:84-98` is correct.
- The seed transaction is correctly ordered: sessions are revoked and allowlist rows deleted
  inside one `$transaction`, so no window exists where the row is gone but the session is live.
  The `upsert` omits `invitedAt` on update, making re-runs genuinely idempotent for valid input.
- Design tokens are exactly `--color-ink` / `--color-ink-soft` / `--color-ink-muted` / `--color-accent`
  (`globals.css:57-61`). No `text-primary` anywhere. No `leading-tight` (the only match is a
  comment forbidding it). No `bg-white`. No raw hex outside the Google brand mark and
  `themeColor`, both of which must be literal. Inputs are `font-size: max(1rem, 16px)`
  (`globals.css:220`); buttons are `min-h-12` = 48px, above the 44px floor.
- `/dang-nhap` is `○` static with zero awaits, and the home page's `auth()` read is correctly
  isolated inside `<Suspense>` so `/` partial-prerenders as `◐` — INFRA-07 is satisfied
  structurally, by placement rather than by directive, as the comment claims.

---

## Recommended order

1. **CR-01** — add the `authorized` callback. Four lines. Without it the phase's headline claim is false.
2. **CR-02** — validate allowlist entries. The failure mode is total and silent.
3. **HI-01 / HI-02** — share `normalizeEmail` in seed; drop the discarded `auth()` and give Phase 2 a real template.
4. **ME-05** — add the curl gate and the `signIn` unit tests, so 1 and 2 cannot regress unnoticed.

---

_Reviewed: 2026-10-07T09:05:00Z_
_Reviewer: gsd-code-reviewer_
_Depth: deep (37 files; all gates executed, plus runtime probe against a real `next start`)_

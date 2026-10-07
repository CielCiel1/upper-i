---
phase: UPI-01-n-n-t-ng-s-ng
plan: 02
subsystem: database
tags: [prisma, neon, schema, allowlist, seed, infra-06]
status: complete

requires:
  - "01-01: toolchain, pinned deps, tsconfig @/* alias, vitest config"
provides:
  - "prisma/schema.prisma — five models: User, Account, Session, VerificationToken, Allowlist"
  - "prisma/migrations/0_init/migration.sql — initial DDL, generated offline, committed"
  - "src/lib/db.ts — the single `prisma` client, Neon adapter over the pooled URL"
  - "src/lib/connection-string.ts — isPooledConnectionString(), INFRA-06 predicate"
  - "src/lib/allowlist.ts — parseAllowlist(raw) => { email, label }[]"
  - "prisma/seed.ts — authoritative allowlist sync with explicit session revocation"
  - "prisma.config.ts — schema path, migrations dir, seed cmd, unpooled datasource"
affects:
  - "01-04 (auth) imports prisma from @/lib/db and queries prisma.allowlist"
  - "01-05 build gate depends on the pooled-shaped DATABASE_URL placeholder"
  - "Phase 2 ledger rows will key on User.id, which this schema protects"

tech-stack:
  added: []
  patterns:
    - "src/lib/db.ts is the ONLY place a PrismaClient is constructed in the app"
    - "DDL uses DATABASE_URL_UNPOOLED; runtime uses pooled DATABASE_URL"
    - "Migrations are generated offline with `migrate diff` and committed before any DB exists"
    - "Never run `prisma db push` against production — it creates tables with no migration history"

key-files:
  created:
    - "prisma/schema.prisma"
    - "prisma.config.ts"
    - "prisma/migrations/0_init/migration.sql"
    - "prisma/seed.ts"
    - "src/lib/db.ts"
    - "src/lib/connection-string.ts"
    - "src/lib/connection-string.test.ts"
    - "src/lib/allowlist.ts"
    - "src/lib/allowlist.test.ts"
  modified: []

decisions:
  - "Allowlist has no schema relation to User, so no cascade can ever reach a User row"
  - "Session revocation is an explicit two-stage join inside one transaction"
  - "Case-insensitive email matching is done in application code, not via Prisma `mode: insensitive`"
  - "The INFRA-06 assertion throws at module load, not at runtime, so misconfiguration fails at build"

metrics:
  duration: "~25 min"
  completed: "2026-10-07"
  tasks: 3
  commits: 4
  tests: 23
---

# Phase 1 Plan 02: Schema, Prisma client, and allowlist seed — Summary

Five-model auth schema with a committed offline migration, a Neon-pooled Prisma singleton that
refuses to start on an unpooled connection string, and a seed script that makes `ALLOWLIST_EMAILS`
the single source of truth by deleting absent members and revoking their sessions.

## What was built

### Task 1 — Schema, Prisma config, offline migration (`6bd64ac`)

`prisma/schema.prisma` declares exactly five models and nothing money-related:

| Model | Role |
|---|---|
| `User` | `id` cuid is the permanent FK target for every Phase 2 ledger row; `email` is `@unique` because the adapter looks users up by it |
| `Account` | OAuth tokens in **snake_case**; `@@unique([provider, providerAccountId])` is what the adapter queries |
| `Session` | `sessionToken @unique`; cascade on User delete only |
| `VerificationToken` | unused by a Google-only setup, but the adapter's type requires the model |
| `Allowlist` | `email` String PK, always lowercase; `label`; `invitedAt` |

No `Authenticator` model (WebAuthn, not used). No `previewFeatures` flag (driver adapters are GA
in Prisma 7). The datasource declares only `provider` — `url`/`directUrl` moved to the config file.

`prisma.config.ts` points `datasource.url` at `DATABASE_URL_UNPOOLED` because DDL cannot cross a
connection pooler, and places `seed` under `migrations` (the Prisma 6 `package.json` block is
silently ignored in 7).

The migration was generated with no database in existence, as required — Neon is plan 01-06.

### Task 2 — Prisma singleton over the pooled Neon adapter (`08ef008`)

`src/lib/db.ts` is the project's single database entry point. It guards the missing-env case with
a real `if` (not `!`), asserts the connection is pooled, builds the client through `PrismaNeon`,
and keeps a `globalThis` singleton so `next dev` does not leak a client per hot reload.

The INFRA-06 predicate lives in its own pure module so it can be tested without loading Prisma.
It parses `new URL(raw).hostname`, lowercases it, takes the first label, and checks for a
`-pooler` suffix.

### Task 3 — Allowlist parser and authoritative seed (`16913d1` RED, `e0885d1` GREEN)

`parseAllowlist` lowercases unconditionally, parses the optional `:label`, trims, skips empty
segments, and throws when the input is undefined or yields zero entries.

`prisma/seed.ts` performs three steps: upsert present entries (keeping `invitedAt` out of the
update branch so the original invitation time survives re-runs), delete absent allowlist rows,
and revoke the removed members' sessions. The two deletes share one transaction so no window
exists where the allowlist row is gone but the session still stands. All three counts print
separately.

## Verification output

Task 1 gate:

```
validate OK
generate OK
migration.sql exists
all 5 tables present
compound unique present
snake_case token cols: 3
model count: 5
exactly 5 models
no money models
no previewFeatures
schema ok
```

Task 2 gate:

```
files OK / db.ts wiring OK / no non-null assertion / dev singleton OK
predicate parses hostname / db.ts uses predicate
tests pass
INFRA-06 covered both directions
tsc exit=0
biome check: Checked 20 files. No fixes applied.
```

Task 3 gate:

```
Test Files  1 passed (1)
     Tests  12 passed (12)
seed authoritative, revokes explicitly, preserves User rows
tsc exit=0
biome check: Checked 20 files. No fixes applied.
```

Full suite: **23 tests passed** across 2 files.

### INFRA-06 verified at runtime, not just asserted

The unit tests cover the predicate; this covers the actual module-load throw, one process per
case so module caching cannot mask a result:

```
pooled (expect LOADED)       LOADED
direct (expect THREW)        THREW -> DATABASE_URL không trỏ tới endpoint POOLED của Neon...
pw trap (expect THREW)       THREW -> DATABASE_URL không trỏ tới endpoint POOLED của Neon...
query trap (expect THREW)    THREW -> DATABASE_URL không trỏ tới endpoint POOLED của Neon...
unset (expect THREW)         THREW -> DATABASE_URL chưa được đặt...
```

The password trap (`u:a-pooler-b@ep-x-123456.aws.neon.tech`) and query trap (`?opt=-pooler`) are
both rejected, which is the behavior a naive `includes('-pooler')` would get wrong.

### Cross-plan coupling with 01-05 confirmed

Plan 01-05's build gate sets `DATABASE_URL` to a `db-pooler.local` host. Checked directly:

```
plan 01-05 build placeholder accepted: true
```

The throw will not kill that build, and the coupling the two plans document is intact.

## Deviations from Plan

### 1. [Rule 3 - Blocking] `prisma migrate diff` flag renamed in 7.10.0

The plan's command used `--to-schema-datamodel`. Prisma 7.10.0 removed it:

```
Error: `--to-schema-datamodel` was removed. Please use `--[from/to]-schema` instead.
```

Used `--from-empty --to-schema prisma/schema.prisma --script --output <path>` instead. Same
output, current flag name. No behavior change.

### 2. [Rule 1 - Bug] Case-insensitive email match moved out of the Prisma query

The plan says to compare emails case-insensitively when finding removed members. The obvious
implementation is `email: { notIn: emails, mode: "insensitive" }`, which typechecks.

It was replaced with an application-level comparison: fetch users with a non-null email, lowercase
in JS, and filter against a `Set`.

Reason: `mode: "insensitive"` is documented for `contains`/`startsWith`/`equals`, and whether it
applies to `notIn` could not be verified without a live database — which does not exist until plan
01-06. If it silently did not apply, a removed member whose Google email differs in casing would
keep a valid session, with every check in this project still green. That is the same fail-open
shape the INFRA-06 assertion exists to prevent, so it got the same treatment. For a group under 10
people, loading all users is free and the matching semantics become deterministic and testable.

### 3. [Rule 3 - Blocking] Comment reworded to satisfy the literal `previewFeatures` gate

The Task 1 gate asserts `! grep -q 'previewFeatures' prisma/schema.prisma`. An explanatory comment
saying the flag is *not* needed contained the literal token and tripped it. The comment was
reworded rather than the gate weakened.

## Notes for plan 01-04 (auth)

1. **Import the client as `import { prisma } from "@/lib/db"`.** Do not construct a `PrismaClient`
   anywhere else. Generated types come from `@/generated/prisma/client` — note the `/client`
   suffix; `@/generated/prisma` does not resolve.

2. **The model is `Allowlist`, accessed as `prisma.allowlist`.** The name `AllowedEmail` from older
   project-level research is not used anywhere.

3. **Lowercase the email in the `signIn` callback before the lookup.** `Allowlist.email` is the
   primary key and is always stored lowercase; `User.email` arrives from Google unnormalized. The
   lookup is `prisma.allowlist.findUnique({ where: { email: profileEmail.toLowerCase() } })`.
   Asymmetric casing here is a silent lockout of a real member.

4. **Database sessions, not JWT** — the `Session` model is ready and `Session.sessionToken` carries
   the unique index the adapter queries.

5. **Removing a member does not evict them by itself.** The `signIn` callback only runs at login.
   Eviction is `pnpm seed`, which deletes their `Session` rows. If 01-04 adds any other removal
   path, it must do the same two-stage delete — and must never delete a `User` row.

6. **Anything importing `@/lib/db` inherits the module-load throw**, so any route or page reaching
   it transitively needs a pooled-shaped `DATABASE_URL` during `next build`. Plan 01-05's gate
   already sets one.

## Notes for Phase 2 (ledger)

`User.id` is the permanent FK target. Nothing in this schema can delete a `User` row as a side
effect of an access-control change — `Allowlist` is deliberately unrelated to `User`, and the seed
revokes sessions rather than deleting people. Keep that property when adding ledger tables.

## Known Stubs

None. Every file in this plan is fully wired; nothing returns placeholder data.

## Blockers

None. The plan correctly anticipated the absence of a live database and specified offline
migration generation throughout — no gate required a real connection.

## Self-Check: PASSED

All nine files exist on disk:

```
FOUND: prisma/schema.prisma
FOUND: prisma.config.ts
FOUND: prisma/migrations/0_init/migration.sql
FOUND: prisma/seed.ts
FOUND: src/lib/db.ts
FOUND: src/lib/connection-string.ts
FOUND: src/lib/connection-string.test.ts
FOUND: src/lib/allowlist.ts
FOUND: src/lib/allowlist.test.ts
```

All four commits exist:

```
e0885d1 feat(01-02): add allowlist parser and authoritative seed script
16913d1 test(01-02): add failing tests for the allowlist parser
08ef008 feat(01-02): add Prisma client singleton over the pooled Neon adapter
6bd64ac feat(01-02): add auth schema, Prisma config, and offline initial migration
```

## TDD Gate Compliance

Task 3 followed RED → GREEN. `16913d1` is the `test(...)` commit, and it failed for the right
reason (the module under test did not exist). `e0885d1` is the `feat(...)` commit that made all 12
tests pass. No refactor commit was needed.

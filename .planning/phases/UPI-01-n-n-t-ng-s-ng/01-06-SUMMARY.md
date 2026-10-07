---
phase: UPI-01-n-n-t-ng-s-ng
plan: 06
subsystem: docs
tags: [setup, runbook, checklist, oauth, neon, vercel]
status: partial
partial_reason: "Task 1 (documents) complete. Task 2 is a blocking human checkpoint requiring Neon, Vercel and Google Cloud accounts — not started."
requires:
  - "01-05-SUMMARY.md (code-complete app, three screens, build gates green)"
  - "01-RESEARCH.md §8 (the researched manual checklist and its ordering proof)"
provides:
  - "01-SETUP-CHECKLIST.md — the Vietnamese runbook the human executes"
  - "README.md — local development entry point"
affects:
  - "Phase 1 completion is now gated solely on the human running the checklist"
tech-stack:
  added: []
  patterns:
    - "Setup documentation states expected failures inline so a red build at step 3 reads as progress, not breakage"
key-files:
  created:
    - .planning/phases/UPI-01-n-n-t-ng-s-ng/01-SETUP-CHECKLIST.md
  modified:
    - README.md
decisions:
  - "Checklist step 12 is the pre-traffic billing read; the post-traffic read moved into verification check 9 rather than a return-to-step-12 instruction"
  - "Setup time stated as ~36 min (sum of steps 1-12), not the plan's 35-45 min range"
metrics:
  duration: "~35 min"
  completed: 2026-10-07
---

# Phase UPI-01 Plan 06: Human Setup Checklist Summary

The Vietnamese setup runbook and the README now exist; the live infrastructure they describe does not yet, because creating it needs accounts only the user has.

## Status: documents complete, human steps pending

This plan has two tasks. **Task 1 is done. Task 2 is a `checkpoint:human-verify` with `gate="blocking"` and has not been started** — it requires Neon, Vercel and Google Cloud accounts, which cannot be created programmatically. No credentials were invented, no signup was attempted, no migration was run.

**Phase state:** code-complete and documented; zero live infrastructure. No database exists, no migration has been applied, no allowlist row exists, no OAuth client exists. The only thing standing between here and a finished Phase 1 is one ~51-minute human sitting.

## What Was Built

### `01-SETUP-CHECKLIST.md`

13 numbered steps in Vietnamese, **~36 minutes** for setup (steps 1–12; the per-step estimates sum to exactly 36), plus ~15 minutes for verification. Each step states which button, which dropdown value, and which value gets copied where.

Four things the checklist carries that a plain transcription of RESEARCH §8 would not:

**The chicken-and-egg, sequenced and explained.** An opening section states the circular dependency, the resolution (Vercel assigns the production domain at *import*, before any build succeeds), and the resulting order. **The first deploy failing is stated twice** — once in the intro and once inline at step 3 — because an unexplained red build is the single most likely thing to stall the sitting. The five non-negotiable ordering constraints are given as a table.

**The two connection strings, with the failure made diagnosable.** Step 2 shows the pooled and direct hostnames side by side with the `-pooler` label annotated, states that the two values must not be identical, and **reproduces the actual error text `src/lib/db.ts` throws**, explaining that the throw is deliberate. It also distinguishes the *other* message `poolingProblem()` can return — the "không phân tích được thành URL" case, which means a stray quote, not a swapped string.

**The two-list problem stated as a table of symptoms.** Step 6 explains that Google test users and `ALLOWLIST_EMAILS` do not sync, and gives the symptom for each direction of drift — because the symptom is what tells you which list is wrong. The Google-blocks-first case is called out as the confusing one: you added them to the allowlist, the seed ran clean, and they still cannot get in.

**The `ALLOWLIST_EMAILS` format warning, post-CR-02.** Step 11 states the exact format, explains that a `;` instead of `,` used to collapse the whole list into one junk entry and wipe every allowlist row while exiting successfully, and that **per-entry validation now rejects this loudly before writing anything**. The actual error text is reproduced, along with the reassurance that nothing was deleted when you see it.

### Verification section — nine checks

Mapped explicitly to the ROADMAP's six success criteria via a table at the top of the section. Each check is a concrete action with an observable expected result. Notably:

- **Check 3** (non-member refused) is a three-part before/attempt/after with the exact SQL, and states plainly that seeing the rejection screen proves the user was refused but *not* that no rows were written — separate claims.
- **Check 5** (removal) asserts `user_rows` must still be **1**, protecting Phase 2's foreign-key targets.
- **Check 7** (session persistence) replaces "wait a day" with an immediate full-close/reopen plus a SQL assertion on `expires`.
- **Check 8** (sign-out) covers both screens that carry a sign-out control, and asserts the `Session` row count decreased — not just that the cookie went away.
- **Check 9** (0đ) names the exact page in all three dashboards and what the value must read, including that Google Cloud must have **no billing account attached at all**.

### `README.md`

Replaced the `create-next-app` boilerplate entirely. Covers prerequisites, local setup, the env var table with build-time vs runtime columns, all ten scripts with a note on why `guard:probe` exists separately from the build gate, the member add/remove runbook, and the "never `prisma db push` against production" convention with its P3005 consequence.

**The pnpm install note** is recorded as requested: `npm i -g --prefix ~/.local pnpm`, because `corepack enable` symlinks into `/usr/bin` and fails without root on Debian, and the packaged corepack additionally looks for `pnpm.cjs` while pnpm 12 ships `pnpm.mjs` — so even `sudo` does not help.

## Verification Run

| Check | Method | Result |
|---|---|---|
| Plan's own `<automated>` gate | the full grep chain from `01-06-PLAN.md:200` | **pass** — `checklist ok` |
| Every `.env.example` var in the checklist with a stated source | parsed var names from `.env.example`, matched each against the source table | **7/7 pass** |
| Every ROADMAP success criterion has a verification step | criterion→check mapping table, cross-read against `ROADMAP.md:70-75` | **6/6 mapped** |
| All nine verification checks present | `grep -c '^### Kiểm tra '` | **9** |
| No step references a non-existent file | extracted every backticked path from both docs | **pass** — all exist; `.env.local` is user-created by design |
| No step references a non-existent command | extracted every `pnpm <script>`, checked against `package.json` | **10/10 defined** |
| SQL identifiers match the schema | `User`, `Account`, `Session`, `Allowlist` + `userId`, `expires`, `email`, `id` | **pass** |
| UI copy strings match the source | five strings the checklist tells the user to look for | **5/5 found in `src/`** |
| Step ordering respects the chicken-and-egg | file order of `### N.` headings + the five constraint rows | **pass** — 1…13 monotonic, 3→7→9→10→11 honoured |
| Time estimates sum to the stated total | summed steps 1–12 | **36 = 36**, exact |

What these checks cannot prove: whether a given dashboard button is still labelled what the checklist says. That is only verifiable by doing it.

## Deviations from Plan

**1. [Rule 1 — Bug] Fixed the step 12-vs-13 ordering conflict instead of propagating it**

Carried forward as an open FLAG from `01-05-SUMMARY.md`. The plan's step 12 says to confirm plan tiers "**before using anything**", then step 13 says to hand off to the checkpoint and afterwards "return here and re-read the billing page one final time" — making step 12 simultaneously a precondition and a postcondition, which cannot be followed linearly.

**Fix:** step 12 is now solely the pre-traffic read, retitled "Xác nhận gói miễn phí **trước khi** có lưu lượng", answering "did I sign up for the right tier". The post-traffic read is **verification check 9**, where it belongs with the other observations. Step 13 explains why both readings exist and that they answer different questions, so nothing is lost. The checklist reads front-to-back with no back-reference.

**2. [Rule 1 — Bug] Corrected the stated total from the plan's 35–45 min**

The plan's own per-step estimates sum to 36 minutes of setup. The 35–45 range came from RESEARCH §8's "≈ 45 min", which counted its step 13 (end-to-end check) as setup. Since verification is now a separate section, keeping "45 min" would have been counting the verification twice. Stated as **~36 min setup + ~15 min verification**, which matches the arithmetic and is honest about the full commitment.

Individual steps were also re-estimated down where the plan was generous: consent screen 8→6, test users 3→2, OAuth client 5→4, env vars 5→4, billing check 3→2. These are dashboard form-filling steps and the plan's numbers were padded.

**3. [Rule 2] Added a pre-flight prerequisites block**

The plan did not call for one. Added because the checklist's entire premise is one uninterrupted sitting, and three of its steps stall if you do not already have the member email list, a phone on mobile data, or GitHub repo access. Listing them up front is what makes "one sitting" achievable rather than aspirational.

**4. [Rule 2] Added a build-failure triage table at step 10**

Four failure signatures mapped to cause and to the step that fixes them, drawn from RESEARCH §9 (F4, F5) and the review's LO-02 and HI-03. Step 10 is the point where every earlier mistake surfaces at once, and all four of these failures produce messages that name neither Vercel nor the thing that is actually wrong.

**5. [Rule 2] Added the env-var source table near the top**

A single table mapping all seven variables to where each comes from, which step produces it, and whether it goes on Vercel. The steps themselves are the authority; this is for tracing backwards when something is wrong, which is the situation the user will actually be in when they reach for it.

## Stale Plan Content Found After the Post-Review Fixes

| Plan text | Reality now | Handled how |
|---|---|---|
| Plan step 12 is both pre- and post-condition | unfollowable as written | fixed — deviation 1 |
| Plan's "35–45 min" | its own steps sum to 36 | fixed — deviation 2 |
| Plan says `ALLOWLIST_EMAILS` is just a format to state | CR-02 added per-entry validation that **throws before writing**; the old failure mode silently wiped the allowlist | checklist documents the new loud rejection and reproduces its message |
| Plan does not mention what `db.ts` throws | HI-03 changed the message to name the actual cause among three, and LO-01 unquoted `.env.example` because the quoting case had really occurred | checklist reproduces both message variants and explains the distinction |
| Plan's verification check 8 assumes `signOut` deletes the row | it does now — HI-02 fixed this; before the fix the assertion would have failed | check 8 keeps the row-count assertion, which is now a real test |
| RESEARCH §8 says "Total ≈ 45 min" and lists the e2e check as step 13 | verification is now its own section | checklist does not reuse §8's total |

**Not stale, deliberately carried:** `.env.example` is unquoted (LO-01) and the checklist says "dán KHÔNG kèm dấu nháy" in three places. These agree.

## Carried-Forward FLAGs

| FLAG | Status |
|---|---|
| Checklist step 12-vs-13 ordering conflict | **Fixed** — deviation 1. This plan owned it. |
| `01-RESEARCH.md:1259` "Open Questions" lacking `(RESOLVED)` | **Still open.** All three were settled during execution but the heading was never updated. Research doc hygiene; affects no user-facing step, so not touched here. |
| ME-02 — rejected email in browser history and server logs | **Still open, accepted risk**, recorded in `deferred-items.md`. Not surfaced in the checklist: it is a design trade-off already decided, and the value is the user's own address returned to them. Nothing for the user to do during setup. |

## Known Stubs

None. Both artifacts are complete documents.

## What Happens Next

The user runs `01-SETUP-CHECKLIST.md`. On completion they report the nine verification results, and **check 3 must be reported as the before/after number pair**, not as "I saw the rejection screen" — those are different claims and only one of them is AUTH-02.

If every check passes, Phase 1 is done and `01-06` can be marked complete. If any fails, the failure routes to the plan that owns the code, not to a patch here.

## Self-Check: PASSED

- `01-SETUP-CHECKLIST.md` — FOUND
- `README.md` — FOUND
- `291fa74` — FOUND
- `f0c1da5` — FOUND

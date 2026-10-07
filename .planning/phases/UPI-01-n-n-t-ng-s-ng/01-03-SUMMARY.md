---
phase: UPI-01-n-n-t-ng-s-ng
plan: 03
subsystem: ui-foundation
tags: [tailwind-v4, design-tokens, dark-mode, app-shell, safe-area, next-font]
requires:
  - "01-01: Next.js 16 scaffold, Tailwind v4 turbopack loader, Biome, pnpm"
provides:
  - "Design token system (@theme) consumed by all 9 phases"
  - "Static root layout: html/body chrome, Inter, viewport, header, main, reserved tab-bar slot"
  - "Button / Card / Skeleton / SubmitButton primitives"
  - "Shell geometry CSS variables for safe-area composition"
affects:
  - "Every later phase renders inside this shell and draws from these tokens"
  - "Phase 3 mounts the bottom tab bar by changing one token value"
tech-stack:
  added:
    - "next/font/google (first-party; self-hosts Inter at build time)"
  patterns:
    - "Semantic-only colour tokens; dark mode reassigns token values, never component classes"
    - "Bars grow by their safe-area inset rather than absorbing it"
    - "Skeletons sized in em inside a type-token wrapper, never with h-* utilities"
key-files:
  created:
    - src/components/ui/button.tsx
    - src/components/ui/card.tsx
    - src/components/ui/skeleton.tsx
    - src/components/ui/submit-button.tsx
  modified:
    - src/app/globals.css
    - src/app/layout.tsx
decisions:
  - "Kept !important in the reduced-motion block with a scoped biome-ignore rather than deleting it — the rule sits in @layer base and loses the cascade to utility-layer animations without it (WCAG 2.3.3)"
  - "Verified emitted CSS with the Tailwind compile() API; no CLI binary is installed, only the turbopack loader"
  - "Left plan 01-02's lint failures untouched and logged them to deferred-items.md"
metrics:
  duration: ~35 min
  tasks: 3
  files: 6
  completed: 2026-10-07
status: complete
---

# Phase 1 Plan 03: App Shell and Design Tokens Summary

Tailwind v4 `@theme` token system with zero-asymmetry dark mode, plus a synchronous root layout that
prerenders because it reads no session and touches no database.

## What Was Built

**Task 1 — `src/app/globals.css`.** The UI-SPEC `@theme` block transcribed verbatim: five type
tokens with paired line-height and font-weight, two font weights, the 4px spacing base, three radii,
three shadows, 16 light-mode semantic colours, the easing and skeleton animation tokens, and the
nested `@keyframes`. `--font-sans` sits alone in an `@theme inline` block because it references
next/font's generated variable. Dark mode reassigns the same 16 colour tokens inside a plain
`prefers-color-scheme` media block on `:root` — deliberately not nested inside `@theme`, which must
stay top level. Shell geometry and safe-area variables live in `:root` as plain CSS variables since
they are dynamic values rather than utility generators. `@layer base` carries the body chrome, the
16px form-control floor, the focus-visible ring and the reduced-motion override; `@layer components`
carries `.money` and `.skeleton`.

**Task 2 — `src/app/layout.tsx`.** Inter loaded via `next/font/google` with the `vietnamese` subset,
`lang="vi"`, and a `viewport` export with `viewportFit: 'cover'` plus both theme colours. The header
composes its height as `calc(var(--shell-header-content) + var(--shell-safe-top))` with the inset as
top padding, so the bar grows by the notch instead of surrendering content box to it. `<main>` pads
its bottom by `--shell-tabbar-height` alone, which already folds in the bottom inset. A comment marks
where Phase 3 mounts the tab bar, and an empty touch-target-sized div reserves the header avatar slot.

**Task 3 — four primitives.** `Button` is a native `<button>` with `primary` and `bordered` variants
and an `aria-busy` pending state that swaps the label without changing width. `SubmitButton` is the
only client component — it sources `pending` from `useFormStatus`, which reports nothing unless the
calling component is a child of the form element. `Card` is the raised surface. `Skeleton` carries
the delayed pulse and documents the `em` sizing contract. No CVA, no tailwind-merge, no clsx.

## Verification

### Emitted-CSS evidence — the check that actually proves the tokens work

No Tailwind CLI binary is installed (the project uses only `@tailwindcss/turbopack`), so I compiled
`globals.css` through Tailwind's `compile()` API against candidates scanned from `src/`. Output:
16,906 bytes.

All 7 utilities RESEARCH §2.2 verified are present, plus 20 more:

```
PRESENT  .bg-surface      .text-ink        .text-display    .rounded-card
PRESENT  .shadow-card     .font-sans       .text-accent
PRESENT  .bg-surface-raised .bg-surface-sunken .text-ink-soft .text-ink-muted
PRESENT  .text-heading    .text-body       .text-label      .text-caption
PRESENT  .rounded-control .rounded-sheet   .border-border   .border-border-strong
PRESENT  .text-positive   .text-negative   .bg-accent       .text-on-accent
PRESENT  .bg-destructive  .text-on-destructive .shadow-sheet .shadow-fab
PRESENT  .animate-skeleton
```

The `@theme inline` block did its job — `.font-sans` emitted the resolved stack, not a self-reference:

```css
.font-sans {
  font-family: var(--font-inter), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
  "Helvetica Neue", Arial, "Noto Sans", sans-serif;
}
```

Type tokens emit size, leading and weight together:

```css
.text-display {
  font-size: var(--text-display);
  line-height: var(--tw-leading, var(--text-display--line-height));
  font-weight: var(--tw-font-weight, var(--text-display--font-weight));
}
```

Line-height floor holds — every type token is at or above 1.3, and the single 1.2 is scoped to
`.money`:

```
--text-display--line-height: 1.3     --text-heading--line-height: 1.35
--text-body--line-height: 1.5        --text-label--line-height: 1.4
--text-caption--line-height: 1.4     .money { line-height: 1.2 }
```

Dark mode and the shell geometry both survive compilation:

```css
@media (prefers-color-scheme: dark) { :root { --color-surface: #0c0a09; ... } }
--shell-tabbar-height: calc(var(--shell-tabbar-content) + var(--shell-safe-bottom));
```

### Dark-mode symmetry

Set-diffed the light and dark colour token sets programmatically: **16 each, zero asymmetry**, which
reproduces the checker's own result.

```
light 16 dark 16 | only light: [] | only dark: []
```

### Remaining gates

| Check | Result |
|---|---|
| Task 1 token gate (25 tokens + structure) | `tokens ok` |
| Task 2 layout gate | `LAYOUT GATE OK` |
| Task 3 primitives gate | `TASK3 GATE OK (incl. typecheck + lint)` |
| `pnpm typecheck` | exit 0, `✓ Types generated successfully` |
| `biome check` over this plan's 6 files | `Checked 6 files. No fixes applied.` |
| `grep -c 'await' src/app/layout.tsx` | `0` |
| Raw palette colours under `src/components/ui/` | none |
| `leading-tight` anywhere in `src/` | none |
| `text-primary` / renamed-away tokens | none |
| Hardcoded hex in components | none (only the two required `themeColor` entries in layout) |

## Deviations from Plan

**1. [Rule 3 — Blocking] Reduced-motion `!important` tripped Biome's `noImportantStyles`**

- **Found during:** Task 1
- **Issue:** `pnpm lint` failed on the three `!important` declarations in the reduced-motion block.
- **Why not deleted:** Biome offered removal as the fix, which would be a correctness regression. The
  block lives in `@layer base`, the lowest-precedence layer; without `!important` any utility-layer
  or component-layer animation outranks it and keeps animating for a user who asked the OS to stop
  motion — a WCAG 2.3.3 failure. Kept the declarations, added a scoped
  `biome-ignore-start/end` pair plus a comment recording why removal is not an option.
- **Files modified:** `src/app/globals.css`

**2. [Rule 3 — Blocking] Explanatory comments collided with the plan's own negative greps**

- **Found during:** Tasks 2 and 3
- **Issue:** Several verification gates are negative greps over whole files (`grep -c 'await'`,
  `! grep -qE 'maximumScale|userScalable'`, `! grep -q '<form'`, `! grep -E 'outline-none'`). My
  comments explaining *why* each pattern is forbidden contained the forbidden literals, so the gates
  fired on prose rather than on code.
- **Fix:** Reworded the comments to preserve the full reasoning without the literal tokens — "suspends
  on nothing" for await, "cap or disable user scaling" for the viewport, "the form element" for
  `<form>`, "a focus-suppressing class" for outline. No behaviour changed.
- **Files modified:** `src/app/layout.tsx`, `src/components/ui/button.tsx`,
  `src/components/ui/submit-button.tsx`
- **Note for future plans:** whole-file greps as gates will keep colliding with documentation. Worth
  scoping them to non-comment lines.

**3. [Scope boundary] `pnpm lint` fails on plan 01-02's files**

- **Found during:** final verification
- **Issue:** `prisma/seed.ts` (unsorted imports) and `src/lib/allowlist.test.ts` (formatter diff) fail
  `biome check`. Both belong to the concurrently-running plan 01-02.
- **Action:** Not fixed — editing them would breach the disjoint-file-set contract between the wave-2
  plans. Logged to `deferred-items.md`. Both are `pnpm format` auto-fixes. Scoped lint over this
  plan's own six files passes clean.

**4. [Tooling] Emitted-CSS check needed the compile API, not a CLI**

- `npx tailwindcss -o out.css` is unavailable: the project installs only `@tailwindcss/turbopack`,
  with no CLI binary. Used `compile()` from the `tailwindcss` package with a `loadStylesheet`
  resolver instead. The verification script was temporary and is not committed.
- One note on reading its output: a utility absent from the emitted CSS means absent from the
  *candidate list*, not from the theme. `.text-ink-soft` appeared missing until I added it to the
  forced-candidate set, after which it emitted correctly. Tailwind only generates utilities it sees
  used.

## What Plan 01-05 Needs To Know

**Imports and the client boundary.** `Button`, `Card`, `Skeleton` are server components — import them
directly. For any button inside a server-action form, import `SubmitButton` from
`@/components/ui/submit-button` instead and render it **inside** the `<form>`. It already sets
`type="submit"` and wires `pending`. Do not make a page a client component to get a pending state —
that pulls the session path into the client and undermines the static shell.

**Button API.**

```tsx
<SubmitButton variant="bordered" pendingLabel="Đang đăng nhập…">
  Đăng nhập với Google
</SubmitButton>
```

`variant` defaults to `bordered`, which is what both Phase 1 buttons use. `primary` exists and is
unused until Phase 3. Pass `pendingLabel` close in length to the idle label so the button does not
change width mid-submission.

**Skeleton sizing — the easy thing to get wrong.** Wrap it in the type token of the text it replaces
and size it in `em`:

```tsx
<div className="text-display">
  <Skeleton className="h-[1.3em] w-48" />
</div>
```

Never `h-10` or `h-11`: the real box is 41.6px, so those are 1.6px short and 2.4px over and each
guarantees the layout shift the skeleton exists to prevent.

**INFRA-07 is yours to keep.** The layout is clean — zero awaits, no session read, no database
import — so the whole burden now sits in the pages. `cacheComponents: true` hard-fails `next build`
on any un-Suspensed dynamic API, and 01-05's gate asserts no route renders as `ƒ`. Call `auth()`
inside a child component wrapped in `<Suspense>`, never at the top level of a page body. The fallback
is where the Skeleton goes.

**Do not re-add shell chrome.** The header, wordmark, gutters and bottom padding already render for
every route. Pages supply only their own content. Do not add horizontal padding — `<main>` already
applies `px-[var(--shell-gutter)]`. Do not add bottom padding for the future tab bar — `<main>`
already pads by `--shell-tabbar-height`, and adding the inset again leaves a dead gap.

**Tokens only.** No `bg-white`, no `text-gray-*`, no hex. Dark mode works solely because no component
names a raw colour; one hardcoded value is a day-one bug on a dark-mode phone. Available colours:
`surface`, `surface-raised`, `surface-sunken`, `border`, `border-strong`, `ink`, `ink-soft`,
`ink-muted`, `accent`, `accent-hover`, `on-accent`, `positive`, `negative`, `destructive`,
`on-destructive`, `focus`.

**Copy is `text-ink` by default** from the body rule — only set a colour when departing from it. And
never use `leading-tight`: 1.25 clips Vietnamese tone marks, which measure 1.321em of ink span.

## Known Stubs

None. The header's right-hand slot is an intentionally empty reserved div, and
`--shell-tabbar-content: 0px` is an intentional Phase 3 seam — both are specified by the UI-SPEC, not
placeholders for missing work.

## Threat Flags

None. This plan adds no network endpoint, auth path, file access or schema change. T-03-01 (layout
blocking on data) is mitigated and asserted: the await count in `src/app/layout.tsx` is 0 and neither
`@/auth` nor `@/lib/db` is imported.

## Self-Check: PASSED

Files verified present:

```
FOUND: src/app/globals.css
FOUND: src/app/layout.tsx
FOUND: src/components/ui/button.tsx
FOUND: src/components/ui/card.tsx
FOUND: src/components/ui/skeleton.tsx
FOUND: src/components/ui/submit-button.tsx
```

Commits verified in `git log`:

```
FOUND: 0f2f849  feat(01-03): add design token system with dark mode
FOUND: 18597a8  feat(01-03): build static app shell with safe-area geometry
FOUND: 993fedd  feat(01-03): add Button, Card, Skeleton and SubmitButton primitives
```

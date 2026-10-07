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

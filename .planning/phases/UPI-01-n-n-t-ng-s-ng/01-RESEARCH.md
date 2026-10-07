# Phase 1: Nền tảng sống — Research

**Researched:** 2026-10-07
**Domain:** Next.js 16 App Router scaffold + Neon/Prisma 7 + Auth.js v5 + Vercel deploy
**Confidence:** HIGH — every config block below was built and compiled in a throwaway project at `/tmp/cna-test`
**Supersedes nothing.** Extends `.planning/research/stack-deploy.md` (project-level). Where that doc is still correct, this cites it; where reality has moved, this corrects it explicitly.

---

## Key Findings

1. **`create-next-app@16.4.0` now has a native `--biome` flag** and scaffolds Biome 2.4.2 with Next+React lint domains pre-wired. No ESLint removal step exists — there is nothing to remove. [VERIFIED: ran the CLI]
2. **The scaffold uses `@tailwindcss/turbopack`, NOT `@tailwindcss/postcss`.** There is no `postcss.config.mjs` and no PostCSS dependency. Tailwind is wired via a `turbopack.rules` loader in `next.config.ts`. The research question's premise is outdated. [VERIFIED: inspected scaffold output]
3. **The scaffold sets `cacheComponents: true`, which is a build-breaking landmine for this phase.** Any `cookies()`, `headers()`, or `searchParams` access outside `<Suspense>` is a **hard `next build` failure**, not a warning. This hits `auth()` and the rejection page. [VERIFIED: reproduced the failure and the fix]
4. **That same constraint hands you INFRA-07 for free.** Wrapping the dynamic part in `<Suspense>` makes the route Partial-Prerender (`◐`) — static shell ships instantly while Neon resumes. INFRA-07 needs no extra work beyond correct Suspense placement.
5. **AUTH-02 is satisfied natively — no workaround needed.** In `@auth/core`, `handleAuthorized()` (which runs your `signIn` callback) is invoked **before** `handleLoginOrRegister()`. Returning `false` throws `AccessDenied` and no `User`, `Account`, or `Session` row is ever written. [VERIFIED: read `node_modules/@auth/core/lib/actions/callback/index.js` lines 63–70]
6. **Rejection surfacing is a one-liner:** `AccessDenied` is in `@auth/core`'s `clientErrors` allowlist, so it redirects to `pages.error?error=AccessDenied`. Point `pages.error` at `/khong-duoc-moi` and the Vietnamese rejection page renders instead of Auth.js's default. [VERIFIED: `errors.js` line 412–421, `index.js` line 130–137]
7. **`prisma generate` is still mandatory.** Prisma 7 has **no `postinstall` hook**. Deleting `src/generated/` fails the build with `Module not found: Can't resolve '@/generated/prisma/client'`. Keep it first in the build command. [VERIFIED: reproduced]
8. **`previewFeatures = ["driverAdapters"]` is gone — do not add it.** Driver adapters are GA in Prisma 7. The datasource block has **no `url` field** and there is no `directUrl`; both moved to `prisma.config.ts`. [VERIFIED: `prisma validate` passes with neither]
9. **Seed config moved to `prisma.config.ts` under `migrations.seed`** — not the `package.json` `prisma.seed` block (that was Prisma ≤6). [VERIFIED: `@prisma/config` type defs + official docs]
10. **Vitest 5 conflicts with the scaffold's `@types/node@^20`** and hard-fails `npm install` with ERESOLVE. Bump to `@types/node@^22` first. [VERIFIED: reproduced the ERESOLVE]
11. **Vite 8 resolves tsconfig paths natively** — `vite-tsconfig-paths` and `@vitejs/plugin-react` are both unnecessary. Use `resolve: { tsconfigPaths: true }`. Two fewer dependencies. [VERIFIED: `@/` alias resolves in a passing test]
12. **`proxy.ts` must live in `src/`, not the repo root**, when using `--src-dir`. In the root it is silently ignored — the build succeeds and the route guard simply never runs. This is the most dangerous failure mode in the phase because it fails open. [VERIFIED: build output shows `ƒ Proxy (Middleware)` only when the file is at `src/proxy.ts`]

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Stack & tooling**
- **Package manager: pnpm.** Nhanh, tiết kiệm dung lượng đĩa, Vercel nhận diện sẵn qua lockfile.
- **Styling: Tailwind CSS v4.** Dự án là mobile-first và phần lớn là layout + spacing — đúng thứ Tailwind làm tốt. Không cần đặt tên class cho một app 10 người dùng.
- **Test runner: Vitest.** Phase 2 cần property-based test với fast-check chạy hàng chục nghìn case; Vitest là runner nhanh nhất trong các lựa chọn và tích hợp thẳng với TS.
- **Lint/format: Biome.** Một công cụ thay cả ESLint lẫn Prettier, cấu hình ngắn, chạy nhanh. Giảm số file config phải nuôi.

**Auth & allowlist**
- **Session strategy: database session, không dùng JWT.** Allowlist là cơ chế bảo vệ duy nhất của app. Với JWT, gỡ một người khỏi allowlist không đuổi họ ra được cho tới khi token hết hạn. Database session kiểm tra mỗi request nên thu hồi quyền có hiệu lực tức thì. Prisma adapter đã tạo sẵn bảng `Session` nên không phát sinh việc.
- **Seed allowlist bằng script `pnpm seed` đọc từ biến môi trường.** Danh sách email nằm trong `.env`, chạy một lệnh là xong. Hardcode trong migration thì mỗi lần sửa danh sách phải viết migration mới; gõ SQL tay thì không lặp lại được khi dựng lại DB.
- **Người ngoài allowlist thấy một trang từ chối có giải thích** — "Email này chưa được mời" kèm nút đăng xuất. Redirect im lặng về trang login tạo vòng lặp khiến người dùng tưởng app hỏng.
- **Chưa làm trang quản lý allowlist trong app.** REQ AUTH-02 chỉ yêu cầu thêm thành viên không cần deploy lại — seed script đã thoả.
- **Google OAuth consent screen để ở chế độ Testing.** Chấp nhận phải đồng bộ tay hai danh sách để đổi lấy một cổng chặn thứ hai miễn phí.

**Deploy & môi trường**
- **Migration chạy trong build command:** `prisma generate && prisma migrate deploy && next build`
- **Biến môi trường: commit `.env.example`, gitignore `.env.local`.** Giá trị thật dán tay vào Vercel dashboard. Không dùng `vercel env pull`.
- **Agent viết trọn code và cấu hình trước, gom mọi bước cần thao tác tay vào một checklist duy nhất ở cuối phase.**

**Ràng buộc phiên bản (bắt buộc tuân thủ)**
- **Pin `prisma` và `@prisma/client` cùng ở v7, exact version.**
- **Pin `next-auth@5.0.0-beta.32` exact.**
- **Dùng `proxy.ts`, KHÔNG dùng `middleware.ts`.**
- **Kết nối Neon qua pooled connection string + `@prisma/adapter-neon`;** `DIRECT_URL` chỉ dùng cho `migrate`.
- **Region: Neon `ap-southeast-1`, Vercel function `sin1`.**

### Agent's Discretion
- Cấu trúc thư mục cụ thể trong `app/` và `lib/`
- Cách tổ chức file cấu hình Biome, Vitest, Tailwind
- Nội dung và bố cục chính xác của trang từ chối và trang authenticated
- Cách viết seed script (TypeScript qua `tsx`, hay SQL thuần)

### Deferred Ideas (OUT OF SCOPE)
- **Trang quản lý allowlist trong app** — thêm sau khi seed script trở nên phiền; schema đã sẵn sàng
- **Neon branching cho preview deployment** — nếu sau này có người thứ hai cùng code
- **Publish OAuth consent screen ra Production** — nếu việc đồng bộ hai danh sách trở nên phiền phức
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFRA-01 | Next.js App Router + TS strict, Prisma pinned v7 | §1 version matrix (exact pins), §2 tsconfig — scaffold is already `strict: true` |
| INFRA-02 | Dev local với Neon connection string, không Docker | §3 `.env.local` shape; Neon is remote so no container is involved |
| INFRA-03 | `git push` → auto deploy production | §7 Vercel pipeline; git-push deploy is default on import |
| INFRA-04 | Migration tự động khi deploy; schema khớp code | §7 build command `prisma migrate deploy` |
| INFRA-05 | Toàn bộ dịch vụ free tier, 0đ/tháng | stack-deploy.md §1 (unchanged); §8 checklist step 10 verifies |
| INFRA-06 | Pooled connection + Neon adapter | §3 `lib/db.ts` + two-URL split |
| INFRA-07 | App shell render tĩnh khi Neon resume | §2.4 — `cacheComponents` + `<Suspense>` yields `◐` PPR routes automatically |
| AUTH-01 | Đăng nhập Google một chạm | §4 `auth.ts` Google provider |
| AUTH-02 | Chỉ allowlist vào được; thêm member = INSERT, không redeploy | §4.3 — **verified** no row created on reject; §6 seed script |
| AUTH-03 | Giữ phiên qua nhiều lần mở app | §4.5 session maxAge 30d, database strategy |
| AUTH-06 | Đăng xuất được từ mọi màn hình | §4.6 `signOut` server action in the shell header |
</phase_requirements>

## Project Constraints (from AGENTS.md)

- Money is integer VND; this phase creates **no** money tables (Phase 2 owns the ledger entirely).
- Work must flow through GSD commands; no direct edits outside a GSD workflow.
- Tech stack Next.js + Postgres is locked; hosting Vercel Hobby + Neon free tier; budget 0đ/month.
- Client-side image compression required later (4.5 MB server-action cap) — not this phase.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Google OAuth handshake | API (route handler) | — | `/api/auth/[...nextauth]` must be a dynamic server function; it sets cookies |
| Allowlist enforcement | API (`signIn` callback) | Database | Must run server-side before any row is written; a client check is bypassable |
| Route guarding | Frontend Server (`src/proxy.ts`) | — | Runs on Node runtime in Next 16, so Prisma/database sessions work there |
| Session read in pages | Frontend Server (RSC) | Database | `auth()` reads the session cookie then hits the `Session` table |
| App shell paint | CDN / Static | — | Statically prerendered so it shows while Neon compute resumes (INFRA-07) |
| Migration execution | Build step (Vercel) | Database | `migrate deploy` over the **direct** connection; DDL cannot cross PgBouncer |
| Allowlist seeding | Local CLI (`pnpm seed`) | Database | Operator action over the direct URL; never runs in the build |
| Theme tokens | CDN / Static (CSS) | — | `@theme` compiles to a static stylesheet at build time |

---

## 1. Exact Version Matrix

All versions below were resolved from the npm registry on **2026-10-07** and then **installed together and built successfully**. This is not a paper compatibility claim.

### Registry state [VERIFIED: `npm view <pkg> dist-tags`]

| Package | `latest` tag | What to pin | Why |
|---|---|---|---|
| `next` | **16.4.0** | `16.4.0` | exact — scaffold pins it exactly too |
| `react` / `react-dom` | **19.3.0** | `19.3.0` | exact — scaffold pins exactly |
| `prisma` | **8.0.0-rc.20** ⚠️ | `7.10.0` | `latest` is an RC. This is the trap STATE.md warns about — **still live** |
| `@prisma/client` | **7.10.0** | `7.10.0` | must equal `prisma` exactly |
| `@prisma/adapter-neon` | **7.10.0** | `7.10.0` | must equal client; depends on `@prisma/driver-adapter-utils@7.10.0` |
| `@neondatabase/serverless` | **1.2.0** | `1.2.0` | adapter peer range is `>0.6.0 <2` — 1.2.0 is inside it |
| `next-auth` | **4.24.15** ⚠️ | `5.0.0-beta.32` | `latest` is v4. `beta` tag = `5.0.0-beta.32` |
| `@auth/prisma-adapter` | **2.11.3** | `2.11.3` | peer `@prisma/client >=6` — satisfied |
| `tailwindcss` | **4.3.3** | `^4` | scaffold writes `^4`; v4.3.3 resolves |
| `@tailwindcss/turbopack` | **4.3.3** | `^4` | **this, not `@tailwindcss/postcss`** — see §2.2 |
| `vitest` | **5.0.3** | `^5.0.3` | requires `@types/node` ≥22 |
| `@biomejs/biome` | **2.5.15** | `2.4.2` | scaffold writes 2.4.2 exact; leave it (see §1.3) |
| `tsx` | **4.23.15** | `^4.23.15` | seed script runner |
| `dotenv` | **18.0.6** | `^18` | required by `prisma.config.ts` |

> ⚠️ **The two traps CONTEXT.md names are both still live today.** `npm i prisma` → `8.0.0-rc.20`; `npm i next-auth` → `4.24.15`. Neither has been fixed upstream since the project-level research. Explicit versions are mandatory.

### 1.1 The dependency block [VERIFIED: installed + `next build` green]

```jsonc
{
  "dependencies": {
    "@auth/prisma-adapter": "2.11.3",
    "@neondatabase/serverless": "1.2.0",
    "@prisma/adapter-neon": "7.10.0",
    "@prisma/client": "7.10.0",
    "next": "16.4.0",
    "next-auth": "5.0.0-beta.32",
    "react": "19.3.0",
    "react-dom": "19.3.0"
  },
  "devDependencies": {
    "@biomejs/biome": "2.4.2",
    "@tailwindcss/turbopack": "^4",
    "@types/node": "^22",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "dotenv": "^18",
    "prisma": "7.10.0",
    "tailwindcss": "^4",
    "tsx": "^4.23.15",
    "typescript": "^5",
    "vitest": "^5.0.3"
  }
}
```

All five version-critical packages are pinned **exact** (no `^`). Everything else may float.

### 1.2 Peer-dependency conflicts found [VERIFIED: reproduced]

**One real conflict.** The scaffold writes `@types/node: "^20"`. Vitest 5 declares `peerOptional @types/node: "^22.0.0 || >=24.0.0"`. Installing Vitest into an untouched scaffold fails:

```
npm ERR! code ERESOLVE
npm ERR! Conflicting peer dependency: @types/node@26.6.4
npm ERR!   peerOptional @types/node@"^22.0.0 || >=24.0.0" from vitest@5.0.3
```

**Fix:** bump `@types/node` to `^22` **before** installing Vitest. Do not use `--legacy-peer-deps` — it hides the problem and pnpm (the locked package manager) is stricter than npm here.

No other conflicts. `next-auth@5.0.0-beta.32` declares `next: "^14.0.0-0 || ^15.0.0 || ^16.0.0"` — Next 16.4.0 is explicitly supported. [VERIFIED: `npm view next-auth@5.0.0-beta.32 peerDependencies`]

### 1.3 Node engine floor [VERIFIED: `npm view <pkg> engines`]

| Package | Required Node |
|---|---|
| `next@16.4.0` | `>=20.9.0` |
| `prisma@7.10.0` / `@prisma/client@7.10.0` | `^20.19 \|\| ^22.12 \|\| >=24.0` |
| `vitest@5.0.3` | `^22.12.0 \|\| ^24.0.0 \|\| >=26.0.0` |

**Effective floor: Node 22.12.** Vitest is the binding constraint. Local machine is on **v22.22.1** — satisfied. Set `"engines": { "node": ">=22.12" }` in `package.json` so Vercel selects a matching runtime.

### 1.4 Biome version note

The scaffold pins `@biomejs/biome: "2.4.2"` exactly while `latest` is `2.5.15`. **Leave the scaffold's pin.** The generated `biome.json` carries `"$schema": ".../2.4.2/schema.json"`; bumping the package without the schema produces a mismatch warning for zero benefit. Biome is a formatter — being one patch behind costs nothing.

---

## 2. The `create-next-app` → Working-Skeleton Delta

### 2.1 What the scaffold actually produces [VERIFIED: ran the CLI]

```bash
pnpm create next-app@16.4.0 . \
  --typescript --app --tailwind --biome \
  --src-dir --import-alias "@/*" --use-pnpm --empty
```

Produces exactly 11 files:

```
AGENTS.md          biome.json        .gitignore       next.config.ts
next-env.d.ts      package.json      README.md        tsconfig.json
src/app/globals.css  src/app/layout.tsx  src/app/page.tsx
```

> ⚠️ `create-next-app` writes its own `AGENTS.md`. The repo already has one. **The scaffold will overwrite it.** Either pass `--no-agents-md`, or back up the existing file first. This is a silent data-loss step a planner must sequence explicitly.

> The repo is non-empty (`.planning/`, `AGENTS.md`, `.gitignore`). `create-next-app .` into a dirty directory is refused for some file conflicts. Scaffold into a temp dir and move files in, or use `--no-git` and reconcile. Plan for this.

### 2.2 Tailwind v4 — the research premise was wrong [VERIFIED]

**There is no `@tailwindcss/postcss` and no `postcss.config.mjs` in the current scaffold.** Tailwind is wired through a Turbopack loader:

```ts
// next.config.ts — as scaffolded
turbopack: {
  rules: {
    "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
  },
},
```

`src/app/globals.css` contains exactly one line: `@import "tailwindcss";`.

**Action for the planner: do nothing.** `--tailwind` already delivers v4 correctly configured. The only change is replacing the contents of `globals.css` with the UI-SPEC `@theme` block.

**The UI-SPEC `@theme` block compiles correctly under this loader** — verified by building a page using `bg-surface`, `text-display`, `rounded-card`, `shadow-card`, `text-accent`, `animate-skeleton`, and `tabular-nums`, then grepping the emitted CSS for each utility. All seven present. The `@keyframes` nested inside `@theme` and the `@media (prefers-color-scheme: dark)` override both work. [VERIFIED]

### 2.3 TypeScript strict mode

The scaffold already sets `"strict": true`. INFRA-01 is satisfied by default. Two optional additions worth considering (agent's discretion):

```jsonc
{
  "compilerOptions": {
    "noUncheckedIndexedAccess": true,   // meaningful for Phase 2 split arrays
    "noUnusedLocals": true
  }
}
```

`noUncheckedIndexedAccess` is genuinely valuable for the Phase 2 ledger work (array indexing in split algorithms). Enabling it now is cheap; enabling it later means fixing accumulated violations. Recommend enabling.

### 2.4 `cacheComponents: true` — the highest-risk default [VERIFIED: reproduced both failure and fix]

The scaffold enables `cacheComponents` and `partialPrefetching`. Consequence:

```
Error: Route "/": Next.js encountered uncached or runtime data during prerendering.
`fetch(...)`, `cookies()`, `headers()`, `params`, `searchParams`, or `connection()`
accessed outside of <Suspense> prevents the route from being prerendered
...
⨯ Next.js build worker exited with code: 1
```

This is a **build failure**, not a warning. It fires on any page calling `auth()` (reads cookies) or reading `searchParams` — i.e. both the authenticated page and the rejection page.

**Two options:**

| Option | Effect | Verdict |
|---|---|---|
| Wrap dynamic access in `<Suspense>` | Route becomes `◐` Partial Prerender — static shell streams first | ✅ **Take this** |
| `export const instant = false` per route | Route becomes fully dynamic `ƒ` — no static shell | ❌ forfeits INFRA-07 |
| Remove `cacheComponents` from config | Back to Next 15 semantics | ❌ forfeits INFRA-07 |

**Option 1 is not a workaround — it is exactly INFRA-07.** The requirement says "app shell render tĩnh nên người dùng thấy giao diện ngay cả khi Neon compute đang resume." PPR delivers that mechanically:

```
┌ ○ /                      ← Static
├ ƒ /api/auth/[...nextauth] ← Dynamic (correct, it's an API route)
└ ◐ /khong-duoc-moi         ← Partial Prerender: static HTML + streamed dynamic
ƒ Proxy (Middleware)
```

**Planner guidance:** every page that reads session or searchParams must put that read in a child component inside `<Suspense>`. Make this a verification step — `next build` output must show `○` or `◐` for all app routes and never `ƒ`.

### 2.5 ESLint removal — not applicable

`--biome` means ESLint is never installed. There is no removal task. `package.json` ships `"lint": "biome check"` and `"format": "biome format --write"`.

**One required edit:** Biome lints the generated Prisma client (14 diagnostics) despite the generated files carrying a `// biome-ignore-all` header. Add the exclusion: [VERIFIED: 24 errors → 0]

```jsonc
// biome.json
"files": {
  "ignoreUnknown": true,
  "includes": ["**", "!node_modules", "!.next", "!dist", "!build", "!src/generated"]
}
```

Also note Biome flags `process.env.DATABASE_URL!` under `lint/style/noNonNullAssertion`. Resolve with an explicit guard rather than a suppression comment (see §3.3) — the guard is better code anyway, since it turns a confusing runtime `undefined` into a clear startup error.

### 2.6 Vitest config [VERIFIED: tests pass, `@/` alias resolves]

Vite 8 (which Vitest 5 bundles) resolves tsconfig paths natively. **`vite-tsconfig-paths` and `@vitejs/plugin-react` are both unnecessary.**

File must be `vitest.config.mts` — with `.ts`, Vite warns that ESM syntax is loaded as CommonJS because `package.json` has no `"type": "module"`.

```ts
// vitest.config.mts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

`environment: 'node'` is right for Phase 1 and Phase 2 (pure money-math property tests). Only add `jsdom` + React Testing Library when a component actually needs rendering — not in this phase.

> `.mts` does **not** interfere with `next build`. [VERIFIED]

---

## 3. Prisma 7 + Neon Adapter Wiring

### 3.1 Breaking changes from Prisma 6 that affect this setup [VERIFIED]

| Prisma 6 | Prisma 7 | Impact |
|---|---|---|
| `datasource db { url = env("DATABASE_URL") }` | **no `url` field** | url moves to `prisma.config.ts` |
| `directUrl = env("DIRECT_URL")` | **removed** | becomes `datasource.url` in config |
| `previewFeatures = ["driverAdapters"]` | **GA, remove it** | schema validates without it |
| `package.json` → `"prisma": { "seed": ... }` | `prisma.config.ts` → `migrations.seed` | seed config relocated |
| `new PrismaClient()` with no args | **adapter is required** | TS error `Expected 1 arguments, but got 0` |
| `postinstall` auto-generate | **no postinstall hook** | `prisma generate` must be explicit |

The last two are the ones that bite silently. See §9.

### 3.2 `prisma/schema.prisma` [VERIFIED: `prisma validate` + `prisma generate` pass]

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}
```

**Note `provider = "prisma-client"`, not `"prisma-client-js"`.** Both work in 7.10.0, but they differ materially:

| Generator | Emits | Notes |
|---|---|---|
| `prisma-client` | TypeScript (`client.ts`, `models/*.ts`) | modern, ESM-native, import `@/generated/prisma/client` |
| `prisma-client-js` | JS + `.d.ts` | legacy path, being phased out |

**Recommend `prisma-client`** — it is the Prisma 7 default direction and emits TS that the Next build typechecks natively. [VERIFIED: both generate successfully; TS output confirmed by reading `client.ts`]

> `output` is **required** in Prisma 7. Generating into `src/generated/` means it must be gitignored (`/src/generated`) and regenerated on every build.

### 3.3 `prisma.config.ts` (project root) [VERIFIED: loads, validates, generates]

```ts
import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL_UNPOOLED'),   // direct connection — DDL only
  },
})
```

> ⚠️ **`env()` throws if the variable is missing** — it does not return `undefined`:
> ```
> Failed to load config file ... PrismaConfigEnvError: Cannot resolve environment variable: DATABASE_URL_UNPOOLED
> ```
> This means **every** `prisma` CLI invocation needs `DATABASE_URL_UNPOOLED` set, including `prisma generate`, which does not touch the database. Consequence: `pnpm build` fails locally without it. Document this in `.env.example`. [VERIFIED: reproduced]

### 3.4 `src/lib/db.ts` [VERIFIED: builds, typechecks, Biome-clean]

```ts
import { PrismaNeon } from '@prisma/adapter-neon'
import { PrismaClient } from '@/generated/prisma/client'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is not set')

const makeClient = () =>
  new PrismaClient({ adapter: new PrismaNeon({ connectionString }) })

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof makeClient>
}

export const prisma = globalForPrisma.prisma ?? makeClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

Differences from the project-level version in stack-deploy.md §2:
- Import path is `@/generated/prisma/client` (the `prisma-client` generator emits `client.ts`), not `@/generated/prisma`.
- Explicit env guard replaces `!` — satisfies `noNonNullAssertion` and fails loudly at startup instead of producing a confusing driver error.

The HMR singleton guard is still required: without it, `next dev` leaks a Neon client per hot reload.

### 3.5 `.env` variable shape

| Variable | Host | Used by | Set where |
|---|---|---|---|
| `DATABASE_URL` | **pooled** (`-pooler` in hostname) | app runtime via `lib/db.ts` | `.env.local` + Vercel (all envs) |
| `DATABASE_URL_UNPOOLED` | **direct** (no `-pooler`) | `prisma` CLI: generate, migrate, seed | `.env.local` + Vercel (all envs) |

`.env.example` (committed):

```ini
# Neon → Connect → "Pooled connection". Runtime queries.
DATABASE_URL="postgresql://USER:PASSWORD@ep-xxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"

# Neon → Connect → uncheck "Pooled connection". Migrations + seed. DDL cannot cross PgBouncer.
# Required by prisma.config.ts for EVERY prisma CLI command, including `generate`.
DATABASE_URL_UNPOOLED="postgresql://USER:PASSWORD@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"

# npx auth secret
AUTH_SECRET=""

# Google Cloud Console → Credentials → OAuth client ID
AUTH_GOOGLE_ID=""
AUTH_GOOGLE_SECRET=""

# Required on Vercel so Auth.js trusts the forwarded host.
AUTH_TRUST_HOST="true"

# Seed input. Format: email[:label], comma-separated.
ALLOWLIST_EMAILS="quynh@gmail.com:Quỳnh,an@gmail.com:An"
```

> ⚠️ **The scaffold's `.gitignore` contains `.env*`, which ignores `.env.example` too.** CONTEXT.md requires committing it. Append `!.env.example`. [VERIFIED: `git add` refused the file, then succeeded after the negation]

Also append `/src/generated` to `.gitignore`.

---

## 4. Auth.js v5 + Prisma Adapter + Database Sessions + Allowlist

### 4.1 `src/auth.ts` [VERIFIED: builds and typechecks]

```ts
import { PrismaAdapter } from '@auth/prisma-adapter'
import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import { prisma } from '@/lib/db'

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [Google],
  session: {
    strategy: 'database',
    maxAge: 30 * 24 * 60 * 60,    // 30 days — AUTH-03
    updateAge: 24 * 60 * 60,      // refresh row at most once/day
  },
  pages: {
    signIn: '/dang-nhap',
    error: '/khong-duoc-moi',     // AccessDenied lands here
  },
  callbacks: {
    // THE ALLOWLIST GATE. Runs BEFORE any row is written.
    async signIn({ profile, account }) {
      if (account?.provider !== 'google') return false
      const email = profile?.email?.toLowerCase()
      if (!email || !profile?.email_verified) return false

      const invited = await prisma.allowlist.findUnique({ where: { email } })
      return Boolean(invited)
    },

    async session({ session, user }) {
      session.user.id = user.id
      return session
    },
  },
})
```

> **No TypeScript module augmentation is needed for `session.user.id`.** `next-auth@5.0.0-beta.32` types it out of the box; `const id: string | undefined = s?.user?.id` compiles clean under `strict`. [VERIFIED: `tsc --noEmit` exit 0]. Most tutorials still show a `declare module 'next-auth'` block — it is obsolete here.

### 4.2 Route handler

```ts
// src/app/api/auth/[...nextauth]/route.ts
import { handlers } from '@/auth'
export const { GET, POST } = handlers
```

### 4.3 AUTH-02: what happens to a rejected user — RESOLVED [VERIFIED: read the source]

**The answer is: no rows are created. Returning `false` is sufficient. No workaround needed.**

From `node_modules/@auth/core/lib/actions/callback/index.js`, the OAuth callback path:

```js
// line 55-62 — look up EXISTING user only; does not create
let userByAccount;
if (adapter) {
  const { getUserByAccount } = adapter;
  userByAccount = await getUserByAccount({
    providerAccountId: account.providerAccountId,
    provider: provider.id,
  });
}

// line 63-67 — YOUR signIn CALLBACK RUNS HERE
const redirect = await handleAuthorized({
  user: userByAccount ?? userFromProvider,
  account,
  profile: OAuthProfile,
}, options);
if (redirect) return { redirect, cookies };

// line 70 — only reached if handleAuthorized did NOT throw
const { user, session, isNewUser } = await handleLoginOrRegister(...);
```

And `handleAuthorized` (line 393):

```js
async function handleAuthorized(params, config) {
  let authorized;
  const { signIn, redirect } = config.callbacks;
  try { authorized = await signIn(params); }
  catch (e) {
    if (e instanceof AuthError) throw e;
    throw new AccessDenied(e);
  }
  if (!authorized) throw new AccessDenied("AccessDenied");
  ...
}
```

**The ordering is decisive.** `handleLoginOrRegister` — the only function that calls `createUser`, `linkAccount`, or `createSession` — sits at line 70, strictly after the line-63 gate. A thrown `AccessDenied` never reaches it.

| Row type | Created on reject? | Why |
|---|---|---|
| `User` | **No** | `createUser` lives in `handleLoginOrRegister`, never reached |
| `Account` | **No** | `linkAccount` likewise |
| `Session` | **No** | `createSession` likewise |

So AUTH-02 ("Chỉ email nằm trong allowlist mới đăng nhập được") holds with the plain `return Boolean(invited)`.

**Verification step for the planner:** after a rejected sign-in attempt, assert `SELECT count(*) FROM "User"` is unchanged. This is worth an explicit UAT item because the guarantee comes from library internals, not from our code — a future `next-auth` beta bump could reorder it.

### 4.4 How rejection reaches the Vietnamese UI [VERIFIED: read the source]

`AccessDenied` is in the client-safe error set (`errors.js` line 412):

```js
const clientErrors = new Set([
  "CredentialsSignin", "OAuthAccountNotLinked", "OAuthCallbackError",
  "AccessDenied", "Verification", "MissingCSRF",
  "AccountNotLinked", "WebAuthnVerificationError",
]);
```

And the top-level handler (`index.js` line 130-137):

```js
const isClientSafeErrorType = isClientError(error);
const type = isClientSafeErrorType ? error.type : "Configuration";
const params = new URLSearchParams({ error: type });
const pageKind = (isAuthError && error.kind) || "error";
const pagePath = config.pages?.[pageKind] ?? `${config.basePath}/${pageKind.toLowerCase()}`;
const url = `${internalRequest.url.origin}${pagePath}?${params}`;
```

With `pages.error = '/khong-duoc-moi'`, a rejected user lands on `/khong-duoc-moi?error=AccessDenied`. If `pages.error` were unset they would get Auth.js's built-in English error page.

**The rejection page must wrap its `searchParams` read in `<Suspense>`** or the build fails (§2.4):

```tsx
// src/app/khong-duoc-moi/page.tsx  — VERIFIED: builds as ◐
import { Suspense } from 'react'
import { redirect } from 'next/navigation'

async function Guard({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  // Someone browsing here directly without a failed attempt goes back to login.
  if (error !== 'AccessDenied') redirect('/dang-nhap')
  return null
}

export default function Page({
  searchParams,
}: { searchParams: Promise<{ error?: string }> }) {
  return (
    <main>
      <h1>Email này chưa được mời</h1>
      <p>Tài khoản Google bạn vừa dùng không nằm trong danh sách thành viên.</p>
      <SignOutButton />
      <Suspense>
        <Guard searchParams={searchParams} />
      </Suspense>
    </main>
  )
}
```

> `searchParams` is a **Promise** in Next 16 — must be awaited.

> **Note on the sign-out button here:** a rejected user has no session (no row was created), so `signOut()` is a no-op server-side. The button exists to clear the *Google* account selection confusion and send the user back to `/dang-nhap`. CONTEXT.md asks for "nút đăng xuất"; implement it as a link back to `/dang-nhap` plus `signOut({ redirectTo: '/dang-nhap' })` — harmless when no session exists.

### 4.5 `src/proxy.ts` — MUST be inside `src/` [VERIFIED: the dangerous one]

```ts
// src/proxy.ts
export { auth as proxy } from '@/auth'

export const config = {
  matcher: [
    '/((?!api/auth|dang-nhap|khong-duoc-moi|manifest.webmanifest|icons|_next/static|_next/image|favicon.ico).*)',
  ],
}
```

Confirmations:

- **`proxy.ts` is real and current.** Official docs (`nextjs.org/docs/app/api-reference/file-conventions/proxy`, `version: 16.4.0`, `lastUpdated: 2026-09-04`): *"The `middleware` file convention is deprecated and has been renamed to `proxy`."* [VERIFIED: WebFetch]
- **It replaces `middleware.ts`** — same role, same `config.matcher` shape. `middleware.ts` still functions (deprecated, not removed), but do not use both.
- **Placement:** docs say "in the project root, **or inside `src` if applicable**, so that it is located at the same level as `pages` or `app`." With `--src-dir`, `app/` is at `src/app/`, so `proxy.ts` goes at `src/proxy.ts`.

**This fails open and is the single most dangerous mistake available in this phase.** With `proxy.ts` at the repo root, `next build` succeeds, no warning is emitted, and the guard simply never runs — every protected route is public. The diagnostic is the build output line:

```
ƒ Proxy (Middleware)        ← present = wired. Absent = silently disabled.
```

Make "build output contains `ƒ Proxy (Middleware)`" a hard verification step.

Runtime bonus confirmed: `proxy.ts` runs on the Node runtime, so Prisma + database sessions work there with no edge-split workaround (stack-deploy.md §3).

### 4.6 AUTH-06: sign-out from every screen

Because the shell header lives in `src/app/layout.tsx` and the layout is static, the sign-out control must be a client component posting to a server action — not a session-dependent render:

```tsx
// src/components/sign-out-button.tsx
import { signOut } from '@/auth'

export function SignOutButton() {
  return (
    <form action={async () => {
      'use server'
      await signOut({ redirectTo: '/dang-nhap' })
    }}>
      <button type="submit">Đăng xuất</button>
    </form>
  )
}
```

A `<form>` + server action keeps the layout statically prerenderable — the button's markup carries no session data, so it does not force the shell dynamic. Putting `await auth()` in the layout to conditionally render it would make the entire shell dynamic and break INFRA-07.

---

## 5. Prisma Schema — Phase 1 Only

[VERIFIED: `prisma validate` passes; `prisma generate` emits a working client; `next build` green with `@auth/prisma-adapter` consuming it]

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}

// ---- Auth.js adapter models. Field names are FIXED by the adapter. ----

model User {
  id            String    @id @default(cuid())   // THE stable key. Never displayed, never changes.
  name          String?                          // mutable display label (AUTH-04, Phase 5)
  email         String?   @unique                // links Google identity; adapter requires @unique
  emailVerified DateTime?
  image         String?
  createdAt     DateTime  @default(now())

  accounts      Account[]
  sessions      Session[]
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String                        // "google"
  providerAccountId String                        // Google's immutable `sub`
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])         // adapter queries this compound key
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique                   // adapter queries by this
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

// ---- App model ----

model Allowlist {
  email     String   @id                          // always stored lowercase
  label     String?                               // pre-login display hint
  invitedAt DateTime @default(now())
}
```

### 5.1 Mandatory vs optional adapter fields [VERIFIED: read `@auth/prisma-adapter/index.js`]

| Model | Field | Required | Evidence |
|---|---|---|---|
| `User` | `id` | ✅ | `getUser: (id) => p.user.findUnique({ where: { id } })` |
| `User` | `email` `@unique` | ✅ | `getUserByEmail` does `findUnique({ where: { email } })` |
| `User` | `name`, `image`, `emailVerified` | ⚠️ written by `createUser` | adapter spreads provider profile; omitting them drops data silently |
| `Account` | `@@unique([provider, providerAccountId])` | ✅ | `findUnique({ where: { provider_providerAccountId } })` |
| `Account` | `refresh_token`, `access_token`, `id_token`, … | ✅ | `linkAccount: (data) => p.account.create({ data })` — passes the whole object; a missing column throws |
| `Session` | `sessionToken` `@unique` | ✅ | `getSessionAndUser` / `deleteSession` query it |
| `VerificationToken` | all | ⚠️ unused by Google-only | adapter references `p.verificationToken`; keep the model so the adapter type satisfies |
| `Authenticator` | — | ❌ omit | only for WebAuthn/passkeys; not used |

**`snake_case` field names in `Account` are mandatory.** `refresh_token` not `refreshToken` — `linkAccount` forwards the raw OAuth response object. Renaming them produces `Unknown argument 'refresh_token'` at first login only, never at build time.

**`@db.Text` dropped vs stack-deploy.md §4:** on PostgreSQL, Prisma's default `String` is already `text`. The annotation is a no-op here. Harmless either way.

### 5.2 Stable identity — how the schema enforces it

| Layer | Field | Mutable | Role |
|---|---|---|---|
| Internal | `User.id` (cuid) | never | FK target for every future ledger row |
| External | `Account.providerAccountId` (Google `sub`) | never | links a Google login to a `User` |
| Display | `User.name` | freely | UI label only; never compared, never a key |

`session.user.id` returns `User.id` — so Phase 2 ledger rows key off the surrogate. Renaming becomes `UPDATE "User" SET name = ...` with zero historical impact. This is AUTH-04 (Phase 5), but the schema must be right **now** because changing a primary key later is a data migration.

> **Scope guard:** no `Expense`, `ExpenseSplit`, or any money model appears above. stack-deploy.md §4 shows them; **do not copy them in.** CONTEXT.md: "Phase này không được tạo bất kỳ bảng nào liên quan tới giao dịch." The `BigInt` vs `Int` question is explicitly Phase 2's.

### 5.3 Why `Allowlist` and not `AllowedEmail`

stack-deploy.md §4 names it `AllowedEmail`. Either is fine; pick one and keep it. This doc uses `Allowlist` (→ `prisma.allowlist`), matching CONTEXT.md's Vietnamese "bảng allowlist". **Planner: choose one name and use it consistently across schema, seed, and `auth.ts`.**

---

## 6. Seed Script

[VERIFIED: parser logic executed; typechecks under `next build`]

```ts
// prisma/seed.ts
import { PrismaNeon } from '@prisma/adapter-neon'
import { PrismaClient } from '../src/generated/prisma/client'

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL_UNPOOLED is not set')

const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: url }) })

/** Parses "a@x.com:Quỳnh, b@x.com" → [{email,label}]. Email is always lowercased. */
function parseAllowlist(raw: string | undefined) {
  if (!raw) throw new Error('ALLOWLIST_EMAILS is not set')
  const entries = raw
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean)
    .map((entry) => {
      const [email, label] = entry.split(':').map((s) => s.trim())
      return { email: email.toLowerCase(), label: label || null }
    })
  if (entries.length === 0) throw new Error('ALLOWLIST_EMAILS is empty')
  return entries
}

async function main() {
  const members = parseAllowlist(process.env.ALLOWLIST_EMAILS)
  for (const m of members) {
    await prisma.allowlist.upsert({
      where: { email: m.email },
      update: { label: m.label },
      create: { email: m.email, label: m.label },
    })
  }
  console.log(`Seeded ${members.length} allowlist entries.`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
```

[VERIFIED] parser output for `"A@Gmail.com:Quỳnh, b@gmail.com"`:
```json
[{"email":"a@gmail.com","label":"Quỳnh"},{"email":"b@gmail.com","label":null}]
```
Lowercasing matters: the `signIn` callback looks up `profile.email.toLowerCase()`, so a seeded `A@Gmail.com` would never match.

### 6.1 Wiring

Two places, both needed:

```jsonc
// package.json — CONTEXT.md specifies `pnpm seed`
"scripts": { "seed": "tsx prisma/seed.ts" }
```

```ts
// prisma.config.ts — for `prisma db seed` and post-migrate hooks
migrations: { path: 'prisma/migrations', seed: 'tsx prisma/seed.ts' }
```

> The legacy `"prisma": { "seed": ... }` block in `package.json` is **Prisma ≤6** and is ignored by Prisma 7. [VERIFIED: `@prisma/config` type defs place `seed` under `migrations`; confirmed by official Config API reference]

### 6.2 Idempotency

`upsert` keyed on the `email` primary key. Re-running:
- existing email → `update` refreshes `label`; `invitedAt` preserved (it is only in `create`)
- new email → `create`
- **removed from env → row stays.** The script never deletes.

That last point is a genuine security gap worth naming: since allowlist is the app's only gate, "remove a member" is the operation that matters most, and `pnpm seed` does not perform it. Removal today = manual `DELETE` in the Neon SQL editor, **plus** deleting their `Session` rows (database sessions survive allowlist removal — `signIn` only runs at login).

**Planner decision needed:** either (a) document removal as a two-statement manual runbook, or (b) make the seed script authoritative — delete allowlist rows absent from the env var and cascade-delete their sessions. **(b) is maybe 10 extra lines and makes the env var the single source of truth**, which matches the project's stated core value about avoiding two sources of truth. Recommend (b), but it is a scope call, so flagging rather than assuming. [ASSUMED: that (b) is in scope — needs confirmation]

---

## 7. Vercel Build Pipeline

### 7.1 Where the build command goes

Three possible locations, in Vercel's precedence order: `vercel.json` `buildCommand` > dashboard setting > `package.json` `scripts.build`.

**Recommend `package.json`:** [reasoning, not vendor-prescribed]

```jsonc
"scripts": {
  "build": "prisma generate && prisma migrate deploy && next build"
}
```

It is version-controlled, works identically locally and on Vercel, and needs no dashboard step in the manual checklist. Putting it in `vercel.json` also works but duplicates it; putting it only in the dashboard makes it invisible to the repo.

`vercel.json` then carries only the region:

```jsonc
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "regions": ["sin1"]
}
```

### 7.2 Region pinning [VERIFIED: Vercel docs]

`regions` in `vercel.json` "overrides the Vercel Function Region in Project Settings." *"Hobby plans can select any single region."* — `["sin1"]` is one region, so it is allowed. [CITED: vercel.com/docs/project-configuration/vercel-json#regions]

`sin1` = `ap-southeast-1` = Singapore. [VERIFIED: vercel.com/docs/regions — table row `| sin1 | ap-southeast-1 | Singapore |`] Exactly matches the Neon region, so function→DB latency is intra-AZ.

Committing the region to `vercel.json` is better than setting it in the dashboard — it removes a manual checklist step and survives a project re-import.

### 7.3 Is `prisma generate` still needed? YES [VERIFIED: reproduced]

Prisma 7 has **no `postinstall` script** (`npm view prisma@7.10.0 scripts` shows only `preinstall`). Deleting `src/generated/` and rebuilding:

```
Error: Turbopack build failed with 1 error:
Error: Module not found: Can't resolve '@/generated/prisma/client'
```

Generated output is gitignored, so **every** Vercel build starts without it. `prisma generate` must be first. (This is also why Vercel's cached `node_modules` cannot save you — the client lives in `src/`, not `node_modules/`.)

### 7.4 Build-time vs runtime env vars

| Variable | Build | Runtime | Why |
|---|---|---|---|
| `DATABASE_URL_UNPOOLED` | ✅ **required** | — | `prisma.config.ts` `env()` throws without it — breaks `generate` too |
| `DATABASE_URL` | ⚠️ recommended | ✅ required | `lib/db.ts` throws at import; a prerendered page importing it would fail the build |
| `AUTH_SECRET` | — | ✅ | |
| `AUTH_GOOGLE_ID` / `_SECRET` | — | ✅ | |
| `AUTH_TRUST_HOST` | — | ✅ | |
| `ALLOWLIST_EMAILS` | — | — | local-only, for `pnpm seed` |

Vercel exposes all project env vars to both phases by default, so setting everything for Production + Preview + Development covers this. The reason it matters: **a missing `DATABASE_URL_UNPOOLED` fails the build with a Prisma config error that mentions nothing about Vercel or migrations**, and is easy to misdiagnose.

### 7.5 `migrate deploy` against a conflicting schema

Failure modes, worst first:

| Situation | Behavior | Recovery |
|---|---|---|
| DB has tables, no `_prisma_migrations` table | `migrate deploy` tries to create existing tables → **P3005 / build fails red** | baseline: `prisma migrate resolve --applied <name>` |
| Migration file partially applies (e.g. constraint violation mid-way) | **No rollback.** DB left half-migrated, deploy red | fix by hand in Neon SQL editor, then `migrate resolve` |
| Migration already applied | no-op, exits 0 | — |
| Drift (DB manually edited) | `migrate deploy` does **not** detect drift (unlike `migrate dev`); it only applies pending files | drift surfaces later as a runtime "column does not exist" |

**The realistic risk for a fresh Neon project is low** — the DB starts empty and `migrate deploy` applies the initial migration cleanly. The risk appears if someone runs `prisma db push` locally against the production branch first, creating tables without migration history → every later deploy fails P3005.

**Planner guidance:** forbid `prisma db push` against the production branch entirely. Use `prisma migrate dev` locally (writes a migration file) so production history stays coherent. Worth stating as a convention since this is the phase that sets the project's patterns.

**Deployment safety note:** since `migrate deploy` runs on every build and preview deployments share the production DB by default (Neon preview branching is deferred per CONTEXT.md), a preview build will migrate production. With a single developer on `main` this is acceptable; it is worth one line in the checklist so it is a known property rather than a surprise.

---

## 8. The Ordered Manual Checklist

Resolving the chicken-and-egg first, because it determines the ordering:

> **The problem.** Google's redirect URI needs the Vercel production URL. Auth needs Google's credentials. Circular.
>
> **The solve: the Vercel production URL is deterministic and knowable before the first successful deploy.** On import, Vercel assigns `https://<project-name>.vercel.app` immediately — before any build succeeds. Name the project `upper-i` and the URL is `https://upper-i.vercel.app`, registrable in Google Console right away.
>
> So the order is: **create the Vercel project (get the URL) → configure Google with that URL → paste all env vars → trigger the real deploy.** The first deploy failing (no env vars yet) is expected and harmless. If `upper-i` is taken globally, Vercel suffixes it — read the actual assigned domain from the dashboard at step 3 before doing step 5.

Checklist to be written in **Vietnamese**, numbered, per CONTEXT.md. English here for the planner; translate on delivery.

| # | Step | Where | Action | Time |
|---|---|---|---|---|
| 1 | Create Neon project | console.neon.tech | New Project → name `upper-i` → **Region: AWS `ap-southeast-1` (Singapore)** → Postgres 17 | 3 min |
| 2 | Copy both connection strings | Neon → Connect | Copy with "Connection pooling" **ON** → that's `DATABASE_URL`. Toggle **OFF** → that's `DATABASE_URL_UNPOOLED`. Paste both into local `.env.local`. | 2 min |
| 3 | Import repo to Vercel | vercel.com/new | Import `CielCiel1/upper-i`. Framework auto-detects Next.js. **Click Deploy — it will fail. Expected.** Then **write down the assigned production domain** from the dashboard. | 4 min |
| 4 | Create Google Cloud project | console.cloud.google.com | New Project named `upper-i` | 2 min |
| 5 | OAuth consent screen | APIs & Services → OAuth consent screen | User type **External**. App name `Upper-I`, support email, developer email. Scopes: **only** `openid`, `userinfo.email`, `userinfo.profile`. **Leave publishing status = Testing.** | 8 min |
| 6 | Add test users | consent screen → Test users | Add all ~10 member Gmail addresses. **Must match the `ALLOWLIST_EMAILS` list exactly.** | 3 min |
| 7 | Create OAuth client ID | Credentials → Create → OAuth client ID → Web application | **Authorized JavaScript origins:** `http://localhost:3000`, `https://<domain-from-step-3>`<br>**Authorized redirect URIs:** `http://localhost:3000/api/auth/callback/google`, `https://<domain-from-step-3>/api/auth/callback/google`<br>Copy Client ID + Secret. | 5 min |
| 8 | Generate auth secret | local terminal | `npx auth secret` → copy the value | 1 min |
| 9 | Paste env vars into Vercel | Vercel → Settings → Environment Variables | `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_TRUST_HOST=true`. Tick **Production + Preview + Development** for each. | 5 min |
| 10 | Trigger the real deploy | Vercel → Deployments | Redeploy latest, **untick "Use existing Build Cache"**. Build runs `generate && migrate deploy && next build`. | 3 min |
| 11 | Seed the allowlist | local terminal | Put member list in `.env.local` as `ALLOWLIST_EMAILS`, point `DATABASE_URL_UNPOOLED` at production, run `pnpm seed` | 3 min |
| 12 | Verify 0đ | Vercel → Settings → Billing; Neon → Billing | Confirm Vercel plan = **Hobby**, Neon plan = **Free**. Confirm no card attached to either. Satisfies INFRA-05 / success criterion #6. | 3 min |
| 13 | End-to-end check | phone, 4G | Open production URL → sign in with an allowlisted Google account → authenticated page shows your name. Then sign in with a **non**-allowlisted account → "Email này chưa được mời". | 5 min |

**Total ≈ 45 min**, with step 5 (consent screen) the slowest.

**Ordering dependencies — non-negotiable:**
- 3 → 7 (need the Vercel domain before registering redirect URIs)
- 7 → 9 (need Google credentials before pasting env vars)
- 9 → 10 (build fails without `DATABASE_URL_UNPOOLED`)
- 10 → 11 (seeding needs the tables that `migrate deploy` created)
- 6 ↔ 11 (**the two lists must match**; a Google test user missing from `Allowlist` gets through Google and is rejected by the app — and vice versa, an allowlisted email not in Google's test users never reaches the app at all)

---

## 9. Known Failure Modes

### F1 — `npm/pnpm i prisma` pulls `8.0.0-rc.20`
**Signature:** `@prisma/client did not initialize yet`, or type errors between CLI-generated client and installed runtime.
**Diagnostic:** `pnpm why prisma` shows 8.x while `@prisma/client` is 7.10.0.
**Prevention:** exact pins, no `^`. Verify with `pnpm list prisma @prisma/client` → both exactly `7.10.0`.
**Still live today.** [VERIFIED: `latest` = `8.0.0-rc.20`]

### F2 — `proxy.ts` at repo root is silently ignored (**fails open**)
**Signature:** build green, no warning, **every protected route publicly accessible**.
**Diagnostic:** `next build` output lacks the `ƒ Proxy (Middleware)` line.
**Prevention:** file at `src/proxy.ts`. Assert the build output contains `ƒ Proxy (Middleware)`.
**Worst failure in the phase** — it is a security hole that passes every other check. [VERIFIED]

### F3 — `cacheComponents` build failure on `cookies()`/`searchParams`
**Signature:** `Error: Route "/x": Next.js encountered uncached or runtime data during prerendering` → `Next.js build worker exited with code: 1`.
**Diagnostic:** the error names the exact route; the offending call is outside `<Suspense>`.
**Prevention:** dynamic reads inside `<Suspense>`; verify routes show `○`/`◐`, never `ƒ` (except `/api/*`). [VERIFIED both directions]

### F4 — `prisma generate` missing from the build
**Signature:** `Module not found: Can't resolve '@/generated/prisma/client'` on Vercel but fine locally (local has a stale generated dir).
**Diagnostic:** `rm -rf src/generated && pnpm build` locally reproduces it.
**Prevention:** `prisma generate` first in the build command; `/src/generated` gitignored so the gap is visible locally. [VERIFIED]

### F5 — `DATABASE_URL_UNPOOLED` unset at build time
**Signature:** `Failed to load config file ... PrismaConfigEnvError: Cannot resolve environment variable: DATABASE_URL_UNPOOLED`.
**Why misleading:** fires during `prisma generate`, which does not need a database. Looks like a connection problem; it is a config-load problem.
**Prevention:** env var set for all three Vercel environments. [VERIFIED]

### F6 — `redirect_uri_mismatch` from Google
**Signature:** Google error page: "Error 400: redirect_uri_mismatch".
**Diagnostic:** the error page shows the exact URI sent — diff it against Google Console character by character. Usual causes: missing `/api/auth/callback/google`, `http` vs `https`, trailing slash, or a preview deployment URL.
**Prevention:** register both localhost and production forms. Preview URLs are random and unregistrable — **sign-in on previews will not work, by design** (stack-deploy.md §3).

### F7 — `.env.example` silently not committed
**Signature:** `git status` clean, file absent from the repo; collaborators have no env template.
**Diagnostic:** `git check-ignore -v .env.example` names the `.env*` rule.
**Prevention:** add `!.env.example` after `.env*` in `.gitignore`. CONTEXT.md explicitly requires committing this file. [VERIFIED]

### F8 — Vitest install ERESOLVE on `@types/node`
**Signature:** `npm ERR! ERESOLVE ... Conflicting peer dependency: @types/node@26.6.4`.
**Prevention:** bump `@types/node` to `^22` before adding Vitest. Do **not** use `--legacy-peer-deps`. [VERIFIED]

### F9 — Allowlist/test-user list drift
**Signature:** a member either never reaches the app (missing from Google test users → Google blocks first) or sees "Email này chưa được mời" (missing from `Allowlist`).
**Diagnostic:** Google-side rejection happens on Google's domain before any redirect; app-side rejection lands on `/khong-duoc-moi?error=AccessDenied`. **Where the failure appears tells you which list is wrong.**
**Prevention:** accepted cost of Testing mode (CONTEXT.md). Checklist steps 6 and 11 must be done together from one source list.

### F10 — Session survives allowlist removal
**Signature:** a user removed from `Allowlist` keeps working for up to 30 days.
**Why:** `signIn` only runs at login. Database sessions give instant revocation **only if the `Session` row is deleted** — the allowlist row is not consulted per request.
**Prevention:** removal procedure must delete both the `Allowlist` row and that user's `Session` rows. See §6.2 — this is the argument for making the seed script authoritative.
**Note this contradicts the stated rationale in CONTEXT.md** ("Database session kiểm tra mỗi request nên thu hồi quyền có hiệu lực tức thì"). The session row is checked each request, but it is not re-validated against the allowlist. The decision to use database sessions is still right — it makes revocation *possible* in one DELETE — but it is not automatic. Worth surfacing to the user. [VERIFIED: `signIn` callback only invoked on the OAuth callback path, not on session reads]

---

## 10. Verified Working Skeleton

Everything below was built together at `/tmp/cna-test`; `pnpm build`, `tsc --noEmit`, `biome check`, and `vitest run` all pass.

```
upper-i/
├── biome.json                 # scaffolded + "!src/generated"
├── next.config.ts             # scaffolded (cacheComponents, turbopack tailwind rule)
├── package.json               # pinned deps + build/seed scripts
├── prisma.config.ts           # schema path, migrations.seed, datasource url
├── tsconfig.json              # scaffolded strict + noUncheckedIndexedAccess
├── vercel.json                # { "regions": ["sin1"] }
├── vitest.config.mts          # resolve.tsconfigPaths, environment node
├── .env.example               # committed (needs !.env.example in .gitignore)
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
└── src/
    ├── auth.ts
    ├── proxy.ts               # ← MUST be here, not repo root
    ├── generated/prisma/      # gitignored, built by `prisma generate`
    ├── lib/db.ts
    ├── components/sign-out-button.tsx
    └── app/
        ├── layout.tsx         # static shell + Inter + viewport
        ├── globals.css        # UI-SPEC @theme block
        ├── page.tsx           # authenticated page (Suspense-wrapped auth())
        ├── dang-nhap/page.tsx
        ├── khong-duoc-moi/page.tsx
        └── api/auth/[...nextauth]/route.ts
```

Expected `next build` output — **use this as the verification oracle**:

```
Route (app)
┌ ○ /
├ ○ /_not-found
├ ƒ /api/auth/[...nextauth]
└ ◐ /khong-duoc-moi
ƒ Proxy (Middleware)

○  (Static)             prerendered as static content
◐  (Partial Prerender)  prerendered as static HTML with dynamic server-streamed content
ƒ  (Dynamic)            server-rendered on demand
```

Three assertions a planner can turn directly into verification steps:
1. `ƒ Proxy (Middleware)` present → route guard wired (F2)
2. no app route is `ƒ` except `/api/*` → INFRA-07 holds (F3)
3. build reached the route table at all → `prisma generate` ran (F4)

### 10.1 `src/app/layout.tsx` [VERIFIED: builds with the UI-SPEC font + viewport config]

```tsx
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin', 'vietnamese'],   // 'vietnamese' REQUIRED — else ₫ and tone marks fall back
  display: 'swap',
  variable: '--font-inter',
  axes: ['opsz'],
})

export const metadata: Metadata = { title: 'Upper-I' }

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',               // REQUIRED for env(safe-area-inset-*)
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FAFAF9' },
    { media: '(prefers-color-scheme: dark)', color: '#0C0A09' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={inter.variable}>
      <body className="bg-surface text-ink font-sans">{children}</body>
    </html>
  )
}
```

The UI-SPEC's `axes: ['opsz']` with `subsets: ['latin','vietnamese']` compiles without error against `next/font/google` in 16.4.0. [VERIFIED]

`lang="vi"` matters for hyphenation and screen readers; the scaffold writes `lang="en"`.

---

## Package Legitimacy Audit

Run via `gsd-tools query package-legitimacy check --ecosystem npm`. [VERIFIED]

| Package | Registry | Downloads/wk | Source Repo | Verdict | Disposition |
|---|---|---|---|---|---|
| `next` | npm | 76,902,421 | github.com/vercel/next.js | SUS (`too-new`) | **Approved** — see note |
| `react` / `react-dom` | npm | >20M | github.com/facebook/react | SUS (`too-new`) | Approved |
| `prisma` | npm | 21,985,428 | github.com/prisma/prisma | SUS (`too-new`) | Approved |
| `@prisma/client` | npm | ~21M | github.com/prisma/prisma | SUS (`too-new`) | Approved |
| `@prisma/adapter-neon` | npm | 353,937 | github.com/prisma/prisma | **OK** | Approved |
| `@neondatabase/serverless` | npm | 5,195,688 | github.com/neondatabase/serverless | SUS (`too-new`) | Approved |
| `next-auth` | npm | 7,790,366 | github.com/nextauthjs/next-auth | **OK** | Approved |
| `@auth/prisma-adapter` | npm | 985,100 | github.com/nextauthjs/next-auth | **OK** | Approved |
| `tailwindcss` | npm | >10M | github.com/tailwindlabs/tailwindcss | SUS (`too-new`) | Approved |
| `@tailwindcss/turbopack` | npm | 18,287 | github.com/tailwindlabs/tailwindcss | **OK** | Approved |
| `vitest` | npm | 142,142,023 | github.com/vitest-dev/vitest | SUS (`too-new`) | Approved |
| `@biomejs/biome` | npm | 21,103,523 | github.com/biomejs/biome | SUS (`too-new`) | Approved |
| `tsx` | npm | 114,678,549 | github.com/privatenumber/tsx | SUS (`too-new`) | Approved |
| `dotenv` | npm | 226,599,258 | github.com/motdotla/dotenv | SUS (`too-new`) | Approved |

**On the `SUS` verdicts:** every one is flagged solely for `too-new` — meaning the *latest version* was published within the staleness window (these are actively maintained packages shipping frequent releases), not that the package is new. Each has millions of weekly downloads and a canonical first-party GitHub repo. **No `postinstall` scripts on any package** (checked — all `null`), which removes the main supply-chain execution vector.

**Packages removed due to SLOP verdict:** none.
**Packages requiring a human-verify checkpoint:** none. Every package here is first-party to a vendor already locked in PROJECT.md/CONTEXT.md and was discovered from official docs or the scaffold itself, not from a web search.

**Dropped** vs the original research question list: `@tailwindcss/postcss` (replaced by `@tailwindcss/turbopack` in the current scaffold), `vite-tsconfig-paths` and `@vitejs/plugin-react` (made redundant by Vite 8 native tsconfig paths).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| Node.js | everything | ✅ | v22.22.1 | — (≥22.12 needed for Vitest) |
| npm | fallback installer | ✅ | 9.2.0 | — |
| **pnpm** | CONTEXT.md locked PM | ❌ | — | **`npm i -g pnpm` or `corepack enable`** |
| git | repo | ✅ | repo initialized, remote set | — |
| Neon account | database | ❓ human | — | checklist step 1 |
| Vercel account | hosting | ❓ human | — | checklist step 3 |
| Google Cloud account | OAuth | ❓ human | — | checklist step 4 |

**Blocking with fallback:** `pnpm` is not installed. CONTEXT.md locks it as the package manager (Vercel detects it via `pnpm-lock.yaml`). **Plan must include installing it as its own first task** — `corepack enable pnpm` is preferable to a global npm install since Node 22 ships corepack. Everything in this document was verified with npm; no finding depends on the package manager except the ERESOLVE in F8, which pnpm reports differently but still rejects.

**Not blocking:** the three accounts are human steps already enumerated in §8.

---

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework | Vitest 5.0.3 |
| Config file | `vitest.config.mts` — **Wave 0 creates it** |
| Quick run command | `pnpm vitest run src/lib` |
| Full suite command | `pnpm test` (= `vitest run`) |

### Phase Requirements → Test Map

Phase 1 is mostly infrastructure; most requirements are verified by build output or manual UAT rather than unit tests. Being honest about that is more useful than inventing unit tests for OAuth.

| Req | Behavior | Test Type | Command | Exists? |
|---|---|---|---|---|
| INFRA-01 | strict TS, versions pinned | build | `pnpm tsc --noEmit && pnpm list prisma @prisma/client` | ❌ Wave 0 |
| INFRA-02 | local dev against Neon | manual | `pnpm dev` → page loads | manual |
| INFRA-03 | push → deploy | manual | observe Vercel dashboard | manual |
| INFRA-04 | migration auto-runs | build | build log contains `migrate deploy` output | manual |
| INFRA-05 | 0đ | manual | checklist step 12 | manual |
| INFRA-06 | pooled + adapter | unit | assert `DATABASE_URL` host contains `-pooler` | ❌ Wave 0 |
| INFRA-07 | static shell | build | build output shows `○`/`◐`, no app-route `ƒ` | ❌ Wave 0 |
| AUTH-01 | Google sign-in | manual (e2e) | checklist step 13 | manual |
| AUTH-02 | allowlist gate | unit + manual | allowlist-parser unit test + checklist step 13 | ❌ Wave 0 |
| AUTH-03 | session persists | manual | reopen app next day | manual |
| AUTH-06 | sign out | manual | tap button → `/dang-nhap` | manual |

Genuinely unit-testable in this phase:
- `parseAllowlist()` — lowercasing, label parsing, empty/missing input throwing. Pure function, no DB. **Worth testing** because a case bug here silently locks out a real member.
- a connection-string shape assertion for INFRA-06.

The `signIn` callback is not worth unit-testing — mocking Prisma and the Auth.js profile object tests the mock, not the behavior. Its real verification is checklist step 13 plus the "no `User` row created" DB assertion from §4.3.

### Sampling Rate
- **Per task commit:** `pnpm vitest run src/lib`
- **Per wave merge:** `pnpm test && pnpm tsc --noEmit && pnpm lint`
- **Phase gate:** full suite green + `next build` route table matches §10 before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `vitest.config.mts` — framework config
- [ ] `src/lib/allowlist.ts` — extract `parseAllowlist` out of `prisma/seed.ts` so it is importable/testable
- [ ] `src/lib/allowlist.test.ts` — covers AUTH-02 parsing
- [ ] `@types/node` bump to `^22` — must precede the Vitest install (F8)

> Extracting `parseAllowlist` into `src/lib/allowlist.ts` is a small but real design call: `prisma/seed.ts` sits outside `src/` and is awkward to import from a test. Have the seed script import from `src/lib/`.

---

## Security Domain

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | yes | Auth.js v5 + Google OAuth. No passwords stored — no credential handling to get wrong. |
| V3 Session Management | yes | Database sessions, 30-day `maxAge`, httpOnly cookies set by Auth.js. Revocation = DELETE the `Session` row. |
| V4 Access Control | yes | `signIn` allowlist (login-time) + `src/proxy.ts` (per-request). **Both required** — see F2/F10. |
| V5 Input Validation | partial | Only input this phase is `ALLOWLIST_EMAILS` (operator-supplied, local). Real surface arrives in Phase 2. |
| V6 Cryptography | yes | `AUTH_SECRET` via `npx auth secret`. Never hand-roll; never commit. |

| Threat | STRIDE | Mitigation |
|---|---|---|
| Non-member signs in | Spoofing | Two gates: Google test-user list + DB `Allowlist` in `signIn` |
| Route guard fails open | Elevation of Privilege | **F2** — `src/proxy.ts` placement; assert `ƒ Proxy (Middleware)` in build output |
| Removed member retains access | Elevation of Privilege | **F10** — delete `Session` rows, not just the `Allowlist` row |
| Secrets in git | Information Disclosure | `.env*` gitignored with `!.env.example`; real values only in the Vercel dashboard |
| Server action invoked without auth | Elevation of Privilege | `proxy.ts` does **not** protect server actions — re-check `auth()` inside each one (stack-deploy.md §3). Phase 1 has only `signOut`; establish the pattern now for Phase 2. |
| OAuth token leakage via extra scopes | Information Disclosure | Request only `openid`, `email`, `profile` |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | Making the seed script authoritative (deleting rows absent from env) is in scope | §6.2 | Scope creep if not wanted; if omitted, member removal stays a manual two-statement runbook |
| A2 | Vercel assigns `https://upper-i.vercel.app` on import, before first successful build | §8 | If the name is taken, the domain differs — checklist step 3 instructs reading the actual domain, so this self-corrects |
| A3 | `provider = "prisma-client"` preferred over `"prisma-client-js"` | §3.2 | Both verified working; this is a style/longevity call, not correctness |
| A4 | `environment: 'node'` suffices for Phase 1–2 tests | §2.6 | If a component test is wanted later, add `jsdom` — a one-line config change |
| A5 | Biome 2.4.2 (scaffold pin) rather than 2.5.15 | §1.4 | None material; bumping requires updating the `$schema` URL too |
| A6 | `noUncheckedIndexedAccess` is worth enabling now | §2.3 | Slightly more verbose code in Phase 2; cheaper now than retrofitting |

---

## Open Questions

1. **Should member *removal* be automated in the seed script?**
   - Known: `upsert` never deletes; database sessions outlive allowlist removal (F10).
   - Unclear: whether CONTEXT.md's "thêm thành viên" intends removal symmetry.
   - Recommendation: implement delete-and-revoke in the seed script (~10 lines). It makes `ALLOWLIST_EMAILS` the single source of truth, matching the project's core anti-drift value. Surface to the user during planning.

2. **`create-next-app` will overwrite the existing `AGENTS.md`.**
   - Known: the scaffold writes its own.
   - Recommendation: `--no-agents-md`, or back up and restore. Must be an explicit ordered task, not an afterthought.

3. **`Allowlist` vs `AllowedEmail` model name.**
   - stack-deploy.md uses `AllowedEmail`; this doc uses `Allowlist`. Purely naming. Planner picks one and applies it in schema, seed, and `auth.ts` consistently.

---

## Sources

### Primary (HIGH — executed or read directly)
- `npm view <pkg> dist-tags|peerDependencies|engines|scripts` — all version claims, 2026-10-07
- Live build at `/tmp/cna-test` — scaffold contents, Tailwind v4 compile, `cacheComponents` failure + fix, `proxy.ts` placement, `prisma generate` necessity, Vitest ERESOLVE, `.gitignore` behavior, Biome diagnostics, Inter font config
- `node_modules/@auth/core/lib/actions/callback/index.js` — signIn-before-create ordering (AUTH-02)
- `node_modules/@auth/core/errors.js` — `clientErrors` set, `AccessDenied` routing
- `node_modules/@auth/prisma-adapter/index.js` — required schema fields
- `node_modules/@prisma/config/dist/index.d.ts` — `migrations.seed`, `datasource.url`
- `gsd-tools query package-legitimacy check` — supply-chain audit

### Secondary (MEDIUM — official docs)
- nextjs.org/docs/app/api-reference/file-conventions/proxy (`version: 16.4.0`, `lastUpdated: 2026-09-04`)
- prisma.io/docs/orm/v7/reference/prisma-config-reference
- vercel.com/docs/project-configuration/vercel-json (`last_updated: 2026-08-14`)
- vercel.com/docs/regions — `sin1` ↔ `ap-southeast-1`
- authjs.dev/reference/nextjs

### Project-level (cited, not duplicated)
- `.planning/research/stack-deploy.md` §1 free-tier limits, §2 Neon/keep-alive, §3 Google Console walkthrough + server-action auth, §4 identity layering, §5 deploy sequence + preview strategy, §6 PWA

---

## Metadata

**Confidence breakdown:**
- Version matrix: **HIGH** — resolved from registry and installed together successfully
- Scaffold delta: **HIGH** — ran the CLI, inspected every file
- Prisma 7 wiring: **HIGH** — validate + generate + build all pass
- Auth.js allowlist semantics: **HIGH** — read library source, not docs
- Vercel pipeline: **MEDIUM-HIGH** — docs verified; not executed against a live Vercel project
- Manual checklist: **MEDIUM** — vendor UIs change; the ordering logic is sound but exact button labels may drift
- Failure modes: **HIGH** — F1–F8 reproduced locally; F9/F10 reasoned from verified source behavior

**Research date:** 2026-10-07
**Valid until:** ~2026-11-07 (30 days). Shorten to 7 days for `next-auth`, which is pre-release and has shipped breaking beta-to-beta changes.

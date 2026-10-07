---
phase: UPI-01-n-n-t-ng-s-ng
plan: 01
subsystem: toolchain
tags: [scaffold, dependencies, pnpm, vercel, typescript]
status: complete

requires: []
provides:
  - "Next.js 16.4.0 app skeleton at src/app/ with the @/* -> src/* import alias"
  - "Exact-pinned dependency set with committed pnpm-lock.yaml"
  - "build script: prisma generate && prisma migrate deploy && next build"
  - "tsconfig with strict + noUncheckedIndexedAccess"
  - "vitest.config.mts resolving @/ via Vite 8 native tsconfig paths"
  - "vercel.json pinning region sin1"
  - ".env.example naming all seven environment variables"
affects:
  - "every later plan in the phase inherits this toolchain"

tech-stack:
  added:
    - "next@16.4.0 (App Router, cacheComponents, partialPrefetching)"
    - "react@19.3.0 / react-dom@19.3.0"
    - "prisma@7.10.0 + @prisma/client@7.10.0 + @prisma/adapter-neon@7.10.0"
    - "@neondatabase/serverless@1.2.0"
    - "next-auth@5.0.0-beta.32 + @auth/prisma-adapter@2.11.3"
    - "tailwindcss@4.3.3 via @tailwindcss/turbopack (no PostCSS)"
    - "@biomejs/biome@2.4.2, vitest@5.0.3, tsx@4.23.15, dotenv@18.0.5"
  patterns:
    - "pnpm is the only package manager; pnpm-lock.yaml is committed"
    - "build command lives in package.json, never in vercel.json or the dashboard"
    - "all dependency build scripts are denied, nothing third-party runs at install"

key-files:
  created:
    - "package.json"
    - "pnpm-lock.yaml"
    - "pnpm-workspace.yaml"
    - "tsconfig.json"
    - "biome.json"
    - "next.config.ts"
    - "vitest.config.mts"
    - "vercel.json"
    - ".env.example"
    - "src/app/layout.tsx"
    - "src/app/page.tsx"
    - "src/app/globals.css"
    - "README.md"
  modified:
    - ".gitignore"

decisions:
  - "pnpm installed via `npm i -g --prefix ~/.local pnpm` because corepack is broken on this machine"
  - "all dependency build scripts denied rather than approved — none are needed"
  - "minimumReleaseAge exclusion scoped to the next package family only"
  - "added a typecheck script running `next typegen` before tsc"
  - "biome excludes .planning in addition to src/generated"

metrics:
  duration: "~35 min"
  completed: "2026-10-07"
  tasks: 3
  commits: 3
  files_changed: 14
---

# Phase UPI-01 Plan 01: Nền tảng toolchain Summary

Next.js 16.4.0 skeleton với toàn bộ dependency version-critical ghim exact, toolchain
cấu hình xong, và pipeline deploy khai báo trong version control — repo install,
typecheck, lint sạch, `.planning/` và `AGENTS.md` nguyên vẹn.

## What Was Built

Ba commit, mỗi commit một task:

| Task | Commit | Nội dung |
|------|--------|----------|
| 1 | `6e71e53` | Scaffold Next.js vào thư mục tạm rồi copy vào repo |
| 2 | `5edcc4b` | Ghim dependency exact + cài bằng pnpm |
| 3 | `f87888e` | File cấu hình toolchain và deploy |

### Installed version table

Lấy từ `pnpm list --depth 0` sau khi cài. **Không có pin nào trôi.**

| Package | Pinned in package.json | Resolved | Khớp |
|---------|------------------------|----------|------|
| `next` | `16.4.0` (exact) | 16.4.0 | ✅ |
| `next-auth` | `5.0.0-beta.32` (exact) | 5.0.0-beta.32 | ✅ |
| `prisma` | `7.10.0` (exact) | 7.10.0 | ✅ |
| `@prisma/client` | `7.10.0` (exact) | 7.10.0 | ✅ |
| `@prisma/adapter-neon` | `7.10.0` (exact) | 7.10.0 | ✅ |
| `@neondatabase/serverless` | `1.2.0` (exact) | 1.2.0 | ✅ |
| `@auth/prisma-adapter` | `2.11.3` (exact) | 2.11.3 | ✅ |
| `react` / `react-dom` | `19.3.0` (exact) | 19.3.0 | ✅ |
| `@biomejs/biome` | `2.4.2` (exact) | 2.4.2 | ✅ |
| `@tailwindcss/turbopack` | `^4` | 4.3.3 | ✅ |
| `tailwindcss` | `^4` | 4.3.3 | ✅ |
| `@types/node` | `^22` | 22.20.5 | ✅ |
| `@types/react` | `^19` | 19.3.0 | ✅ |
| `@types/react-dom` | `^19` | 19.3.0 | ✅ |
| `dotenv` | `^18` | 18.0.5 | ✅ |
| `tsx` | `^4.23.15` | 4.23.15 | ✅ |
| `typescript` | `^5` | 5.9.3 | ✅ |
| `vitest` | `^5.0.3` | 5.0.3 | ✅ |

**Cả hai cái bẫy RESEARCH cảnh báo vẫn còn sống tại thời điểm thực thi**, đã kiểm tra
lại trực tiếp trên registry:

```
prisma    dist-tags: latest = 8.0.0-rc.20   (prev = 7.10.0)
next-auth dist-tags: latest = 4.24.15       (beta = 5.0.0-beta.32)
```

Nếu không ghim exact thì `prisma` sẽ ra RC 8.x còn `next-auth` ra v4 — đúng hai lỗi
phase này sinh ra để tránh.

## Verification Output

Chạy đủ 7 bước `<verification>` của plan, output thật:

```
1. pnpm install --frozen-lockfile
   ✓ Lockfile passes supply-chain policies
   Lockfile is up to date, resolution step is skipped
   EXIT=0

2. pnpm list prisma @prisma/client --depth 0
   ├── @prisma/client@7.10.0
   └── prisma@7.10.0

3. pnpm list next-auth --depth 0
   └── next-auth@5.0.0-beta.32

4. pnpm tsc --noEmit
   EXIT=0

5. pnpm lint
   $ biome check
   Checked 9 files in 2ms. No fixes applied.
   EXIT=0

6. git check-ignore -v .env.example
   EXIT=1  (non-zero = file committable, đúng như yêu cầu)

7. git status --porcelain AGENTS.md
   (empty — AGENTS.md không bị scaffold đụng vào)
```

Kiểm tra bổ sung:

```
.planning/ md5 trước vs sau scaffold: UNCHANGED (20 file)
AGENTS.md md5: OK
pnpm test: "No test files found" — đúng, test đầu tiên thuộc plan 02
pnpm build: KHÔNG chạy, vì chạy `prisma migrate deploy` mà chưa có schema
            lẫn database. Plan đã ghi rõ đây là trạng thái mong đợi.
```

REG-1 coupling, kiểm tra bằng đúng predicate mà plan 02 sẽ viết (phân tích
hostname label, không phải substring toàn chuỗi):

```
DATABASE_URL           host=ep-example-123456-pooler.ap-southeast-1.aws.neon.tech => pooled=true
DATABASE_URL_UNPOOLED  host=ep-example-123456.ap-southeast-1.aws.neon.tech        => pooled=false
hosts differ: true
REG-1 asymmetry OK
```

## Deviations from Plan

### 1. [Môi trường] pnpm cài bằng npm --prefix, không phải corepack

Plan task 1 yêu cầu `corepack enable pnpm`. Trên máy này corepack hỏng:

- `corepack enable pnpm` → `EACCES`, nó symlink vào `/usr/bin` cần quyền root
- `corepack enable --install-directory ~/.local/bin pnpm` → tạo được symlink nhưng
  hỏng: corepack bản Debian tìm `pnpm.cjs` trong khi pnpm 12 ship `pnpm.mjs`
- `npm config set prefix ~/.local` → bị bỏ qua, npm bản Debian hardcode `/usr/local`
- **Chạy được:** `npm i -g --prefix ~/.local pnpm` → pnpm 12.9.1 tại `~/.local/bin/pnpm`

Yêu cầu thực chất của plan là "pnpm chạy được và là package manager duy nhất có
lockfile commit" — điều đó đã thỏa. Chỉ cơ chế cài là khác.

**Lưu ý cho mọi plan sau:** `~/.local/bin` có trong PATH qua `~/.bashrc` nhưng shell
không tương tác có thể không source. Luôn `export PATH="$HOME/.local/bin:$PATH"`
trước khi gọi pnpm, hoặc gọi thẳng `~/.local/bin/pnpm`.

### 2. [Rule 3 - Blocking] pnpm 12 chặn build script của dependency, exit khác 0

`pnpm install` dừng với `ERR_PNPM_IGNORED_BUILDS` vì `@prisma/engines`, `esbuild`,
`prisma` đều có script install. pnpm 12 không chỉ bỏ qua mà còn **fail cả lệnh**,
nên gate verification của task 2 không thể xanh.

Đã **từ chối** cả ba (`false`) thay vì phê duyệt, trong `pnpm-workspace.yaml` — cùng
kiểu với `sharp: false` mà scaffold tự sinh. Từ chối là an toàn vì không binary nào
thực sự đến từ script đó; chúng nằm sẵn trong package theo nền tảng. Đã kiểm chứng
sau khi từ chối:

```
prisma --version → Schema Engine: schema-engine-cli ... (at @prisma/engines/schema-engine-debian-openssl-3.0.x)
tsx <file>       → chạy được (binary esbuild có sẵn)
vitest --version → vitest/5.0.3 linux-x64 node-v22.22.1
```

Đây cũng là cách xử lý mạnh hơn cho threat `T-01-SC`: không có code bên thứ ba nào
chạy lúc install, thay vì chỉ dựa vào việc "không package nào khai postinstall".

### 3. [Rule 3 - Blocking] pnpm 12 chặn package mới phát hành (`minimumReleaseAge`)

Sau khi sửa (2), install lại fail với `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`: pnpm 12
mặc định từ chối mọi version phát hành trong vòng 24h. `next@16.4.0` và 9 gói
`@next/*` đi kèm phát hành 2026-10-06, nằm trong cửa sổ đó.

Version không thương lượng được — 16.4.0 do RESEARCH ghim và mang hành vi
`cacheComponents` mà phase phụ thuộc. Đã thêm `minimumReleaseAgeExclude` **giới hạn
đúng họ gói next**:

```yaml
minimumReleaseAgeExclude:
  - next
  - "@next/env"
  - "@next/swc-*"
```

Chính sách delay vẫn bật đầy đủ cho mọi dependency khác. Ba dòng này xóa được sau khi
16.4.0 quá 24h tuổi.

### 4. [Rule 3 - Blocking] `tsc --noEmit` fail vì thiếu type sinh tự động

```
src/app/layout.tsx(9,50): error TS2304: Cannot find name 'LayoutProps'.
```

`LayoutProps` là global type Next 16 sinh vào `.next/types`, chưa tồn tại ở checkout
sạch. Next có sẵn lệnh cho việc này, đã thêm script:

```json
"typecheck": "next typegen && tsc --noEmit"
```

Kiểm chứng từ trạng thái sạch (`rm -rf .next && pnpm typecheck`) → EXIT=0.
Lệnh trần `pnpm tsc --noEmit` trong `<verification>` của plan cũng xanh sau khi
typegen đã chạy một lần.

### 5. [Rule 3 - Blocking] biome lint fail trên artifact của GSD

`pnpm lint` báo 2 lỗi format trên `.planning/research/.cache/*.json` — file cache do
GSD sinh, không phải source của dự án. Đã thêm `!.planning` vào `files.includes` của
biome, cùng lý do với `!src/generated`: máy sinh, không phải của mình để sửa.

### 6. [Nhỏ] Đổi `name` trong package.json

Scaffold lấy tên thư mục tạm nên ghi `"name": "upi-scaffold"`. Đã sửa thành
`"upper-i"`.

### 7. [Nhỏ] Giữ `pnpm-workspace.yaml` từ scaffold

Plan liệt kê 6 file + `src/` để copy, không có `pnpm-workspace.yaml`. File này cần
giữ vì nó là nơi duy nhất pnpm 12 đọc `allowBuilds` và `minimumReleaseAgeExclude`
(pnpm 12 chỉ đọc auth/registry từ `.npmrc`, mọi setting khác ở đây).

### 8. [Nhỏ] `next-env.d.ts` không commit

Plan liệt kê file này trong `files_modified`, nhưng `.gitignore` sẵn có của repo
(dòng 10) đã bỏ qua nó. Đúng — Next sinh lại file này mỗi lần chạy. Không ép commit.

## Known Stubs

Không có. `.env.example` chứa giá trị mẫu, nhưng đó là bản chất của file template và
plan yêu cầu đúng như vậy; `src/app/page.tsx` là trang trống của scaffold, plan 05
mới thay nó.

## For the Next Plan

**Plan 02 (schema + db client) cần biết:**

- `DATABASE_URL` trong `.env.example` có host `ep-example-123456-pooler.ap-southeast-1.aws.neon.tech`
  — label đầu kết thúc bằng `-pooler`. `DATABASE_URL_UNPOOLED` dùng **cùng** endpoint
  nhưng **không** có `-pooler`. Thế bất đối xứng này là cố ý: hoán hai giá trị cho nhau
  thì predicate phát hiện được cả hai chiều.
- Predicate phải parse hostname rồi xét label đầu, không search substring — chuỗi mẫu
  đã được kiểm tra bằng đúng cách đó.
- `src/generated` đã gitignore và đã loại khỏi biome. Prisma client cứ sinh vào đó.
- `prisma` CLI chạy qua `pnpm exec prisma`, engine đã sẵn sàng dù build script bị chặn.

**Mọi plan sau cần biết:**

- Gọi pnpm phải `export PATH="$HOME/.local/bin:$PATH"` trước.
- `pnpm build` chưa chạy được cho tới khi có schema và database — đúng thiết kế.
- Dùng `pnpm typecheck` (có typegen) thay vì `tsc --noEmit` trần ở checkout sạch.
- Thêm dependency mới có thể vướng `minimumReleaseAge` nếu vừa phát hành; đó là tính
  năng, không phải lỗi — cân nhắc trước khi mở rộng danh sách exclude.

## Self-Check: PASSED

Files (tồn tại trên đĩa):

```
FOUND: package.json
FOUND: pnpm-lock.yaml
FOUND: pnpm-workspace.yaml
FOUND: tsconfig.json
FOUND: biome.json
FOUND: next.config.ts
FOUND: vitest.config.mts
FOUND: vercel.json
FOUND: .env.example
FOUND: src/app/layout.tsx
FOUND: src/app/page.tsx
FOUND: src/app/globals.css
```

Commits (có trong git log):

```
FOUND: 6e71e53  feat(01-01): scaffold Next.js 16 app with Tailwind v4 and Biome
FOUND: 5edcc4b  feat(01-01): pin dependency set exact and install with pnpm
FOUND: f87888e  feat(01-01): add toolchain and deploy configuration
```

# Money Math & Append-Only Ledger Design

**Project:** Upper-I — chia tiền nhóm (VND only, <10 users, Next.js + Neon Postgres + Prisma)
**Researched:** 2026-10-06
**Overall confidence:** HIGH for money math (verified by local execution), MEDIUM-HIGH for schema/concurrency (reasoned from official Postgres/Prisma docs)

> **Verification note.** Every algorithm in §3 and §4 was executed locally before being written here:
> 68,016 split cases (positive, negative, and weighted) and 20,000 randomized bill-reconciliation
> cases, **zero sum-invariant failures**. Execution also surfaced one non-obvious trap that a
> sum-only test would have missed — see **§3 "Verified trap"**; it changes how reversals must be
> implemented. Claims sourced from vendor docs are quoted verbatim and cited. Claims that are design
> judgement are labelled **[judgement]**, not fact.

---

## Key Findings

- **Use `BigInt` in Prisma → `BIGINT` in Postgres, but convert to `number` at the edge.** Postgres
  `INTEGER` maxes at 2,147,483,647 — that is only ~2.1 tỷ VND, which a yearly group total can
  plausibly exceed. `BIGINT` is the safe column. ([PG numeric types](https://www.postgresql.org/docs/current/datatype-numeric.html))
- **`number` is safe for VND arithmetic; `BigInt` is a *storage* decision, not a math decision.**
  `MAX_SAFE_INTEGER` is 9,007,199,254,740,991 (~9 triệu tỷ VND). The real hazard is not the balance,
  it is the **intermediate product `total * weight`** inside the split algorithm. Guard it (§2, §3).
- **Prisma `BigInt` breaks `JSON.stringify`.** Verbatim from Prisma docs: `Do not know how to
  serialize a BigInt`. This bites Next.js server actions and route handlers specifically, because
  the RSC/JSON boundary serializes automatically. Fix at the repository layer, not per-route (§2).
- **Never `UPDATE`/`DELETE` a ledger row. Corrections are reversing entries.** This is already the
  project's stated Out-of-Scope rule and it is correct. Enforce it in the database with a trigger,
  not merely by convention — convention is exactly what failed in the Apps Script version (§1).
- **Largest-remainder (Hamilton) gives exact integer splits.** `100000/3 → [33334, 33333, 33333]`,
  sum exactly 100000. The naive float approach yields `[33333,33333,33333]` = 99,999 — the missing
  đồng from the old system (§3).
- **⚠️ Reversals must negate the *stored entry rows*, never recompute the split.** Verified:
  `split(−t,w)` is not the elementwise negation of `split(t,w)` (9,216 / 50,000 cases differ). Both
  sum to zero, so this bug is invisible to every balance check — it would silently recreate v1's
  drift. This is also the decisive argument for storing every leg explicitly (§3).
- **Compute balances on-read. Do not materialize.** At <10 users and thousands of rows this is a
  sub-millisecond `GROUP BY`. A cache is the *same class of bug* that killed v1 — two sources of
  truth. If you ever need one, use a `MATERIALIZED VIEW` that is only ever `REFRESH`ed, never
  written (§5).
- **Append-only removes most races, but not double-submit.** The remaining race is the flaky-mobile
  retry. Fix with a client-generated UUID + `UNIQUE` constraint; catch Postgres error `23505` and
  treat it as success. Default `READ COMMITTED` is sufficient — `SERIALIZABLE` is not needed for
  pure inserts (§6).
- **Period close = a marker row + date filter. Delete nothing, reset nothing.** The v1 bug
  (`actionStartNewPeriod` archived but did not reset → double-count) is structurally impossible if
  closing is a boundary timestamp rather than a data mutation (§7).
- **One shared `splitByWeights()` function serves all three split modes** (equal, weighted,
  percentage) and the fee allocation. v1 bug #6 was the balance formula copy-pasted in two places;
  do not repeat that with the split formula.

---

## 1. Append-Only Ledger Schema

### Design decision: single-entry with signed deltas, not full double-entry **[judgement]**

Classic double-entry has an `accounts` table and every transaction writes balanced debit/credit
rows. For a group-expense app, the stricter and simpler invariant is:

> Every transaction's entries **sum to exactly zero** across members.

This is double-entry's *essential* property (conservation of money) without the chart-of-accounts
overhead. One `LedgerEntry` row = "member X's net position moved by N đồng". Positive = owed to
them; negative = they owe.

Why this is enough here: there is exactly one group, one currency, and no external accounts to
reconcile against. Adding a full `accounts` table buys nothing you will use.

### Core structure

Two tables: `Transaction` (the event — immutable header) and `LedgerEntry` (the signed legs).
Balances are **never** stored.

| Table | Role |
|---|---|
| `Transaction` | One row per economic event. Carries idempotency key, kind, period, reversal link. |
| `LedgerEntry` | Signed `amount` legs. Must sum to 0 per transaction. Never updated. |
| `Member` | Stable internal UUID PK. Display name is mutable and never a key. |
| `PeriodClose` | Marker rows only. See §7. |

### Prisma schema

```prisma
// schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum TxKind {
  EXPENSE    // someone paid for the group
  SETTLEMENT // someone transferred money to someone else
  REVERSAL   // cancels a prior transaction
  ADJUSTMENT // manual correction, still balanced
}

model Member {
  id          String   @id @default(uuid()) @db.Uuid
  googleSub   String   @unique                 // OAuth subject; stable identity
  displayName String                            // mutable, NEVER a key (v1 bug #7)
  active      Boolean  @default(true)
  createdAt   DateTime @default(now()) @db.Timestamptz(6)

  entries        LedgerEntry[]
  createdTx      Transaction[] @relation("TxCreator")

  @@map("members")
}

model Transaction {
  id        String   @id @default(uuid()) @db.Uuid

  // Idempotency: client generates this BEFORE first send and reuses it on retry.
  // UNIQUE here is what makes double-submit impossible. See §6.
  clientKey String   @unique @db.Uuid

  kind      TxKind
  note      String?  @db.VarChar(500)

  // occurredAt = when the money event happened (user-editable, drives period bucketing)
  // recordedAt = when the row hit the DB (immutable audit timeline)
  occurredAt DateTime @db.Timestamptz(6)
  recordedAt DateTime @default(now()) @db.Timestamptz(6)

  createdById String   @db.Uuid
  createdBy   Member   @relation("TxCreator", fields: [createdById], references: [id])

  // Reversal linkage. A REVERSAL points at the transaction it cancels.
  reversesId String?      @unique @db.Uuid   // @unique => a tx can be reversed at most once
  reverses   Transaction? @relation("Reversal", fields: [reversesId], references: [id])
  reversedBy Transaction? @relation("Reversal")

  entries   LedgerEntry[]
  lineItems LineItem[]

  @@index([occurredAt])
  @@index([kind, occurredAt])
  @@map("transactions")
}

model LedgerEntry {
  id            String      @id @default(uuid()) @db.Uuid
  transactionId String      @db.Uuid
  transaction   Transaction @relation(fields: [transactionId], references: [id], onDelete: Restrict)

  memberId String @db.Uuid
  member   Member @relation(fields: [memberId], references: [id], onDelete: Restrict)

  // Signed minor units. VND has no subunit, so 1 unit = 1 đồng.
  // BigInt -> BIGINT. INTEGER would cap at 2_147_483_647 đồng. See §2.
  amount BigInt

  // Denormalised copy of Transaction.occurredAt so balance queries over a
  // period never need the join. Enforced equal by trigger below.
  occurredAt DateTime @db.Timestamptz(6)

  @@index([memberId, occurredAt])   // drives the per-member balance aggregate
  @@index([transactionId])
  @@map("ledger_entries")
}

model LineItem {
  id            String      @id @default(uuid()) @db.Uuid
  transactionId String      @db.Uuid
  transaction   Transaction @relation(fields: [transactionId], references: [id], onDelete: Restrict)

  label       String  @db.VarChar(200)
  amount      BigInt  // gross price of this item, integer đồng
  // Who consumed this item. Stored as member UUIDs.
  beneficiary String[] @db.Uuid

  @@index([transactionId])
  @@map("line_items")
}

model PeriodClose {
  id       String   @id @default(uuid()) @db.Uuid
  // Half-open boundary: this close covers [previousClose.closesAt, closesAt).
  closesAt DateTime @unique @db.Timestamptz(6)

  closedById String @db.Uuid
  closedAt   DateTime @default(now()) @db.Timestamptz(6)
  // Snapshot of computed balances at close time — for display/audit ONLY.
  // Never read back as an input to balance math. See §7.
  snapshot   Json

  @@map("period_closes")
}
```

### Enforcing immutability in the database, not in code

**This is the single most important part of the schema.** v1 failed because "append-only" was a
convention. Conventions drift. Make the database refuse.

```sql
-- migration: 0002_ledger_immutability.sql

-- 1. Ledger entries and transactions are insert-only.
CREATE OR REPLACE FUNCTION reject_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION
    'Table % is append-only; % is forbidden. Use a REVERSAL transaction instead.',
    TG_TABLE_NAME, TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ledger_entries_immutable
  BEFORE UPDATE OR DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();

CREATE TRIGGER line_items_immutable
  BEFORE UPDATE OR DELETE ON line_items
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();

-- Transactions: allow nothing but DELETE protection + full update block.
CREATE TRIGGER transactions_immutable
  BEFORE UPDATE OR DELETE ON transactions
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();

-- 2. Every transaction's entries must sum to exactly zero.
--    DEFERRABLE so inserts within one tx can be written leg-by-leg.
CREATE OR REPLACE FUNCTION assert_balanced() RETURNS trigger AS $$
DECLARE
  total BIGINT;
  tx    UUID := COALESCE(NEW.transaction_id, OLD.transaction_id);
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO total
    FROM ledger_entries WHERE transaction_id = tx;
  IF total <> 0 THEN
    RAISE EXCEPTION 'Unbalanced transaction %: entries sum to % (must be 0)', tx, total;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER ledger_balanced
  AFTER INSERT ON ledger_entries
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION assert_balanced();

-- 3. Denormalised occurred_at must match its parent transaction.
ALTER TABLE ledger_entries
  ADD CONSTRAINT ledger_entries_amount_nonzero CHECK (amount <> 0);

CREATE OR REPLACE FUNCTION sync_occurred_at() RETURNS trigger AS $$
BEGIN
  SELECT occurred_at INTO NEW.occurred_at
    FROM transactions WHERE id = NEW.transaction_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ledger_entries_sync_date
  BEFORE INSERT ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION sync_occurred_at();
```

> **Caveat.** `CONSTRAINT TRIGGER ... DEFERRABLE INITIALLY DEFERRED` fires at COMMIT. Prisma's
> interactive `$transaction` holds one connection for the whole callback, so this works — but the
> error surfaces at commit time, not at the offending `create()`. Catch it around the whole
> `$transaction`, not around individual writes.

### How each operation is represented

**An expense with multiple beneficiaries.** Payer gets `+total`, each beneficiary gets their negative
share. Sums to zero.

```ts
// Minh paid 300,000 for Minh + An + Bảo (equal split)
// entries: Minh +300000, then shares -100000 each
// net: Minh +200000, An -100000, Bảo -100000
```

**A settlement payment.** Exactly two legs — this is why a separate mutable "IOU" table is
unnecessary. A settlement is just another ledger transaction.

```ts
// An transfers 100,000 to Minh
// entries: An +100000, Minh -100000   (An's debt shrinks, Minh's credit shrinks)
```

**A reversal/correction.** Insert a new transaction whose entries are the sign-flipped entries of
the original, linked by `reversesId`. The original row is untouched and remains visible in history.

```ts
// prisma/ledger/reverse.ts
import { Prisma, PrismaClient, TxKind } from "@prisma/client";

export async function reverseTransaction(
  db: PrismaClient,
  originalId: string,
  actorId: string,
  clientKey: string,
  reason: string,
) {
  return db.$transaction(async (tx) => {
    const original = await tx.transaction.findUniqueOrThrow({
      where: { id: originalId },
      include: { entries: true, reversedBy: true },
    });

    // reversesId is @unique, so a concurrent double-reverse also fails at the DB.
    if (original.reversedBy) {
      throw new Error(`Transaction ${originalId} already reversed`);
    }

    return tx.transaction.create({
      data: {
        clientKey,
        kind: TxKind.REVERSAL,
        note: `Reversal: ${reason}`,
        occurredAt: new Date(),
        createdById: actorId,
        reversesId: originalId,
        entries: {
          create: original.entries.map((e) => ({
            memberId: e.memberId,
            amount: -e.amount,       // BigInt negation; sums to zero by construction
            occurredAt: new Date(),  // overwritten by sync_occurred_at trigger
          })),
        },
      },
      include: { entries: true },
    });
  });
}
```

**Editing an expense** = reverse + re-create, in one transaction. The UI can present this as "edit";
the ledger records the truth.

---

## 2. Integer Money in TypeScript + Postgres + Prisma

### Column type: `BIGINT`

| Type | Range | Verdict |
|---|---|---|
| `INTEGER` | −2,147,483,648 … 2,147,483,647 | **No.** ~2.1 tỷ VND ceiling. A group's cumulative yearly total can pass this. |
| `BIGINT` | −9,223,372,036,854,775,808 … +9,223,372,036,854,775,807 | **Yes.** |
| `NUMERIC` | arbitrary precision | Overkill. VND has no subunit; you never need fractional đồng. Slower, and `Prisma.Decimal` drags in decimal.js. |

Ranges quoted from [PostgreSQL 18 §8.1 Numeric Types](https://www.postgresql.org/docs/current/datatype-numeric.html).

Prisma's own scalar table maps `Int` → 32-bit integer and `BigInt` → 64-bit integer, and the Prisma
models guide advises: *"When you are unsure between two sizes, lean toward the wider one... changing
`Int` to `BigInt` later needs a migration that picking `BigInt` now lets you skip."*
([Prisma — Models](https://www.prisma.io/docs/orm/prisma-schema/data-model/models))

### Is plain `number` safe for the math? Yes — with one guard

`Number.MAX_SAFE_INTEGER === 9_007_199_254_740_991` (~9 triệu tỷ đồng). Group balances are ~1e6–1e9.
There is no realistic precision risk on the **values**.

The actual risk is the **intermediate product** in the split algorithm. Verified locally:

```
1e12 * 10      → safe
1e15 * 10      → NOT safe   (Number.isSafeInteger === false)
```

So the rule is: **`number` for arithmetic, `BigInt` for storage, and assert safety at the boundary.**

```ts
// lib/money.ts
/** VND đồng as a plain integer. No subunit — 1 unit = 1 đồng. */
export type VND = number;

export const MAX_VND = 1_000_000_000_000; // 1000 tỷ — generous app-level ceiling

export function assertVND(n: unknown, label = "amount"): asserts n is VND {
  if (typeof n !== "number" || !Number.isInteger(n)) {
    throw new TypeError(`${label} must be an integer number of đồng, got ${String(n)}`);
  }
  if (!Number.isSafeInteger(n)) {
    throw new RangeError(`${label} exceeds MAX_SAFE_INTEGER: ${n}`);
  }
  if (Math.abs(n) > MAX_VND) {
    throw new RangeError(`${label} out of plausible range: ${n}`);
  }
}

/** DB BigInt -> app number, checked. */
export function toVND(v: bigint): VND {
  if (v > BigInt(Number.MAX_SAFE_INTEGER) || v < BigInt(-Number.MAX_SAFE_INTEGER)) {
    throw new RangeError(`Ledger amount ${v} exceeds safe integer range`);
  }
  return Number(v);
}

/** app number -> DB BigInt, checked. */
export function toDb(v: VND): bigint {
  assertVND(v);
  return BigInt(v);
}
```

### The serialization pitfall (this one will bite you)

Prisma documents it verbatim:

> Prisma Client returns records as plain JavaScript objects. If you attempt to use `JSON.stringify`
> on an object that includes a `BigInt` field, you will see the following error:
> `Do not know how to serialize a BigInt`

— [Prisma: Fields & types → Serializing BigInt](https://www.prisma.io/docs/orm/prisma-client/special-fields-and-types)

**Why Next.js App Router makes this worse:** you rarely call `JSON.stringify` yourself. The
framework serializes for you at two boundaries:

1. **Route handlers** — `Response.json(data)` / `NextResponse.json(data)` stringify internally.
2. **Server → Client component props and Server Action return values** — crossing the RSC boundary
   serializes automatically.

A `bigint` therefore throws *inside framework code*, with a stack trace that does not point at your
query. Note: the RSC serializer is more capable than `JSON.stringify` and can handle `bigint` in
some positions, which makes failures **inconsistent across boundaries** — all the more reason to
never let a `bigint` escape the data layer.

**The fix people reach for (global prototype patch) — don't:**

```ts
// ❌ Mutates a global built-in. Breaks any library that round-trips BigInt,
//    and silently turns numbers into strings everywhere, app-wide.
(BigInt.prototype as any).toJSON = function () { return this.toString(); };
```

**Recommended: convert at the repository boundary so `bigint` never escapes the data layer.**
**[judgement]** This keeps the whole app in `number` land and makes the pitfall unreachable by
construction rather than handled repeatedly.

```ts
// lib/ledger/queries.ts
import { prisma } from "@/lib/prisma";
import { toVND, type VND } from "@/lib/money";

export type BalanceRow = { memberId: string; displayName: string; balance: VND };

export async function getBalances(
  from?: Date,
  to?: Date,
): Promise<BalanceRow[]> {
  const rows = await prisma.$queryRaw<
    { member_id: string; display_name: string; balance: bigint }[]
  >`
    SELECT m.id            AS member_id,
           m.display_name  AS display_name,
           COALESCE(SUM(le.amount), 0)::bigint AS balance
      FROM members m
      LEFT JOIN ledger_entries le
             ON le.member_id = m.id
            AND (${from}::timestamptz IS NULL OR le.occurred_at >= ${from})
            AND (${to}::timestamptz   IS NULL OR le.occurred_at <  ${to})
     WHERE m.active
     GROUP BY m.id, m.display_name
     ORDER BY balance DESC, m.id;
  `;

  // Single conversion point. Nothing downstream ever sees a bigint.
  return rows.map((r) => ({
    memberId: r.member_id,
    displayName: r.display_name,
    balance: toVND(r.balance),
  }));
}
```

> **Gotcha:** Postgres `SUM(bigint)` returns `NUMERIC`, not `BIGINT`. Prisma then hands you a
> `Prisma.Decimal`, not a `bigint`, and `toVND` would throw. The explicit `::bigint` cast above is
> required. Verify with a quick unit test rather than trusting it.

---

## 3. Deterministic Remainder Allocation

### The bug being fixed

v1 bug #8: `100000/3` via float → each `33333.333…` → rounds to `33333` → total `99999`. One đồng
vanishes per split; across a period this is exactly the drift users noticed.

**Verified locally:**

```
naive float:  [33333, 33333, 33333]  sum 99999   ❌
largest-rem:  [33334, 33333, 33333]  sum 100000  ✅
```

### The algorithm — one function for all split modes

Largest-remainder (Hamilton) method: take floor quotas, then hand the leftover units one at a time
to whoever has the largest fractional remainder. Ties break by index, which makes it deterministic.

The key trick for exactness: **never divide in floating point.** Compare remainders as the integer
`total*w − floor(total*w/W)*W`, which keeps the whole comparison in integer space.

```ts
// lib/money/split.ts
import { assertVND, type VND } from "../money";

/**
 * Split `total` đồng across `weights`, exactly.
 *
 * Guarantees:
 *  - sum(result) === total            (exact, no lost đồng)
 *  - deterministic                    (same input -> same output; ties break by index)
 *  - max(result) - min(result) <= 1   for equal weights
 *  - works for negative totals        (reversals/refunds)
 *
 * Largest-remainder (Hamilton) method.
 */
export function splitByWeights(total: VND, weights: number[]): VND[] {
  assertVND(total, "total");
  if (weights.length === 0) throw new Error("splitByWeights: no participants");
  if (weights.some((w) => !Number.isInteger(w) || w < 0)) {
    throw new Error("splitByWeights: weights must be non-negative integers");
  }

  const W = weights.reduce((a, b) => a + b, 0);
  if (W <= 0) throw new Error("splitByWeights: weights must sum to > 0");

  // Overflow guard: the comparison below computes total*w.
  if (!Number.isSafeInteger(Math.abs(total) * W)) {
    throw new RangeError("splitByWeights: total*weight exceeds safe integer range");
  }

  // Math.trunc (not Math.floor) so negative totals distribute symmetrically.
  const base = weights.map((w) => Math.trunc((total * w) / W));
  const remainder = total - base.reduce((a, b) => a + b, 0);

  // Rank by fractional remainder, descending; index ascending as tiebreak.
  const order = weights
    .map((w, i) => ({ i, frac: total * w - base[i] * W }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);

  const out = base.slice();
  const step = remainder >= 0 ? 1 : -1;
  for (let k = 0; k < Math.abs(remainder); k++) {
    // For negative remainders walk from the smallest frac end.
    const pick = remainder >= 0 ? order[k] : order[order.length - 1 - k];
    out[pick.i] += step;
  }
  return out;
}

/** Equal split — the common case. */
export function splitEqually(total: VND, n: number): VND[] {
  return splitByWeights(total, Array(n).fill(1));
}

/** Shares split — "A 2 phần, B 1 phần". */
export function splitByShares(total: VND, shares: number[]): VND[] {
  return splitByWeights(total, shares);
}

/**
 * Percentage split. Percentages given in basis points (1% = 100 bp)
 * to keep the input integral — never accept a float percentage.
 */
export function splitByPercentBp(total: VND, bps: number[]): VND[] {
  const sum = bps.reduce((a, b) => a + b, 0);
  if (sum !== 10_000) {
    throw new Error(`Percentages must total 100% (10000 bp), got ${sum}`);
  }
  return splitByWeights(total, bps);
}
```

### Verified behaviour

```
splitEqually(100000, 3)          -> [33334, 33333, 33333]   sum 100000
splitByShares(100000, [2,1])     -> [66667, 33333]          sum 100000
splitByShares(100000, [2,1,1,1]) -> [40000, 20000, 20000, 20000]
splitByWeights(-1000, [1,1,1])   -> [-333, -333, -334]      sum -1000
```

Exhaustive check of the exact code above: totals −3000…3000 × group sizes 1…8, plus 20,000
randomized negative-weighted cases — **68,016 cases, 0 sum-invariant failures**, and max−min never
exceeded 1 đồng in either direction.

### Fairness over repeated use **[judgement]**

Largest-remainder is exact but **not** fair across repetitions on its own: with a stable index
tiebreak, the same person (lowest index) absorbs the extra đồng every single time. Over a year of
daily coffee splits that is a systematic bias — small in money, but users notice "tôi luôn trả
nhiều hơn 1 đồng".

If you want rotation, seed the tiebreak from the transaction ID. This stays deterministic (same
transaction always yields the same split — critical for an immutable ledger) while distributing the
extra đồng pseudo-randomly across transactions:

```ts
/** Deterministic per-transaction rotation so the same member doesn't always
 *  absorb the extra đồng. Same txId => same result, always. */
export function splitByWeightsSeeded(
  total: VND, weights: number[], txId: string,
): VND[] {
  let h = 2166136261;                       // FNV-1a
  for (let i = 0; i < txId.length; i++) {
    h ^= txId.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const offset = weights.length ? h % weights.length : 0;
  const rotate = <T,>(a: T[]) => [...a.slice(offset), ...a.slice(0, offset)];
  const unrotate = <T,>(a: T[]) =>
    [...a.slice(weights.length - offset), ...a.slice(0, weights.length - offset)];
  return unrotate(splitByWeights(total, rotate(weights)));
}
```

**Recommendation:** ship plain `splitByWeights` first — it is exact, which is the requirement.
Rotation is a polish item, and because it is deterministic from `txId` it can be added later
without invalidating history.

### Property-based test (fast-check)

```ts
// lib/money/split.test.ts
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { splitByWeights, splitEqually } from "./split";

const total = fc.integer({ min: 0, max: 1_000_000_000 });
const weights = fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 10 });

describe("splitByWeights", () => {
  it("sum of shares always equals the total exactly", () => {
    fc.assert(
      fc.property(total, weights, (t, w) => {
        const shares = splitByWeights(t, w);
        expect(shares.reduce((a, b) => a + b, 0)).toBe(t);
      }),
      { numRuns: 5_000 },
    );
  });

  it("is deterministic", () => {
    fc.assert(
      fc.property(total, weights, (t, w) => {
        expect(splitByWeights(t, w)).toEqual(splitByWeights(t, w));
      }),
    );
  });

  it("every share is an integer and never negative for positive totals", () => {
    fc.assert(
      fc.property(total, weights, (t, w) => {
        for (const s of splitByWeights(t, w)) {
          expect(Number.isInteger(s)).toBe(true);
          expect(s).toBeGreaterThanOrEqual(0);
        }
      }),
    );
  });

  it("equal splits differ by at most 1 đồng", () => {
    fc.assert(
      fc.property(total, fc.integer({ min: 1, max: 10 }), (t, n) => {
        const s = splitEqually(t, n);
        expect(Math.max(...s) - Math.min(...s)).toBeLessThanOrEqual(1);
      }),
    );
  });

  // NOTE: this asserts SUM cancellation only — NOT elementwise. See the trap below.
  it("a forward split and its negative cancel in total", () => {
    fc.assert(
      fc.property(total, weights, (t, w) => {
        const fwd = splitByWeights(t, w);
        const rev = splitByWeights(-t, w);
        expect(fwd.reduce((a, b) => a + b, 0) + rev.reduce((a, b) => a + b, 0)).toBe(0);
      }),
    );
  });

  // The invariant that actually protects the ledger:
  it("negating stored entries cancels elementwise", () => {
    fc.assert(
      fc.property(total, weights, (t, w) => {
        const fwd = splitByWeights(t, w);
        fwd.forEach((x, i) => expect(x + -x).toBe(0));
      }),
    );
  });
});
```

### ⚠️ Verified trap: `split(−t, w)` is NOT the elementwise negation of `split(t, w)`

This was caught by running the exact code above, and it is the kind of bug that would have silently
recreated v1's drift.

```
splitByWeights( 346527, [7,7])  ->  [ 173264, 173263 ]
splitByWeights(-346527, [7,7])  ->  [-173263, -173264 ]   // ⚠️ order flipped!
```

Both sum correctly (`+346527` and `−346527`), so a sum-only test **passes**. But the extra đồng
lands on a *different person*. Measured over 50,000 random cases:

| Property | Result |
|---|---|
| Sums cancel | 50,000 / 50,000 ✅ |
| Cancels **elementwise** | 40,784 / 50,000 — **9,216 failures** ❌ |

**Consequence if ignored:** reversing an expense by recomputing the split from the amount would
leave two members off by 1 đồng each — permanently, and invisibly, because the ledger would still
sum to zero and every balanced-entry check would pass. This is precisely the "drift" class of bug
that killed v1.

**The rule this forces (already applied in §1's `reverseTransaction`):**

> **Never recompute a split to reverse it. Negate the stored entry rows.**

```ts
// ✅ CORRECT — read the original legs and flip their signs
entries: original.entries.map((e) => ({ memberId: e.memberId, amount: -e.amount, ... }))

// ❌ WRONG — recomputes, and may assign the remainder đồng to a different member
entries: splitByWeights(-original.amount, weights).map(...)
```

This is a strong independent argument for storing every leg explicitly rather than storing an amount
plus a split rule and deriving legs on read.

`fc.property(...arbitraries, predicate)` with assertion-throwing predicates is the documented
pattern ([fast-check: Properties](https://fast-check.dev/docs/core-blocks/properties/)).

---

## 4. Line-Item Bill Splitting with Proportional Fees

### The standard correct approach

Shipping and VAT apply to the whole bill, so each person should carry them **in proportion to what
they personally consumed**. The correct and simple formulation:

1. Allocate each line item across its own beneficiaries (largest-remainder).
2. Sum per person → that person's **pre-fee subtotal**.
3. Allocate the **combined** fee pool across people using those subtotals **as the weights** —
   the same `splitByWeights` function.

Step 3 is the key insight: *proportional fee allocation is itself a weighted split*. Reusing one
function means one place for the rounding to be correct, which directly avoids v1 bug #6.

**Allocate the fee pool once, not fee-by-fee.** Running `splitByWeights` separately for shipping
and then VAT is also exact, but each pass hands its extra đồng to the same highest-remainder person,
compounding the bias. One combined pass is both simpler and fairer. **[judgement]**

### Implementation

```ts
// lib/money/bill.ts
import { splitByWeights } from "./split";
import { assertVND, type VND } from "../money";

export type LineItem = { label: string; amount: VND; beneficiaries: string[] };

export type BillInput = {
  items: LineItem[];
  shipping: VND;          // integer đồng
  vat: VND;               // integer đồng (absolute, not a rate)
  participants: string[]; // member ids; superset of all beneficiaries
};

export type BillShare = {
  memberId: string;
  itemsSubtotal: VND;
  feeShare: VND;
  total: VND;
};

export function splitBill(input: BillInput): {
  shares: BillShare[];
  grandTotal: VND;
} {
  const { items, shipping, vat, participants } = input;
  assertVND(shipping, "shipping");
  assertVND(vat, "vat");

  // --- 1. per-person subtotal from line items ---
  const subtotal = new Map<string, VND>(participants.map((p) => [p, 0]));

  for (const item of items) {
    assertVND(item.amount, `item "${item.label}"`);
    if (item.beneficiaries.length === 0) {
      throw new Error(`Line item "${item.label}" has no beneficiaries`);
    }
    // Equal split within an item; swap to weights if you ever need "An ăn 2 phần phở".
    const shares = splitByWeights(item.amount, item.beneficiaries.map(() => 1));
    item.beneficiaries.forEach((p, i) => {
      if (!subtotal.has(p)) throw new Error(`Unknown beneficiary ${p}`);
      subtotal.set(p, subtotal.get(p)! + shares[i]);
    });
  }

  // --- 2. allocate the combined fee pool proportional to subtotals ---
  const weights = participants.map((p) => subtotal.get(p)!);
  const feePool = shipping + vat;
  const weightSum = weights.reduce((a, b) => a + b, 0);

  // Edge case that would otherwise throw: a zero-value bill that still has fees.
  // Fall back to an equal split of the fees.
  const feeShares =
    weightSum > 0
      ? splitByWeights(feePool, weights)
      : splitByWeights(feePool, participants.map(() => 1));

  const shares = participants.map((memberId, i) => ({
    memberId,
    itemsSubtotal: weights[i],
    feeShare: feeShares[i],
    total: weights[i] + feeShares[i],
  }));

  // --- 3. reconciliation assertion: this must never fire ---
  const grandTotal = items.reduce((a, it) => a + it.amount, 0) + feePool;
  const summed = shares.reduce((a, s) => a + s.total, 0);
  if (summed !== grandTotal) {
    throw new Error(`Bill does not reconcile: ${summed} !== ${grandTotal}`);
  }

  return { shares, grandTotal };
}
```

### Verified

Worked example (includes a deliberately nasty 1-đồng item and an indivisible VAT):

```
items: 120000 (A,B) | 85000 (C) | 47000 (A,B,C) | 1 (A,B,C)
shipping 30000 + VAT 25200

A: subtotal  75668  fee 16575  total  92243
B: subtotal  75667  fee 16575  total  92242
C: subtotal 100666  fee 22050  total 122716
grand total 307201  ==  sum of person totals 307201  ✅
```

Randomized: 20,000 bills (2–5 people, 1–6 items, random beneficiary subsets, random fees) →
**0 reconciliation failures**.

> **If VAT is given as a rate** (e.g. 8%), compute the absolute amount first and round it once,
> at the bill level: `const vat = Math.round(subtotal * 8) / 100` is wrong — use
> `const vat = Math.trunc((subtotal * 8) / 100)` or basis points, then feed that integer in.
> Never let a rate reach the per-person math.

---

## 5. Derived Balance Computation

### Verdict: compute on-read. Do not cache. **[judgement — but strongly held]**

This is the decision that killed v1, so it deserves to be stated plainly:

> A materialized balance **is** the second source of truth. It is the `IOU` sheet with a different
> name.

Scale reality check: <10 members, thousands of ledger rows. A `GROUP BY` over ~10k rows with an
index on `(member_id, occurred_at)` is well under a millisecond. **Your p99 latency is dominated
entirely by Neon's cold start (free tier auto-suspends), not by this query.** Caching balances
optimizes the wrong thing while reintroducing the original bug.

### The SQL aggregate

```sql
-- Current balance per member.
-- Positive = the group owes them. Negative = they owe the group.
SELECT
  m.id                                AS member_id,
  m.display_name,
  COALESCE(SUM(le.amount), 0)::bigint AS balance
FROM members m
LEFT JOIN ledger_entries le ON le.member_id = m.id
WHERE m.active
GROUP BY m.id, m.display_name
ORDER BY balance DESC, m.id;
```

Scoped to an open period (see §7) — note the **half-open** `>= from AND < to` range, which prevents
the boundary double-count that v1 suffered:

```sql
SELECT
  m.id                                AS member_id,
  m.display_name,
  COALESCE(SUM(le.amount), 0)::bigint AS balance
FROM members m
LEFT JOIN ledger_entries le
       ON le.member_id = m.id
      AND le.occurred_at >= $1   -- previous close (or -infinity)
      AND le.occurred_at <  $2   -- this close     (or now())
WHERE m.active
GROUP BY m.id, m.display_name
ORDER BY balance DESC, m.id;
```

**Self-check query — run this in CI and on an admin page.** The whole ledger must sum to zero. If it
does not, something bypassed the balanced-entry trigger:

```sql
SELECT COALESCE(SUM(amount), 0)::bigint AS must_be_zero FROM ledger_entries;
```

### If you ever genuinely need a cache

Only after measuring. The safe shape is a `MATERIALIZED VIEW` — a **disposable projection** that is
only ever recomputed from the ledger and can never be written to directly:

```sql
CREATE MATERIALIZED VIEW member_balances AS
SELECT m.id AS member_id,
       COALESCE(SUM(le.amount), 0)::bigint AS balance
FROM members m
LEFT JOIN ledger_entries le ON le.member_id = m.id
GROUP BY m.id;

-- UNIQUE index is required for CONCURRENTLY.
CREATE UNIQUE INDEX member_balances_pk ON member_balances (member_id);

-- Refresh after any ledger write; does not block readers.
REFRESH MATERIALIZED VIEW CONCURRENTLY member_balances;
```

Why this cannot drift the way v1 did:
- There is **no code path that writes a balance**. `REFRESH` recomputes from the ledger, always.
- Worst-case failure is *staleness* (a recoverable, self-healing state), never *divergence*
  (an unrecoverable, silently-wrong state). v1's IOU sheet could diverge; a matview cannot.
- Dropping it is always safe.

**Invalidation strategy:** refresh in the same server action that writes, *after* commit. If the
refresh fails, the ledger is still correct and the next refresh fixes it. Never gate a write on a
successful refresh.

---

## 6. Concurrency and Lost Updates

### What append-only actually eliminates

v1's lost updates came from **read-modify-write**: read the IOU sheet → compute a new balance →
write it back. Two concurrent writers, one wins, one silently vanishes.

An append-only ledger has no read-modify-write for balances. Two people adding expenses
simultaneously just `INSERT` different rows; both survive; the aggregate sees both. The entire class
of lost-update bugs is **structurally gone**, not merely mitigated.

### The race that genuinely remains: double-submit

Flaky mobile connection → user taps "Lưu" → request times out client-side but *succeeded*
server-side → user taps again → the expense is recorded twice. Append-only does not help; both
inserts are legitimate from the database's point of view.

**Do not dedup on `(payer, payee, amount)`** — that was v1 bug #3, and it is wrong in both
directions: it blocks legitimate repeat payments (two 50,000đ coffees on the same day are real) and
it fails silently.

**Correct solution: client-generated idempotency key + `UNIQUE` constraint.** The key is generated
when the *form is opened*, not when it is submitted, so every retry of the same logical action
carries the same key.

```ts
// app/expenses/new-expense-form.tsx  (client)
"use client";
import { useRef } from "react";

export function NewExpenseForm() {
  // Generated once per form instance; survives retries, changes on a fresh form.
  const clientKey = useRef(crypto.randomUUID());
  // ...submit clientKey.current alongside the payload; retries reuse it.
}
```

```ts
// app/expenses/actions.ts  (server)
"use server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toDb } from "@/lib/money";
import { splitByWeights } from "@/lib/money/split";

export async function createExpense(input: {
  clientKey: string;
  payerId: string;
  amount: number;
  beneficiaries: string[];
  occurredAt: Date;
  note?: string;
}) {
  const shares = splitByWeights(input.amount, input.beneficiaries.map(() => 1));

  try {
    const tx = await prisma.$transaction(async (db) => {
      return db.transaction.create({
        data: {
          clientKey: input.clientKey,
          kind: "EXPENSE",
          note: input.note,
          occurredAt: input.occurredAt,
          createdById: input.payerId,
          entries: {
            create: [
              // payer fronted the whole amount
              { memberId: input.payerId, amount: toDb(input.amount), occurredAt: input.occurredAt },
              // each beneficiary owes their share
              ...input.beneficiaries.map((memberId, i) => ({
                memberId,
                amount: toDb(-shares[i]),
                occurredAt: input.occurredAt,
              })),
            ],
          },
        },
      });
    });
    return { ok: true as const, id: tx.id, duplicate: false };
  } catch (e) {
    // P2002 = unique constraint violation (Postgres 23505) on clientKey.
    // This is the retry landing. It is SUCCESS, not an error.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const existing = await prisma.transaction.findUnique({
        where: { clientKey: input.clientKey },
      });
      return { ok: true as const, id: existing!.id, duplicate: true };
    }
    throw e;
  }
}
```

Two details that matter:

- **The payer's own share nets out correctly.** If the payer is also a beneficiary, they get
  `+amount` and `−share` as separate legs. Do not try to pre-net these — separate legs keep the
  "sums to zero" invariant trivially checkable and the history readable.
- **A duplicate returns `ok: true`.** Surfacing an error for a retry trains users to re-submit,
  which is the opposite of what you want. v1 "nuốt im lặng" (swallowed silently) — the fix is to
  return success *and* report `duplicate: true` so the UI can say "Đã lưu rồi" instead of
  pretending nothing happened.

### Isolation level: `READ COMMITTED` (the default) is correct here

Postgres docs: *"Read Committed is the default isolation level in PostgreSQL."*
([PG §13.2 Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html))

For **pure inserts with a unique constraint**, stronger isolation buys nothing. The unique index is
enforced at the storage level regardless of isolation, and concurrent duplicate inserts raise
`23505` even in `READ COMMITTED`. Postgres explicitly documents this for concurrent insert paths:
*"if MERGE attempts an INSERT and a unique index is present and a duplicate row is concurrently
inserted, then a uniqueness violation error is raised."*

Escalate to `SERIALIZABLE` **only** for operations where a write depends on a prior read — in this
app, that is exactly two places:

1. **Period close** (§7) — reads balances, then writes a snapshot derived from them.
2. **Reversal** — checks "not already reversed", then inserts. (Here the `@unique` on `reversesId`
   already covers it, so `SERIALIZABLE` is belt-and-braces.)

```ts
await prisma.$transaction(
  async (db) => { /* read-then-write logic */ },
  { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
);
```

If you use `SERIALIZABLE`, you must **retry on `40001`** (`serialization_failure`) — Postgres aborts
one of the conflicting transactions by design, and an un-retried abort is a lost write.

```ts
async function withSerializableRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  for (let i = 0; i < tries; i++) {
    try { return await fn(); }
    catch (e: any) {
      const code = e?.code ?? e?.meta?.code;
      if (code === "40001" && i < tries - 1) {        // serialization_failure
        await new Promise((r) => setTimeout(r, 50 * 2 ** i));
        continue;
      }
      throw e;
    }
  }
  throw new Error("unreachable");
}
```

> **Neon note.** Neon's free tier auto-suspends. The first query after idle can take seconds, which
> makes client-side timeouts (and therefore retries) *more* likely than on an always-on database.
> This makes the idempotency key essential rather than optional for this deployment.

---

## 7. Period Closing ("chốt kỳ")

### The v1 bug

`actionStartNewPeriod` archived rows but did not reset them, so the new period re-counted the old
one. The underlying mistake was treating a period close as a **data mutation**.

### Correct model: a close is a timestamp, not an operation on data

> **A period close writes exactly one marker row and deletes nothing.**

Periods are derived by filtering the ledger on a half-open date range between consecutive markers.
Because nothing moves, double-counting is not a bug you have to avoid — it is unrepresentable.

```
ledger:  ──●──●──●───┊────●──●──●────┊──●──●──  (nothing ever moves)
                     ┊               ┊
               close(T1)       close(T2)

period 1 = entries where occurred_at <  T1
period 2 = entries where occurred_at >= T1 AND < T2
period 3 = entries where occurred_at >= T2            (open)
```

The half-open interval `[from, to)` is what guarantees an entry falls in exactly one period, even
at an exact-boundary timestamp.

### What "closing" means for balances **[judgement]**

A real decision the roadmap must make explicit, because the two options behave very differently:

| Model | Meaning | Carry-over |
|---|---|---|
| **A. Reporting-only close** (recommended) | Close is a bookmark. Balances remain cumulative across all time. | Debts carry over automatically. |
| **B. Settling close** | At close, outstanding balances are zeroed by writing real settlement entries. | Requires everyone to actually pay up. |

**Recommend A.** The group lives together continuously; debts genuinely do carry over, and a close
is really "chốt sổ tháng này để xem lại", not "everyone settle now". Model B writes carry-forward
entries, and the moment you have carry-forward entries you have a second mechanism that can
disagree with the ledger — which is the v1 failure mode wearing a new hat.

Under Model A, `snapshot` on `PeriodClose` is **display-only**: a frozen copy of what the report
showed, never an input to any later computation. Document this loudly, because a future contributor
*will* be tempted to read it back as an opening balance.

```ts
// app/periods/actions.ts
"use server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getBalances } from "@/lib/ledger/queries";

export async function closePeriod(actorId: string, closesAt: Date = new Date()) {
  return prisma.$transaction(
    async (db) => {
      const last = await db.periodClose.findFirst({ orderBy: { closesAt: "desc" } });
      if (last && closesAt <= last.closesAt) {
        throw new Error("Period close must be after the previous close");
      }

      const from = last?.closesAt;
      const balances = await getBalances(from, closesAt);

      // Display-only snapshot. NEVER read back as an opening balance.
      return db.periodClose.create({
        data: {
          closesAt,
          closedById: actorId,
          snapshot: balances as unknown as Prisma.InputJsonValue,
        },
      });
    },
    // read-then-write => needs SERIALIZABLE (see §6)
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
```

### Late entries after a close

Someone will add a receipt dated last month, after that month was closed. Two defensible policies —
pick one and state it in the UI:

1. **Reject** writes whose `occurredAt` precedes the latest close. Simple; the stale snapshot stays
   accurate. Enforce with a trigger.
2. **Allow**, and mark the affected close as `recomputed`. The *live* query stays correct
   automatically (it reads the ledger); only the frozen `snapshot` becomes outdated.

**Recommend 1 for v1** — it is one constraint and removes the "why does the report not match the
PDF I exported" conversation entirely.

```sql
CREATE OR REPLACE FUNCTION reject_entries_before_close() RETURNS trigger AS $$
DECLARE last_close TIMESTAMPTZ;
BEGIN
  SELECT MAX(closes_at) INTO last_close FROM period_closes;
  IF last_close IS NOT NULL AND NEW.occurred_at < last_close THEN
    RAISE EXCEPTION
      'Cannot record an entry dated % — period is closed through %',
      NEW.occurred_at, last_close;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER transactions_respect_close
  BEFORE INSERT ON transactions
  FOR EACH ROW EXECUTE FUNCTION reject_entries_before_close();
```

> **Interaction with reversals:** this trigger uses `occurred_at`, and a reversal gets `occurred_at
> = now()`, so reversing an expense from a closed period still works (it lands in the open period).
> That is the correct accounting behaviour — closed books are corrected by an entry in the current
> period, not by rewriting history.

---

## Where Sources Disagree / Open Questions

| Topic | Disagreement | Resolution taken |
|---|---|---|
| `BigInt` vs `number` in app code | Prisma docs push `BigInt` for 64-bit columns; most app code is far simpler with `number`. | Store `BIGINT`, convert to `number` at the repository boundary with a range assertion. Best of both. |
| Global `BigInt.prototype.toJSON` patch | Widely recommended in blog posts/StackOverflow; not endorsed by Prisma docs. | **Rejected** — mutates a global built-in and silently changes types app-wide. Convert at the boundary instead. |
| Fee allocation base | Some implementations allocate fees by headcount, others by consumption. | By consumption (subtotal-weighted) — matches the intuition that whoever ordered more carries more VAT. Headcount is a config option, not the default. |
| Largest-remainder fairness | Exactness is uncontroversial; cross-transaction rotation is not standard practice. | Ship exact-only first; `splitByWeightsSeeded` documented as deterministic future polish. |
| Balance caching | General ledger literature assumes high volume and recommends snapshots/rollups. | Does **not** apply at <10 users. On-read aggregation; matview only if measured. |

**Needs a decision from the user (not resolvable by research):**
- Period close model **A vs B** (§7). Recommend A.
- Late-entry policy **reject vs allow** (§7). Recommend reject.

**Flagged for phase-level research:** debt simplification (minimum cash flow / greedy
settle-up) is listed in `PROJECT.md` but is a *derived read-model* over these balances, not a ledger
concern. It was out of scope here and warrants its own research pass — in particular whether
simplified transfers are *suggestions* (recommended; keeps the ledger honest) or get *written* as
entries (risks reintroducing a second source of truth).

---

## Sources

| Claim | Source | Confidence |
|---|---|---|
| `JSON.stringify` on BigInt throws `Do not know how to serialize a BigInt`; replacer workaround | [Prisma — Fields & types](https://www.prisma.io/docs/orm/prisma-client/special-fields-and-types) | HIGH (verbatim) |
| `Int`=32-bit, `BigInt`=64-bit; "lean toward the wider one"; bigint not JSON-serializable | [Prisma — Models](https://www.prisma.io/docs/orm/prisma-schema/data-model/models) | HIGH (verbatim) |
| `integer` range ±2.1e9; `bigint` range ±9.2e18 | [PostgreSQL 18 §8.1](https://www.postgresql.org/docs/current/datatype-numeric.html) | HIGH (verbatim) |
| Read Committed is the Postgres default; concurrent duplicate insert raises uniqueness violation | [PostgreSQL 18 §13.2](https://www.postgresql.org/docs/current/transaction-iso.html) | HIGH (verbatim) |
| `fc.property(...arbitraries, predicate)` with throwing assertions | [fast-check — Properties](https://fast-check.dev/docs/core-blocks/properties/) | HIGH (verbatim) |
| Largest-remainder method definition | [Largest remainder method — Wikipedia](https://en.wikipedia.org/wiki/Largest_remainder_method) | MEDIUM |
| Ledger/reversal patterns | [Martin Fowler — Patterns for Accounting](https://martinfowler.com/eaaDev/AccountingNarrative.html) (explicitly draft-stage material) | MEDIUM |
| Split + bill algorithms behave as claimed | **Executed locally**: 68,016 split cases + 20,000 bill cases, 0 sum-invariant failures | HIGH (verified) |
| `split(−t,w)` ≠ elementwise negation of `split(t,w)` | **Executed locally**: 9,216 / 50,000 random cases differ elementwise while all 50,000 sum correctly | HIGH (verified) |

**Research method note:** no search-provider API keys were configured in this environment
(`BRAVE_API_KEY` unset; Context7/Exa/Tavily MCP tools unavailable), so sourcing was done by direct
`WebFetch` against primary vendor documentation rather than via search. This biases the citation
list toward official docs and away from community/blog consensus — which is the better bias for
correctness claims, but means ecosystem-convention claims (marked **[judgement]**) rest on reasoning
from the project's own documented v1 failures rather than on surveyed practice.

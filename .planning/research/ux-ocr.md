# UX Patterns & Receipt OCR — Upper-I

**Domain:** Mobile group-expense splitter, fixed group <10, Vietnam, VND
**Researched:** 2026-10-06
**Overall confidence:** HIGH on input mechanics + OCR free tiers, MEDIUM on competitor tap-counts (verified flows from vendor KB; exact screen counts inferred from documented steps)

---

## Key Findings (decision-ready)

- **Splitwise's speed trick is the sentence-shaped control**, not a form: `Paid by [you] and split [equally]` where each bracket is a tap target. Default is **equal split among everyone**, and you remove people by tapping their name — the remainder auto-redistributes. Borrow this verbatim. ([Splitwise KB](https://kb.splitwise.com/balances-and-expenses/what-are-different-ways-i-can-split-an-expense))
- **Your group is fixed and known — that is the unfair advantage the big apps don't have.** They must handle arbitrary groups, so they make you pick people. You can default payer = logged-in user and beneficiaries = everyone, which collapses the flow to **amount → save = 4 taps, ~8 seconds**. The 15s target is comfortably beatable.
- **Use `type="text"` + `inputMode="numeric"`, never `type="number"`.** GOV.UK dropped `type="number"` because of accidental scroll-increment, no feedback on bad input, and spinner UI. ([GOV.UK](https://technology.blog.gov.uk/2020/02/24/why-the-gov-uk-design-system-team-changed-the-input-type-for-numbers/), [Design System](https://design-system.service.gov.uk/components/text-input/)) VND has no decimals, so `numeric` (not `decimal`) is correct — no separator key needed.
- **Font-size on the amount input must be ≥16px or iOS Safari zooms on focus** and your layout jumps mid-entry. Hard rule, no exceptions. ([CSS-Tricks](https://css-tricks.com/16px-or-larger-text-prevents-ios-form-zoom/))
- **Skip the IndexedDB offline queue.** For <10 users the entire double-submit problem is solved by a client-generated UUID idempotency key + disabled button + `useOptimistic`. The queue is weeks of work and a second source of truth — exactly the bug class that killed the Sheets version.
- **The idempotency key must be generated when the form opens, not on submit.** Generate-on-submit produces a new key per tap and defeats the whole mechanism. This is the single highest-value line of code in the app.
- **OCR: use Gemini Flash free tier.** Multimodal LLM reads Vietnamese diacritics + understands receipt *structure* in one call; Tesseract.js is genuinely bad at stacked Vietnamese tone marks on thermal print; Cloud Vision gives you text but no line-item structure (and only 1,000 free units/month). ([Vision pricing](https://cloud.google.com/vision/pricing), [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing))
- **Free-tier Gemini input is used to train Google's models** — a real consideration for receipt photos. Disclose it, or treat it as acceptable for this group. ([Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing))
- **Design OCR for correction, not accuracy.** Every line item lands in an editable row, pre-focused on the first low-confidence field. Assume ~70-85% field accuracy and make fixing it a 2-tap operation.
- **Balance wording: avoid net-balance jargon.** Users confuse "balance" with "what I pay now". Lead with one imperative sentence in Vietnamese — `Bạn nợ 150.000 ₫` / `Bạn được nhận 80.000 ₫` — and keep red = you owe, green = you are owed, consistently.
- **Navigation: 3 tabs + a persistent FAB.** `Số dư` / `Lịch sử` / `Nhóm`, with Add Expense as a floating button present on every tab. Adding an expense must never cost a tab switch.
- **Settle Up proves "works offline" is a headline feature** for this category, and its reviews show users reach for *reversing entries* ("Debt Settled") rather than edits — validating the append-only ledger decision already in PROJECT.md. ([Play Store](https://play.google.com/store/apps/details?id=cz.destil.settleup))

---

## 1. Competitive Teardown

### Splitwise

**Documented flow** (from the vendor's own KB, [source](https://kb.splitwise.com/balances-and-expenses/what-are-different-ways-i-can-split-an-expense)):

1. Tap **Add expense**
2. Enter **description** and **amount**
3. The split control reads as a sentence: `Paid by [you] and split [equally]`
4. Tap `equally` → split options; or **More options** for unequal splits
5. Save

Screen-by-screen for a simple equal split:

| Step | Screen | Taps |
|---|---|---|
| Open add-expense | Group detail → FAB | 1 |
| Description | text field + keyboard | 1 + typing |
| Amount | numeric field | 1 + typing |
| Split | *untouched — already equal* | 0 |
| Save | top-right Save | 1 |

**~4 taps + two typing bursts.** The description field is the slow part — it's free-text and it's first.

**Defaults:** payer = you; split = **equally among everyone on the expense**. Deselect by tapping a name; the remainder redistributes automatically among the rest.

**What makes it fast:**
- The split control is a **sentence, not a form**. Nothing to configure unless you want something unusual.
- **Zero-config happy path** — the default is correct for the overwhelming majority of expenses, so steps 3–4 cost nothing.
- Split complexity is **progressively disclosed** behind "More options" (exact amounts, %, shares, adjustment, itemized).

**What they deliberately leave out of screen one:** category, date (defaults to today), notes, currency, receipt image, itemization. All reachable, none blocking.

**Where users complain:** the 2023 free-tier changes drew heavy criticism — a cap of ~3 transactions/day and a **10-second video ad before entering a transaction**. For an app whose value is fast entry, a 10s pre-roll is fatal. ([r/personalfinance "The downfall of Splitwise"](https://www.reddit.com/r/personalfinance/comments/186v5wj/the_downfall_of_splitwise/)) Receipt scanning / itemize-by-scan is **Pro-only**. Takeaway: *nothing may sit between the user's intent and the amount field.*

### Tricount

Positioned as **"Free. No ads. No limits."** ([tricount.com](https://www.tricount.com/)) — directly targeting the Splitwise complaints above.

Documented flow: (1) name the trip/household and invite the group, (2) **add an expense, choose who's included, and record who paid**, (3) see who owes what and pay back.

**What it does differently for groups without accounts:** the tricount is addressed by a **shareable link** rather than requiring every participant to register. Participants are **named strings created by the group owner**, not authenticated users — one person can enter expenses on everyone's behalf, and others open a link to view. This removes the biggest drop-off in group apps: "my friend never installed it."

**Relevance to Upper-I:** you have Google OAuth and a fixed group, so you don't need the anonymous model — but **the read-only share link is worth stealing** for a member whose session expired on 4G.

### Settle Up

From the store listing ([Play Store](https://play.google.com/store/apps/details?id=cz.destil.settleup)): *"super easy to use for simple splits, but we've got you covered if you want to add complicated expenses."* Headline features include **📶 works offline**, splitting by **weights**, **multiple people paying**, and bill-level item splits. Receipt photos are **Premium**.

Notable from real reviews:
- *"I prefer on group trips to just have a single person manage the expenses. This app does that so well… the ability to just make a link for people to view things… The 'variable shares' for couples is wonderful."* → validates **weights/shares** (already in your Active requirements) and the **view-only link**.
- *"I had a bit of trouble with refunding expenses as I kept trying to add it as a new transaction… I eventually figured out there's a refund 'Debt Settled' button."* → **reversing entries are discoverable only if you give them a button.** Your ledger is append-only; surface "Hoàn tiền / Đảo bút toán" explicitly or users will hand-roll wrong corrections.

### 12 borrowable interaction patterns

| # | Pattern | Source | Apply to Upper-I |
|---|---|---|---|
| 1 | Split control as an **editable sentence**, not a form | Splitwise | `Tân trả, chia đều cho cả nhóm` — two tap targets |
| 2 | **Equal split is the default**, never asked | Splitwise | Default = all active members |
| 3 | **Tap a name to toggle out**; remainder redistributes | Splitwise | Avatar row, tap to dim |
| 4 | Complexity behind **"More options"** | Splitwise | Shares/itemize hidden by default |
| 5 | **Payer defaults to current user** | All three | You know the user — zero taps |
| 6 | **Date defaults to today**, editable but never blocking | All three | Hide behind more-options |
| 7 | **FAB persistent** on the group screen | All three | Present on every tab |
| 8 | **Works offline** as a first-class promise | Settle Up | Optimistic UI + retry |
| 9 | **Weights/shares** for uneven consumers | Settle Up | Already a requirement |
| 10 | **Read-only share link** for non-installers | Tricount / Settle Up | Fallback when auth dies on 4G |
| 11 | **Explicit refund/settle button** instead of edit | Settle Up reviews | Surfaces the reversing entry |
| 12 | **No ad or interstitial before entry** | Splitwise backlash | Nothing between tap and amount field |

---

## 2. The Sub-15-Second Entry Flow

### The structural advantage

Splitwise/Tricount/Settle Up must support arbitrary groups, so **people-selection is unavoidable** for them. Upper-I has a **fixed roster of <10 known faces**. That means both the payer and the beneficiary set have correct defaults ~90% of the time, so the entire "who" half of the form becomes a *confirmation glance*, not an interaction.

The remaining irreducible work is: **how much**, and **what for**.

### Screen one — field order and defaults

Amount comes first. It is the only field with no sensible default, and the user is holding the bill.

| # | Element | Default | Interaction |
|---|---|---|---|
| 1 | **Amount** (VND, autofocused, numeric keypad up on mount) | empty | type `150` → keypad |
| 2 | **Quick-amount chips** (optional accelerator) | 50k / 100k / 200k | 1 tap, skips typing |
| 3 | **Description chips** — 6 most recent/frequent | `Ăn trưa` `Cà phê` `Đi chợ` `Nhậu` `Grab` `Ăn tối` | 1 tap |
| 4 | **Split sentence** `Tân trả · chia đều cả nhóm` | payer = me, beneficiaries = all | 0 taps |
| 5 | **Avatar row**, all highlighted | everyone in | tap to exclude |
| 6 | **Lưu** (full-width, bottom, thumb zone) | — | 1 tap |

Behind **`Tuỳ chọn khác`**: date (today), category, note, chia theo phần, chia theo món, ảnh bill, currency (never — VND only).

### Tap count

**Happy path — equal split, description from a chip:**

| Action | Taps |
|---|---|
| FAB `+` | 1 |
| Type amount (`150` with 000-chip or `150000`) | 3–6 keypad presses |
| Description chip | 1 |
| `Lưu` | 1 |
| **Total** | **4 taps + ~4 keypresses ≈ 7–9 s** |

**With a custom description:** +1 tap to focus + typing ≈ 12–14 s — still inside budget, which is why the chips matter.

**Excluding one person:** +1 tap (~1 s).

### Design rules this implies

- **Autofocus the amount field and raise the keypad on mount.** Saves a tap and signals "type the number".
- **A `000` key or quick-chips are high value in VND** — amounts carry three dead zeros. `150` + `000` beats typing six digits.
- **The Save button must be reachable by thumb** (bottom, full-width), not a top-right nav item, since the user is one-handed and standing.
- **Never block Save on an empty description.** Fall back to the date or category; an unnamed 150.000₫ expense is far better than a lost one.
- **Description chips should be frequency-ranked from this group's own history** — after two weeks, the top 6 will cover most entries.

---

## 3. Mobile Input Details

### Why `inputMode="numeric"` beats `type="number"`

GOV.UK moved its Design System off `type="number"` after user research ([blog post](https://technology.blog.gov.uk/2020/02/24/why-the-gov-uk-design-system-team-changed-the-input-type-for-numbers/)). Their current guidance ([Text input component](https://design-system.service.gov.uk/components/text-input/)):

> If you're asking the user to enter a whole number, set the `inputmode` attribute to `numeric` to use the numeric keypad… **Do not use `<input type="number">` unless your user research shows that there's a need for it.** With `<input type="number">` there's a risk of users accidentally incrementing a number when they're trying to do something else — for example, scroll up or down the page. And if the user tries to enter something that's not a number, there's no explicit feedback.

Concretely, `type="number"` breaks this app:
- **Scroll-wheel / swipe increments the value** — catastrophic for a money field on a touch device.
- **Spinner arrows** eat horizontal space and are untappable at thumb size.
- **`.value` returns `""` for invalid input**, so you cannot inspect what the user typed to recover.
- **You cannot insert thousand separators** — `1.500.000` is not a valid `type="number"` value, so live formatting is impossible.

`type="text"` + `inputMode="numeric"` gives the same keypad with none of this. **VND has no sub-unit, so `numeric` is right — not `decimal`.** Don't show a decimal key for a currency that never uses one.

### iOS zoom-on-focus

If an `<input>`'s `font-size` is **≥16px**, iOS Safari focuses normally; at **15px or less it zooms the viewport into the field** ([CSS-Tricks](https://css-tricks.com/16px-or-larger-text-prevents-ios-form-zoom/)). Mid-entry zoom is disorienting and often hides the Save button.

Fix it with font-size, **not** `maximum-scale=1` / `user-scalable=no` — those disable pinch-zoom entirely and are an accessibility failure. The amount field wants to be large anyway (24–32px).

### Safe-area insets and touch targets

- Bottom-anchored Save must clear the home indicator: `padding-bottom: max(16px, env(safe-area-inset-bottom))`, with `viewport-fit=cover` in the meta tag.
- **Minimum 44×44px touch targets** (Apple HIG) / 48dp (Material). Member avatars in the exclude-row must be ≥44px with ≥8px gaps — they're toggles, and a mis-tap silently changes who pays.

### Amount input component

```tsx
'use client';

import { useRef, useState, useLayoutEffect, type ChangeEvent } from 'react';

/** Count digits in `str` up to `pos` — separator-independent cursor anchor. */
function digitsBefore(str: string, pos: number): number {
  let n = 0;
  for (let i = 0; i < pos && i < str.length; i++) {
    if (str[i] >= '0' && str[i] <= '9') n++;
  }
  return n;
}

/** Map a digit index back to a string offset in the formatted value. */
function offsetForDigit(str: string, target: number): number {
  if (target === 0) return 0;
  let n = 0;
  for (let i = 0; i < str.length; i++) {
    if (str[i] >= '0' && str[i] <= '9') {
      n++;
      if (n === target) return i + 1;
    }
  }
  return str.length;
}

const MAX_VND = 999_999_999;

/** 1500000 -> "1.500.000" (vi-VN uses "." as the thousand separator). */
function format(v: number): string {
  return v.toLocaleString('vi-VN');
}

export function AmountInput({
  value,
  onChange,
  autoFocus = true,
}: {
  /** Amount in integer VND đồng. Never a float. */
  value: number;
  onChange: (next: number) => void;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [caret, setCaret] = useState<number | null>(null);
  const display = value === 0 ? '' : format(value);

  // Restore the caret after React commits the reformatted value.
  useLayoutEffect(() => {
    if (caret !== null && ref.current) {
      ref.current.setSelectionRange(caret, caret);
      setCaret(null);
    }
  }, [caret, display]);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const el = e.target;
    const raw = el.value;
    const selStart = el.selectionStart ?? raw.length;

    // Anchor on digit count, so inserted/removed separators don't shift the caret.
    const digitIdx = digitsBefore(raw, selStart);

    const digits = raw.replace(/\D/g, '');
    if (digits.length > 15) return; // guard against paste bombs
    const next = Math.min(digits === '' ? 0 : parseInt(digits, 10), MAX_VND);

    onChange(next);
    setCaret(offsetForDigit(next === 0 ? '' : format(next), digitIdx));
  }

  return (
    <div className="relative">
      <input
        ref={ref}
        // text + inputMode, never type="number": no scroll-increment, no
        // spinners, and separators stay valid in .value
        type="text"
        inputMode="numeric"
        // Hint digits only; pattern also surfaces the numeric keypad on iOS
        pattern="[0-9.]*"
        autoFocus={autoFocus}
        autoComplete="off"
        enterKeyHint="done"
        value={display}
        onChange={handleChange}
        onFocus={(e) => e.currentTarget.select()}
        placeholder="0"
        aria-label="Số tiền"
        // >=16px is mandatory or iOS Safari zooms the viewport on focus.
        // 30px here for thumb-accuracy and glanceability.
        className="w-full bg-transparent pr-12 text-right font-semibold tabular-nums
                   text-[30px] leading-tight outline-none"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2
                   text-[20px] text-neutral-400"
      >
        ₫
      </span>
    </div>
  );
}
```

Why this survives real use:

- **State is an integer number of đồng.** Formatting is a pure render concern, so no float ever touches the value — consistent with the ledger rule in PROJECT.md.
- **Caret anchored to digit count, not string offset.** When typing `1500` → `1.500`, a naive restore leaves the caret before the inserted `.`; digit-anchoring is immune to how many separators appeared or vanished.
- **`useLayoutEffect`** restores selection before paint, so there's no visible caret jump.
- **`onFocus` select-all** makes correcting a wrong amount one gesture instead of many backspaces.
- **`tabular-nums`** stops the number jittering horizontally as digits change.
- **`enterKeyHint="done"`** labels the keypad's action key usefully.

Pair it with:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

```css
.save-bar { padding-bottom: max(16px, env(safe-area-inset-bottom)); }
input, select, textarea { font-size: 16px; } /* floor — prevents iOS zoom */
```

---

## 4. Offline & Flaky-Network Resilience

### The actual problem

"I tapped save, it spun, I tapped again, now there are two expenses." Note this is **not an offline problem** — it's a *slow response* problem, and it is the only network failure that silently corrupts the ledger. A failed save is visible and the user retries; a duplicated save is invisible and poisons every balance.

The old system already failed here: PROJECT.md records that dedup on `payer|payee|amount` blocked legitimate repeat payments *and swallowed them silently*. Content-based dedup is the wrong mechanism. **Identity-based dedup (a client-generated key) is the right one.**

### Comparing the two investments

| | Optimistic UI + server action + idempotency key | IndexedDB queue + Background Sync |
|---|---|---|
| Fixes double-submit | ✅ completely | ✅ |
| Entry while fully offline | ❌ (fails fast, visible) | ✅ |
| Build cost | ~0.5 day | ~1–2 weeks |
| New source of truth | **No** | **Yes — local queue** |
| Conflict/merge logic | None | Required |
| iOS Safari support | Full | **Background Sync unsupported on iOS Safari** |
| Risk to ledger correctness | Low | Medium-high |

The deciding argument is architectural, not effort-based. PROJECT.md's central lesson is **"đúng một nguồn sự thật"** — the Sheets version died of two parallel sources of truth. An IndexedDB write queue reintroduces exactly that: a local pending-ledger that can diverge from the server. Plus Background Sync doesn't work in iOS Safari, so you'd build the queue *and* still need a foreground retry path.

Also: the user is **in a restaurant where they just paid by phone or saw a QR**. Connectivity is slow, not absent. Optimistic UI covers slow; the queue solves a scenario that barely occurs here.

**Recommendation: optimistic UI + idempotency keys. Do not build the offline queue.** Revisit only if real usage shows actual zero-connectivity entry attempts.

### The minimum that prevents duplicates

Three things, in order of importance:

**1. Idempotency key generated when the form opens — not on submit.**

```tsx
// ✅ one key per user intent, stable across retries
const [idemKey] = useState(() => crypto.randomUUID());

// ❌ a new key per tap — defeats the entire mechanism
// const idemKey = crypto.randomUUID();
```

Enforce it in the schema so correctness doesn't depend on the client behaving:

```sql
ALTER TABLE ledger_entries
  ADD COLUMN idempotency_key uuid NOT NULL;
CREATE UNIQUE INDEX ledger_entries_idem_uniq
  ON ledger_entries (idempotency_key);
```

```ts
// Insert is a no-op on replay; return the existing row rather than erroring.
// Critically: do NOT swallow this silently the way the Apps Script version did —
// the second tap should land the user on the SAME saved expense.
const row = await db
  .insertInto('ledger_entries')
  .values(entry)
  .onConflict((oc) => oc.column('idempotency_key').doNothing())
  .returningAll()
  .executeTakeFirst()
  ?? await db.selectFrom('ledger_entries')
       .selectAll().where('idempotency_key', '=', entry.idempotencyKey)
       .executeTakeFirstOrThrow();
```

**2. Disable the button while pending.** `useActionState`/`useFormStatus` gives `pending` for free; a disabled Save removes most double-taps before they happen. Cheap, and it's UI feedback the user needs regardless.

**3. `useOptimistic` so the expense appears instantly.** The duplicate tap is usually caused by *no visible feedback*. Render the new expense in the list immediately with a subtle pending state; the user sees it worked and stops tapping.

```tsx
const [optimistic, addOptimistic] = useOptimistic(
  expenses,
  (state, next: Expense) => [{ ...next, pending: true }, ...state],
);
```

Note `useOptimistic` must be called inside a Transition/Action, and React reverts automatically if the action throws — so a genuine failure un-renders the row rather than leaving a phantom expense.

**Also worth having given Neon's cold start** (PROJECT.md flags compute suspend): the first request after idle can take seconds, which is *exactly* the spinner that triggers re-tapping. Items 2 and 3 are what make a cold start survivable; a warming ping on app focus helps further.

---

## 5. Information Architecture

### Core loop

`see what I owe → add an expense → settle up → check history`

Of these, **add an expense** is overwhelmingly the most frequent and the most time-critical. It therefore must not live in a tab — it must be reachable from everywhere in one tap.

### Navigation model: 3 tabs + persistent FAB

```
┌─────────────────────────────┐
│  Upper-I          [avatar]  │
├─────────────────────────────┤
│                             │
│         content             │
│                       ╭───╮ │
│                       │ + │ │   ← FAB, every tab
│                       ╰───╯ │
├─────────────────────────────┤
│   Số dư  │ Lịch sử │  Nhóm  │   ← bottom tabs, thumb zone
└─────────────────────────────┘
```

Three tabs, not five. With <10 people and one fixed group there is no "groups" list, no friends tab, no multi-currency switcher — the big apps' tab bars mostly serve features you've explicitly scoped out.

### Screen list

| Screen | Entry | Purpose |
|---|---|---|
| **Số dư** (home) | tab 1 | Your net position + per-person breakdown + settle-up suggestions |
| **Thêm chi tiêu** | FAB (sheet) | The <15s flow. Bottom sheet, not a route — preserves context and dismisses fast |
| **Tuỳ chọn khác** | in-sheet expand | Date, category, note, shares, itemize, receipt |
| **Chi tiết chi tiêu** | tap a row | Who paid, who shared, reversing-entry button |
| **Lịch sử** | tab 2 | Chronological ledger, grouped by day, month filter |
| **Chốt kỳ / Báo cáo** | from Lịch sử | Monthly report, close period |
| **Trả tiền (QR)** | from Số dư | VietQR with amount + memo prefilled |
| **Xác nhận nhận tiền** | notification / Số dư | Two-sided settlement confirmation |
| **Nhóm** | tab 3 | Members, display names, sign-out |

### Justification against the teardown

- **FAB on every tab** — all three competitors keep add-expense one tap from the group view; you extend it to all tabs since it's your dominant action.
- **Add-expense as a bottom sheet, not a route.** Faster open/close, no navigation animation, and dismissing doesn't lose your place. The sheet also naturally sits in the thumb zone with the keypad.
- **Balance is home, not history.** Splitwise opens on balances because "what do I owe" is the most common *read*; history is the rarer audit case.
- **No search tab.** <10 people and a monthly volume measured in dozens — a month filter in Lịch sử is sufficient.
- **Explicit reversing-entry button on expense detail**, per the Settle Up review where a user repeatedly tried to hand-roll a refund as a new transaction. Your ledger is immutable, so this button is the *only* correct path — it must be obvious.

---

## 6. Balance Display Clarity

### Why users get confused

Three distinct confusions recur in this product category:

1. **Net vs gross.** "You owe Minh 100k" and "Minh owes you 40k" can both be true at the item level while the net is 60k. Showing both reads as a contradiction.
2. **Direction ambiguity.** A bare `-150.000 ₫` is unreadable: is that what I owe, or what I'm short? Sign conventions are not self-evident.
3. **Simplified debts look wrong.** After debt simplification you may owe someone you never transacted with. Users read this as a bug. ([Splitwise's own KB maintains a dedicated explainer for this](https://kb.splitwise.com/balances-and-expenses/what-are-different-ways-i-can-split-an-expense) class of question.)

Upper-I hits #3 hard because debt simplification is an explicit requirement.

### Conventions the established apps use

- **Splitwise:** green = "you are owed", red/orange = "you owe", with a sentence-form total at the top ("you are owed $42.50 overall"). Sentences first, numbers second.
- **Settle Up:** per-person rows with signed amounts plus an explicit settle-up suggestion list.
- All three **lead with the user's own net position**, then break it down per person.

### Recommended presentation

**Tier 1 — one sentence, impossible to misread:**

```
        Bạn đang nợ
        150.000 ₫
   ───────────────────
   [  Trả ngay bằng QR  ]
```

Not a signed number. Not "Số dư". A **verb phrase with a direction**.

**Tier 2 — per-person breakdown, direction spelled out per row:**

```
Bạn nợ
  Minh      120.000 ₫   [Trả]     ← red
  Hà         30.000 ₫   [Trả]     ← red

Được nhận
  Tuấn       80.000 ₫   [Nhắc]    ← green
```

Group by direction with headers; don't mix signs in one list. The sign then becomes redundant reassurance rather than the sole carrier of meaning.

**Tier 3 — explain simplification inline**, since this is where trust breaks:

> `Đã rút gọn: thay vì 6 lượt chuyển, nhóm chỉ cần 3 lượt.` — tappable → shows the underlying pre-simplification debts.

Letting a suspicious user drill into the raw ledger is what converts "this is wrong" into "ah, it's right".

### Vietnamese labels

| Context | Recommended | Avoid | Why |
|---|---|---|---|
| Net, you owe | **Bạn đang nợ 150.000 ₫** | `Số dư: -150.000` | Verb + direction, no sign decoding |
| Net, owed to you | **Bạn được nhận 80.000 ₫** | `Số dư: +80.000` | "được nhận" is unambiguous |
| Settled | **Đã cân bằng** / **Không nợ ai** | `0 ₫` | A bare zero reads as "no data" |
| Section — debts | **Bạn nợ** | `Nợ phải trả` | Accounting jargon |
| Section — credits | **Được nhận** | `Phải thu` | Same |
| Per-expense | **Tân trả · chia đều 5 người** | `Payer: Tân` | Mirrors the Splitwise sentence |
| Your share | **Phần của bạn: 30.000 ₫** | `Share` | — |
| Pay action | **Trả ngay** | `Thanh toán` | Shorter, more direct |
| Nudge action | **Nhắc** | `Yêu cầu thanh toán` | Fits a button |
| Payment sent | **Đã chuyển, chờ xác nhận** | `Pending` | States who acts next |
| Payment confirmed | **Đã nhận** | `Hoàn tất` | Names the actual event |
| Simplification | **Đã rút gọn chuyển khoản** | `Debt simplification` | — |
| Reversing entry | **Hoàn tiền / Ghi đảo** | `Xoá` | Honest: nothing is deleted |
| Close period | **Chốt kỳ tháng 10** | `Reset` | "Reset" implies data loss |

**Formatting:** `150.000 ₫` — vi-VN uses `.` as the thousand separator, with the symbol trailing after a space. Use `Intl.NumberFormat('vi-VN')` and **never render decimals** (the ledger is integer đồng).

**Color:** red = you owe, green = you are owed, neutral grey = settled. Never color-only — every row carries a direction word, so the display survives color-blindness and glare in a lit restaurant.

---

## 7. Receipt OCR (late phase — scope, don't over-invest)

### What makes Vietnamese receipts hard

- **Stacked diacritics.** Vietnamese has 12 vowel letters × 6 diacritical marks = 34 distinct vowel characters, and a vowel can carry a tone mark *on top of* another diacritic (`ệ` = e + horn + dot below). Characters are effectively 2–3 marks tall; at low resolution the marks merge or vanish. Dropping one changes the word — `đã` → `da`, `mã` → `mà`. ([FastOCR Vietnamese guide](https://fastocr.org/blog/vietnamese-ocr-guide))
- **Thermal printing** is low-contrast, fades, smudges with heat, and curls — guidance for Vietnamese OCR asks for 300+ DPI and crisp contrast, which a phone photo of a curled thermal slip rarely provides.
- **Heavy abbreviation.** `C.cơm`, `Nc ngọt`, `TC`, `K/mãi` — no dictionary coverage, so char-level engines can't self-correct.
- **VAT / service lines.** `Thuế GTGT 8%`, `Phí phục vụ 5%`, `Chiết khấu` must be recognized as *allocations across all items*, not as line items — this is structural understanding, not text extraction.
- **Variable layout.** Supermarket slips differ wildly from restaurant bills; no fixed template.

### Options compared (~100 receipts/month)

| | Vietnamese accuracy | Structure | Cost @100/mo | Free tier? |
|---|---|---|---|---|
| **(a) Multimodal LLM** (Gemini Flash / GPT-4o-mini / Haiku) | **Best** — language model corrects diacritics and abbreviations from context | **Native** — emits line items directly | **$0** on Gemini free tier; ~$0.02–0.15 on paid | **Yes — Gemini Flash input & output "Free of charge"** |
| **(b) Cloud Vision OCR + parser** | Good raw text; still loses marks on faded thermal | **None** — you write the parser | $0 | **Yes — first 1,000 units/month free**, then $1.50/1k |
| **(c) Tesseract.js in-browser** | **Poor** on stacked diacritics + thermal print | None | $0 | N/A (local) |

Sources: [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing) (Flash tiers list Input/Output price = "Free of charge" on Free Tier), [Cloud Vision pricing](https://cloud.google.com/vision/pricing) ("the first 1000 units used each month are free"; Text Detection and Document Text Detection both Free in that band).

**Option (b)'s real cost isn't money — it's the parser.** Turning a flat text dump into `{name, qty, unitPrice, total}` across arbitrary Vietnamese receipt layouts, while apportioning a VAT line, is a sustained maintenance burden. Vision gives you strings; you still have to invent the structure.

**Option (c) is the trap.** It's free and client-side, so it looks ideal for a 0₫ budget — but Vietnamese diacritics on thermal paper are close to its worst case, and wrong line items are worse than no line items because a human now has to spot the errors.

### Recommendation: Gemini Flash, free tier, server-side

Rationale:
- It's the **only option that solves the actual problem** — structure, not characters. One call returns typed line items.
- It **handles abbreviations and missing diacritics** via language context, which is precisely where (b) and (c) fail.
- **$0 at this volume**, satisfying the hard constraint. 100 receipts/month is trivially within free-tier rate limits (which are per-minute/per-day, and you're making a handful of calls a day).
- Structured output / JSON schema support means you get validated JSON, not prose to re-parse.

**Caveats to record:**
1. **Free-tier input is used to improve Google's products** — the pricing table marks "Used to improve our products: **Yes**" for the free tier and **No** for paid ([source](https://ai.google.dev/gemini-api/docs/pricing)). Receipt photos may contain names/card tails. Disclose to the group, or accept it explicitly.
2. **Exact free-tier RPM/RPD are no longer published as static numbers** — Google now directs you to the [AI Studio rate-limit dashboard](https://aistudio.google.com/rate-limit) and states limits "are not guaranteed and actual capacity may vary" ([rate limits doc](https://ai.google.dev/gemini-api/docs/rate-limits)). Verify in-console at build time; design for 429s.
3. **Call it from the server**, never the browser — an API key in client code is a public key.
4. **Vercel Hobby has a 10s function timeout** (per PROJECT.md). Upload → OCR → respond can exceed that. Return immediately and poll, or stream; don't block the request on the model call.
5. **Keep the model behind a thin interface.** If the free tier changes, Cloud Vision + parser remains a fallback, and the swap should touch one module.

### Structured output schema

```ts
import { z } from 'zod';

const LineItem = z.object({
  name: z.string(),                  // as printed, diacritics preserved
  nameNormalized: z.string().nullable(), // abbreviations expanded, e.g. "C.cơm" -> "Cơm chiên"
  quantity: z.number().int().positive().default(1),
  unitPrice: z.number().int(),       // integer VND đồng — never float
  total: z.number().int(),           // quantity * unitPrice as printed
  confidence: z.enum(['high', 'medium', 'low']),
});

const Adjustment = z.object({
  kind: z.enum(['vat', 'service', 'discount', 'delivery', 'other']),
  label: z.string(),                 // "Thuế GTGT 8%"
  amount: z.number().int(),          // signed; discounts negative
  // allocate proportionally across line items, per PROJECT.md
  allocation: z.enum(['proportional', 'fixed']).default('proportional'),
});

export const ReceiptSchema = z.object({
  merchant: z.string().nullable(),
  purchasedAt: z.string().nullable(),      // ISO 8601
  currency: z.literal('VND'),
  lineItems: z.array(LineItem),
  adjustments: z.array(Adjustment),
  subtotal: z.number().int().nullable(),
  grandTotal: z.number().int().nullable(),  // the printed TỔNG CỘNG
  overallConfidence: z.enum(['high', 'medium', 'low']),
});
```

Design notes:
- **All money is `int` đồng**, consistent with the project-wide no-float rule. Instruct the model to strip separators and emit integers.
- **Per-item `confidence`** is what drives the correction UI — it tells you which fields to flag.
- **`adjustments` is separate from `lineItems`** so VAT/service never becomes a splittable "dish", and maps straight onto the proportional-allocation requirement.
- **`grandTotal` is the checksum.** If `Σ(items) + Σ(adjustments) ≠ grandTotal`, the extraction is wrong — surface that loudly rather than silently trusting it.

### Handling inevitable OCR errors — the correction UI

**Treat OCR as a draft, never as a result.** The human correction step matters more than raw accuracy; a 95%-accurate extraction with no correction path is worse than an 80% one with a fast fix.

1. **Never auto-save an OCR'd expense.** It always lands in an editable review sheet.
2. **Lead with the checksum.** Show `Tổng từ bill: 450.000 ₫ · Tổng cộng các món: 430.000 ₫ — lệch 20.000 ₫` in red when they disagree, and offer "thêm dòng thiếu" / "gán phần lệch". This catches dropped rows, the most damaging failure, without the user auditing every line.
3. **Pre-focus the first low-confidence field** so the user starts where it's likely wrong.
4. **Visually mark `confidence: low`** fields (amber underline) and leave `high` fields unadorned — directing attention is the whole job.
5. **Every field is a one-tap text input**; amounts reuse `AmountInput` from §3.
6. **Swipe-to-delete a line**, plus an always-present "Thêm món" row — deletion and insertion are the most common repairs.
7. **Provide a bail-out: "Bỏ qua chi tiết, chỉ nhập tổng".** If OCR goes badly the user must be able to fall back to the 9-second flow from §2 instead of fighting a form.
8. **Keep the photo visible** (thumbnail, tap to zoom) above the rows so corrections don't require re-opening the camera roll.
9. **Degrade honestly on failure.** On a 429, timeout, or checksum far off, say `Không đọc được bill, nhập tay nhé` and drop straight into the manual flow. Never show a half-populated form from a failed parse.

### Scope guidance

This is the last phase for good reason — it's the only AI surface, it needs its own evaluation, and **the manual flow in §2 is already fast enough that OCR is a convenience, not a necessity.** Budget it as: one server action, one Zod schema, one review sheet. Don't build receipt-image storage, multi-receipt batching, or merchant learning in v1.

---

## Sources

| Claim | URL | Confidence |
|---|---|---|
| Splitwise split options, equal default, sentence control, Pro-only scan | https://kb.splitwise.com/balances-and-expenses/what-are-different-ways-i-can-split-an-expense | HIGH (vendor) |
| Splitwise free-tier backlash: 3 txn/day, 10s video ad | https://www.reddit.com/r/personalfinance/comments/186v5wj/the_downfall_of_splitwise/ | MEDIUM (user reports) |
| Tricount positioning, no-account link model, 3-step flow | https://www.tricount.com/ · https://www.tricount.com/features/group-expense-tracking | MEDIUM (vendor marketing) |
| Settle Up: offline, weights, multiple payers, Premium receipts; refund-button confusion | https://play.google.com/store/apps/details?id=cz.destil.settleup | MEDIUM (listing + reviews) |
| Avoid `type="number"`; use `inputmode` | https://technology.blog.gov.uk/2020/02/24/why-the-gov-uk-design-system-team-changed-the-input-type-for-numbers/ | HIGH |
| `inputmode=numeric` for whole numbers; explicit "do not use type=number" | https://design-system.service.gov.uk/components/text-input/ | HIGH |
| iOS zooms on focus below 16px | https://css-tricks.com/16px-or-larger-text-prevents-ios-form-zoom/ | HIGH |
| `useOptimistic` semantics, Transition requirement, auto-revert | https://react.dev/reference/react/useOptimistic | HIGH (official) |
| Gemini Flash free tier "Free of charge"; free-tier data used for training | https://ai.google.dev/gemini-api/docs/pricing | HIGH (official) |
| Gemini rate limits now via AI Studio dashboard, not guaranteed | https://ai.google.dev/gemini-api/docs/rate-limits | HIGH (official) |
| Cloud Vision: first 1,000 units/month free, then $1.50/1k | https://cloud.google.com/vision/pricing | HIGH (official) |
| Vietnamese diacritic stacking, 34 vowel chars, OCR error modes, 300 DPI | https://fastocr.org/blog/vietnamese-ocr-guide | MEDIUM (vendor blog) |

**Gaps / verify at build time:**
- Exact Gemini free-tier RPD for the chosen Flash model — only visible in AI Studio console.
- Competitor tap counts are derived from documented step lists, not instrumented sessions; re-check against the live apps if a specific count becomes load-bearing.
- No Vietnamese-specific benchmark of Gemini vs Vision on *thermal* receipts was found — run a 10-receipt spike before committing the OCR phase.

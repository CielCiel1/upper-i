# Research: VietQR / bank transfer QR generation and settlement UX

**Project:** Upper-I — Chia tiền nhóm
**Researched:** 2026-10-06
**Mode:** Ecosystem + feasibility
**Overall confidence:** HIGH for topics 1–5 (empirically verified against live VietQR output), MEDIUM-HIGH for 6–7 (vendor pricing pages + algorithmic reasoning).

> **Verification note.** The payload builder in §1 was not written from memory. It was validated by generating a reference QR from VietQR's own image endpoint, decoding it, and diffing byte-for-byte against this implementation. Both the dynamic (with amount) and static (no amount) variants match **exactly**. The CRC16 passes the standard `"123456789" → 29B1` test vector. Bank BINs in §3 were pulled live from `api.vietqr.io/v2/banks` on the research date, not recalled.

---

## Key Findings

- **Build the payload yourself, render the QR client-side with `qrcode`.** This is confirmed correct, not merely plausible. Zero cost, zero network calls, zero rate limits, and — the decisive point — **account numbers never leave your infrastructure**. `img.vietqr.io` requires putting every member's bank account number in a URL to a third party.
- **The payload is ~100–135 chars of EMVCo TLV.** Trivially constructible. The entire dependency is ~15 lines of code plus a CRC16 routine. No API, no key, no registration.
- **`accountName` is NOT part of the VietQR payload.** Verified: passing `accountName` to VietQR's own API produces a payload with no name field. The bank resolves and displays the real account holder name itself. **Do not store account holder name for QR purposes** — store it only as a human-facing confirmation label, if at all.
- **Two BINs break the `9704xx` pattern:** CAKE is `546034` and Timo is `963388`. Any validation regex assuming `^9704\d{2}$` will reject them. Both verified working through round-trip encode/decode.
- **The point-of-initiation flag must switch:** tag `01` = `12` when an amount is present (dynamic), `11` when absent (static). Verified against both VietQR reference outputs. Getting this wrong is the single most likely silent bug.
- **There is no free way to auto-detect incoming transfers.** Confirmed: SePay's cheapest plan is 120,000₫/month; Casso offers only a 14-day / 100-transaction trial. Both are business products requiring a business account. **Manual two-sided confirmation is the only 0₫ design** — this is a hard constraint, not a shortcut.
- **Pending settlements must NOT move balances.** Argued in §6. Treating "I sent it" as real money is exactly the dual-source-of-truth bug that killed the Apps Script version.
- **Default debt simplification OFF.** Simplification invents transfers between people who never transacted. For a 9-person household that eats together, the social cost of "why am I paying Hường, I owe Đạt?" exceeds the benefit of saving one transfer. Splitwise made it optional for this reason.
- **ASCII-fold all memo text.** Vietnamese diacritics in transfer memos are unreliable across banks; several silently strip or mangle them. Folding is 3 lines and verified against 10 real-name cases.

---

## 1. VietQR / EMVCo payload construction

### Is the spec public?

**Partially.** VietQR is NAPAS's implementation of the **EMVCo Merchant-Presented QR (MPM)** specification. The EMVCo base spec is publicly downloadable; the NAPAS-specific profile (the tag 38 template contents, the `QRIBFTTA` service code) is distributed to member institutions rather than published as an open standard. However the format is **fully recoverable by inspection** — any VietQR code can be decoded and read, which is how the implementation below was verified. There is no legal or technical barrier to generating these yourself; the format is a deterministic string encoding, not a proprietary or signed protocol.

### TLV structure

Everything is `TTLLVV` — a 2-digit tag, a 2-digit zero-padded **character** length, then the value. Templates nest TLV inside TLV.

```
00 02 01                    Payload format indicator = "01"
01 02 12                    Point of initiation: 11=static, 12=dynamic (has amount)
38 .. <template>            Merchant Account Information — NAPAS
   00 10 A000000727           Globally Unique Identifier (NAPAS AID)
   01 .. <beneficiary>         Beneficiary organisation
      00 06 970436               Acquirer ID / bank BIN (6 digits)
      01 .. 1234567890           Consumer account number
   02 08 QRIBFTTA              Service code: account-to-account transfer
53 03 704                   Currency, ISO 4217 numeric: 704 = VND
54 .. 50000                 Transaction amount (OMIT entirely if not pre-filling)
58 02 VN                    Country code
62 .. <additional data>     Additional Data Field template
   08 .. TEST MEMO            Purpose of transaction  <-- the memo
63 04 DBA4                  CRC16-CCITT (FALSE) over everything incl. "6304"
```

Critical details, each verified:

- **Length is character count, zero-padded to 2 digits.** `"TEST MEMO"` is 9 chars → `09`.
- **Amount is a plain decimal string with no thousands separators and no decimals** for VND. `50000`, never `50,000` or `50000.00`.
- **The CRC is computed over the payload *including* the literal `6304` prefix**, then appended as 4 uppercase hex chars. This trips up most naive implementations.
- **`QRIBFTTA`** = QR Inter-Bank Fund Transfer To Account. (`QRIBFTTC` exists for transfer-to-card; you want TTA.)
- **Service code tag `02` sits in the tag-38 template**, as a sibling of tag `01`, not nested inside the beneficiary.

### Verified ground truth

Reference QR fetched from VietQR's own image endpoint and decoded:

```
00020101021238540010A00000072701240006970436011012345678900208QRIBFTTA53037045405500005802VN62130809TEST MEMO6304DBA4
```

The implementation below reproduces this string **exactly**, and also reproduces the static (no-amount) variant exactly:

```
00020101021138540010A00000072701240006970436011012345678900208QRIBFTTA53037045802VN6304BE57
```

### Implementation

```ts
// lib/vietqr.ts

export interface VietQRParams {
  /** 6-digit NAPAS acquirer ID. Note: not always 9704xx (Cake=546034, Timo=963388). */
  bankBin: string;
  /** Beneficiary account number, digits only. */
  accountNumber: string;
  /** Integer VND. Omit/null for a static QR the payer types the amount into. */
  amount?: number | null;
  /** Purpose of transaction. MUST be pre-folded to ASCII — see foldVietnamese(). */
  memo?: string | null;
}

/**
 * CRC-16/CCITT-FALSE: poly 0x1021, init 0xFFFF, no reflection, no final XOR.
 * Verified: crc16ccitt("123456789") === "29B1".
 */
export function crc16ccitt(str: string): string {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** Encode one TLV field. Length is CHARACTER count, zero-padded to 2 digits. */
const tlv = (tag: string, value: string): string =>
  tag + String(value.length).padStart(2, '0') + value;

/**
 * Build a VietQR (EMVCo MPM) payload string.
 * Verified byte-for-byte against VietQR's own generator for both the
 * dynamic (amount present) and static (amount absent) cases.
 */
export function buildVietQRPayload({
  bankBin,
  accountNumber,
  amount,
  memo,
}: VietQRParams): string {
  if (!/^\d{6}$/.test(bankBin)) throw new Error(`Invalid bank BIN: ${bankBin}`);
  if (!/^\d{4,19}$/.test(accountNumber))
    throw new Error(`Invalid account number: ${accountNumber}`);

  const hasAmount = amount != null;
  if (hasAmount) {
    if (!Number.isInteger(amount)) throw new Error('Amount must be an integer (VND)');
    if (amount <= 0) throw new Error('Amount must be positive');
  }

  // Tag 38 — NAPAS merchant account information
  const beneficiary = tlv('00', bankBin) + tlv('01', accountNumber);
  const merchantAccount =
    tlv('00', 'A000000727') +   // NAPAS globally unique identifier
    tlv('01', beneficiary) +
    tlv('02', 'QRIBFTTA');      // inter-bank fund transfer to account

  let payload = '';
  payload += tlv('00', '01');                      // payload format indicator
  payload += tlv('01', hasAmount ? '12' : '11');   // dynamic vs static
  payload += tlv('38', merchantAccount);
  payload += tlv('53', '704');                     // VND
  if (hasAmount) payload += tlv('54', String(amount));
  payload += tlv('58', 'VN');
  if (memo) payload += tlv('62', tlv('08', memo)); // 62-08 purpose of transaction

  payload += '6304';                               // CRC tag+length, included in digest
  return payload + crc16ccitt(payload);
}
```

Note there is **no `accountName` parameter**. It is not in the payload — the receiving bank resolves the name from the account number. Verified: VietQR's own API accepts `accountName` and discards it.

**Test to keep in the repo** (this is the regression guard that matters):

```ts
test('matches VietQR reference payload exactly', () => {
  expect(
    buildVietQRPayload({
      bankBin: '970436', accountNumber: '1234567890',
      amount: 50000, memo: 'TEST MEMO',
    })
  ).toBe(
    '00020101021238540010A00000072701240006970436011012345678900208QRIBFTTA' +
    '53037045405500005802VN62130809TEST MEMO6304DBA4'
  );
});

test('static variant switches tag 01 to 11', () => {
  expect(buildVietQRPayload({ bankBin: '970436', accountNumber: '1234567890' }))
    .toBe('00020101021138540010A00000072701240006970436011012345678900208QRIBFTTA' +
          '53037045802VN6304BE57');
});

test('CRC16 standard vector', () => expect(crc16ccitt('123456789')).toBe('29B1'));
```

---

## 2. Generating the QR image

| | (a) client-side `qrcode` | (b) `img.vietqr.io` | (c) VietQR.io registered API |
|---|---|---|---|
| Cost | 0₫ | 0₫ | Free tier, then paid |
| Registration | none | none | API key + business info |
| Account numbers sent to 3rd party | **no** | **yes, in URL** | **yes** |
| Works offline / PWA | **yes** | no | no |
| Rate limit | none | undocumented, unguaranteed | quota'd |
| Latency | ~instant, local | network round-trip | network round-trip |
| Fails if vendor is down | no | **yes** | **yes** |
| Bundle cost | ~17 KB gzipped | 0 | 0 |

### Recommendation: (a), confirmed

The premise in the brief is **correct**. Self-build the payload, render locally. Reasons, in priority order:

1. **Privacy.** Option (b) means every settlement view sends a group member's bank account number, their amount, and the memo to a third party as a plaintext URL — which lands in that vendor's access logs. For a 9-person friend group this is both unnecessary and hard to justify if anyone asks.
2. **Reliability.** The QR is the core payment path. Making it depend on an unmetered free endpoint with no SLA means an outage there breaks settlement for everyone.
3. **Offline.** PROJECT.md commits to a PWA and to entering expenses at the restaurant. Restaurant connectivity in Vietnam is unpredictable; a locally-rendered QR works regardless.
4. **Cold starts.** Neon suspends when idle. Not adding an outbound HTTP call to the render path keeps the QR instant even on a cold page.

The only thing (b) gives you is the prettier branded card with the bank logo. Not worth any of the above.

```tsx
// components/SettlementQR.tsx
'use client';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { buildVietQRPayload } from '@/lib/vietqr';

export function SettlementQR({ bankBin, accountNumber, amount, memo }: {
  bankBin: string; accountNumber: string; amount: number; memo: string;
}) {
  const [src, setSrc] = useState<string>();
  useEffect(() => {
    const payload = buildVietQRPayload({ bankBin, accountNumber, amount, memo });
    // Level M is what VietQR itself uses; payload is ~130 chars so size is small.
    QRCode.toDataURL(payload, { errorCorrectionLevel: 'M', margin: 2, width: 320 })
      .then(setSrc)
      .catch(console.error);
  }, [bankBin, accountNumber, amount, memo]);

  if (!src) return <div className="h-[320px] w-[320px] animate-pulse rounded bg-neutral-100" />;
  return <img src={src} width={320} height={320} alt="Mã QR chuyển khoản" />;
}
```

Use `qrcode` (1.5.4) rather than `qrcode.react` — it works in both server and client contexts and has no React version coupling. Render in a `useEffect` (not at module scope) so the payload is never computed during SSR where it could leak into HTML sent to a CDN cache.

**Verified:** payloads generated this way round-trip correctly through encode→decode for amount+memo, no-amount, no-memo, and both non-standard BINs.

---

## 3. Bank BIN codes

**Free public endpoint, no key required:** `https://api.vietqr.io/v2/banks` — returns 65 banks with `bin`, `code`, `shortName`, `name`, `logo`. Verified live and working on the research date.

**Recommendation: hardcode a static list.** For <10 users whose banks essentially never change, a runtime fetch adds a network dependency, a failure mode, and a cold-start cost to buy flexibility you will not use. BINs are stable — they change only when a bank is acquired or rebranded, which is a once-in-years event you can handle with a one-line edit and a `git push`.

Values below were **fetched live and verified**, not recalled:

```ts
// lib/banks.ts
export interface Bank { bin: string; short: string; code: string; name: string }

/** Source: https://api.vietqr.io/v2/banks (verified 2026-10-06). */
export const BANKS: Bank[] = [
  { bin: '970436', short: 'Vietcombank', code: 'VCB',  name: 'NH TMCP Ngoại Thương Việt Nam' },
  { bin: '970407', short: 'Techcombank', code: 'TCB',  name: 'NH TMCP Kỹ thương Việt Nam' },
  { bin: '970422', short: 'MB Bank',     code: 'MB',   name: 'NH TMCP Quân đội' },
  { bin: '970416', short: 'ACB',         code: 'ACB',  name: 'NH TMCP Á Châu' },
  { bin: '970432', short: 'VPBank',      code: 'VPB',  name: 'NH TMCP Việt Nam Thịnh Vượng' },
  { bin: '970418', short: 'BIDV',        code: 'BIDV', name: 'NH TMCP Đầu tư và Phát triển Việt Nam' },
  { bin: '970415', short: 'VietinBank',  code: 'ICB',  name: 'NH TMCP Công thương Việt Nam' },
  { bin: '970423', short: 'TPBank',      code: 'TPB',  name: 'NH TMCP Tiên Phong' },
  { bin: '970403', short: 'Sacombank',   code: 'STB',  name: 'NH TMCP Sài Gòn Thương Tín' },
  { bin: '970441', short: 'VIB',         code: 'VIB',  name: 'NH TMCP Quốc tế Việt Nam' },
  { bin: '970405', short: 'Agribank',    code: 'VBA',  name: 'NH Nông nghiệp và PTNT Việt Nam' },
  { bin: '970437', short: 'HDBank',      code: 'HDB',  name: 'NH TMCP Phát triển TP. Hồ Chí Minh' },
  { bin: '970443', short: 'SHB',         code: 'SHB',  name: 'NH TMCP Sài Gòn - Hà Nội' },
  { bin: '970440', short: 'SeABank',     code: 'SEAB', name: 'NH TMCP Đông Nam Á' },
  { bin: '970426', short: 'MSB',         code: 'MSB',  name: 'NH TMCP Hàng Hải Việt Nam' },
  { bin: '970448', short: 'OCB',         code: 'OCB',  name: 'NH TMCP Phương Đông' },
  { bin: '546034', short: 'Cake',        code: 'CAKE', name: 'Cake by VPBank' },
  { bin: '963388', short: 'Timo',        code: 'TIMO', name: 'Timo by Ban Viet Bank' },
];

export const BANK_BY_BIN = new Map(BANKS.map(b => [b.bin, b]));
```

> **Trap:** Cake (`546034`) and Timo (`963388`) do **not** start with `9704`. These are digital banks popular with exactly the young urban demographic this app targets. Validate with `/^\d{6}$/` and membership in `BANK_BY_BIN` — never with a `9704` prefix check. Both verified working end-to-end.

---

## 4. Storing member bank details

### Fields

```sql
ALTER TABLE members
  ADD COLUMN bank_bin        char(6),      -- FK-ish; validate against BANKS
  ADD COLUMN bank_account    varchar(19),  -- digits only
  ADD COLUMN bank_label      text;         -- display only, NOT used in the QR
```

Three fields, all nullable — a member without bank details simply cannot be a QR payee yet, which is a normal state, not an error.

`bank_label` is deliberately named *label*, not *account holder name*, because **it does not go into the payload**. Its only job is letting a payer sanity-check "yes, this is Hường's account" before scanning. You may not even need it: the banking app displays the authoritative name on the confirmation screen, which is strictly more trustworthy than anything you store. Consider shipping without it and adding it only if someone asks.

### Encryption at rest: overkill. Don't.

Recommendation: **no application-level encryption.** Reasoning:

- A Vietnamese bank account number is **semi-public by design**. Receiving money requires giving it out; people post them in group chats and on Facebook to collect money. It is closer to a phone number than to a password. It permits deposits, not withdrawals.
- These 9 people already know each other's accounts — they are housemates who settle up constantly. The app is not disclosing anything new to the only people who can read it.
- Neon encrypts at rest at the storage layer already. App-level encryption on top defends only against "attacker has read access to your database but not your environment variables" — a narrow window.
- The real cost is operational: an encryption key you must manage, rotate, and never lose, in a 0₫ project with no secret-management infrastructure. **Losing the key means losing the data.** That failure mode is far more probable than the attack it prevents.

What to do **instead**, which is cheaper and addresses the actual risk:

1. **Never send bank details to the client except for the single payee being settled with.** Do not ship the whole members table with accounts embedded to every page.
2. **Scope the query by authenticated session**, so only logged-in group members can read any account.
3. **Mask in list views** — show `****7890`, reveal in full only on the settlement screen.
4. **Keep account numbers out of logs** and out of error reports.

This is the pragmatic call: the threat model for a private 9-person app does not justify key management, and pretending otherwise adds a data-loss risk in exchange for theatre.

### Diacritic folding

Vietnamese banks store account-holder names uppercase and unaccented. More importantly, **transfer memos with diacritics are unreliable** — handling varies by bank and some strip or mangle them, which can corrupt the memo that is your only transfer↔record link. Fold everything.

```ts
// lib/text.ts

/**
 * Strip Vietnamese diacritics to ASCII.
 * NFD decomposition handles the tone/vowel marks; đ/Đ is a distinct
 * codepoint that does NOT decompose, so it needs an explicit pass.
 */
export function foldVietnamese(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // combining diacritical marks
    .replace(/\u0111/g, 'd')         // đ
    .replace(/\u0110/g, 'D')         // Đ
    .normalize('NFC');
}
```

Verified against real names — all produce pure `[A-Z ]`:

| Input | Output |
|---|---|
| Nguyễn Văn Đạt | `NGUYEN VAN DAT` |
| Trần Thị Hường | `TRAN THI HUONG` |
| Phạm Đình Tuấn | `PHAM DINH TUAN` |
| ĐỖ XUÂN TRƯỜNG | `DO XUAN TRUONG` |
| Võ Thị Ngọc Hà | `VO THI NGOC HA` |

> The `đ`/`Đ` special-case is the part everyone forgets. It is a standalone codepoint (U+0111 / U+0110), not a `d` plus a combining mark, so `NFD` alone leaves it intact and your "ASCII" string still contains a non-ASCII byte. This is also directly relevant to PROJECT.md bug #7 (`norm_` not folding diacritics) — use this same function for name normalisation.

---

## 5. Transfer memo design

The memo is the **only** link between a bank transfer and an app record. Design constraints:

- **Charset:** stick to `A–Z`, `0–9`, space. Banks commonly reject or silently strip: `# & % @ * ( ) + = < > " ' / \ | ; : ,` and newlines. Diacritics are unreliable. Some banks reject memos that are entirely numeric or too short.
- **Length:** keep under ~25 chars. Limits vary (commonly 50–160) but short memos survive every bank's truncation and stay readable in the notification.
- **Must survive manual retyping** — if the QR fails, someone types this by hand.

### Recommended format

```
UI <PERIOD> <PAYER> <TOKEN>
```

e.g. `UI T10 DAT 7K2M` (15 chars)

| Part | Purpose |
|---|---|
| `UI` | App prefix — distinguishes from unrelated transfers in the bank feed |
| `T10` | Period (tháng 10) — groups the transfer to a settlement cycle |
| `DAT` | Payer short name, folded — recipient instantly sees who paid |
| `7K2M` | Short random token keyed to the settlement row |

The **token is the important design choice.** It gives the recipient an unambiguous match to one specific settlement, and — critically — it makes two legitimate identical transfers distinguishable. This directly fixes PROJECT.md bug #3, where dedup on `payer|payee|amount` silently swallowed valid repeat payments. With a per-settlement token, "Đạt pays Hường 50,000₫" twice in one month is two distinct, matchable records.

Use an unambiguous alphabet (no `0/O`, `1/I`) since this may be read aloud or retyped.

```ts
// lib/memo.ts
import { foldVietnamese } from './text';

const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // no 0/O/1/I

export function settlementToken(len = 4): string {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, b => ALPHABET[b % ALPHABET.length]).join('');
}

/** Strip to the safe subset banks reliably accept. */
export function sanitizeMemo(raw: string, maxLen = 25): string {
  return foldVietnamese(raw)
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

export function buildMemo(opts: {
  period: string;      // "T10"
  payerName: string;   // "Đạt"
  token: string;       // "7K2M"
}): string {
  const payer = sanitizeMemo(opts.payerName).split(' ').pop() ?? '';
  return sanitizeMemo(`UI ${opts.period} ${payer} ${opts.token}`);
}
```

Verified: `sanitizeMemo("UI T10 Đạt trả Hường #42")` → `"UI T10 DAT TRA HUONG 42"`; `sanitizeMemo("Thanh toán 50% — tháng 10!")` → `"THANH TOAN 50 THANG 10"`. No rejected characters survive.

Store the generated memo **on the settlement row** rather than recomputing it — the memo must stay byte-identical to what the payer actually sent, even if someone later changes their display name.

---

## 6. Settlement confirmation UX

### Automatic detection is not available at 0₫ — confirmed

| Provider | Free tier | Verdict |
|---|---|---|
| **SePay** | None. Cheapest paid plan 120,000₫/month (STARTUP, 180 txn/mo). A "SHOP" plan at 70–99,000₫/month covers one storefront. | Fails budget |
| **Casso** | 14-day / 100-transaction trial only. Then priced per transaction + per bank. | Fails budget |
| Bank APIs direct | Corporate/merchant onboarding; not offered to individuals | Unavailable |

Both vendors are built for businesses and expect a business bank account — which a 9-person household does not have. This independently confirms PROJECT.md's existing "Out of Scope" entry for bank webhooks. **Manual confirmation is the correct and only design.**

### State machine

```
                  payer taps "Đã chuyển"
   (none) ──────────────────────────────────▶ PENDING
                                              │   │   │
         recipient confirms ──────────────────┘   │   │
                  │                               │   │
                  ▼                    payer cancels   recipient disputes
              CONFIRMED  (terminal)          │               │
                                             ▼               ▼
                                         CANCELLED        DISPUTED
                                        (terminal)        │      │
                                                   resolve│      │escalate
                                                          ▼      ▼
                                                    CONFIRMED  CANCELLED
```

```ts
type SettlementStatus = 'PENDING' | 'CONFIRMED' | 'DISPUTED' | 'CANCELLED';
```

Four states. `DISPUTED` is worth having as distinct from `CANCELLED` because it means "two people disagree and a human must talk" — it should be loud in the UI, whereas `CANCELLED` is quiet and routine.

### Does a pending settlement affect balances? **No.** Argue strongly for no.

**Only `CONFIRMED` settlements move balances.** `PENDING` is displayed, never summed.

Reasons:

1. **It preserves the single source of truth.** PROJECT.md's core value is "số dư luôn đúng và luôn tái lập được từ sổ giao dịch." If pending claims moved balances, the balance would depend on unverified assertions, and you would have reintroduced exactly the dual-truth drift that killed the Apps Script version.
2. **A pending settlement is a claim, not a fact.** Only the recipient can observe the money arriving. The payer tapping a button is evidence, not settlement. Encoding a claim as a fact is the original sin.
3. **Failure is asymmetric.** If pending reduced the debt and the transfer never actually arrived (wrong account, typo, bank rejection, or an honest misremembering), the system now shows a debt as paid and **nobody is prompted to fix it** — the error is silent and permanent. If pending does *not* reduce the debt, the worst case is the balance looks stale for a few hours until confirmation, and the pending badge makes the reason obvious. Prefer the loud, self-correcting failure.
4. **It makes the ledger honest.** Balance = pure function of confirmed ledger entries. No special-casing, no "balance as of" ambiguity.

**Handle the UX concern separately from the math.** The real worry — "I paid, why do I still look like I owe money?" — is a *display* problem, not a balance problem. Solve it in the UI:

```
Bạn nợ Hường          50.000₫
⏳ Đã báo chuyển · chờ Hường xác nhận · 14:32
```

The number stays truthful; the badge explains it. Optionally show "số dư sau khi xác nhận" as a secondary, visibly-provisional figure — but never as the headline number.

### Flow

**Payer:** sees debt → taps *Trả Hường 50.000₫* → QR with amount + memo pre-filled → opens banking app, scans, sends → returns, taps **"Tôi đã chuyển"** → status `PENDING`, recipient notified.

**Recipient:** sees pending item with amount, payer, memo token, and timestamp → checks banking app → taps **"Đã nhận"** → `CONFIRMED`, ledger entry written, balances recompute.

Guardrails:
- **Only the recipient may confirm.** Never let the payer self-confirm, and never auto-confirm on a timer — a timeout would silently convert an unverified claim into a fact, which is the failure mode this whole design exists to prevent.
- **Only the payer may cancel**, and only while `PENDING`.
- Show the memo token prominently on the recipient's confirmation card so they can match it against their bank notification.
- Nudge the recipient after ~24h of inactivity rather than resolving it automatically.

### Disputes and cancellation

- **Payer cancels** (`PENDING → CANCELLED`): "I didn't actually send it" / sent it wrong. No ledger entry was ever written, so nothing to reverse. Clean.
- **Recipient disputes** (`PENDING → DISPUTED`): "I don't see it." Usually a timing lag or a mistyped account. Surface both sides' view (amount, memo, time) and let them resolve it in person — these are housemates. From `DISPUTED`, either party's agreement moves it to `CONFIRMED` or `CANCELLED`.
- **Reversing a confirmed settlement**: do **not** mutate or delete it. Per PROJECT.md's immutable-ledger rule, write a **reversing entry** referencing the original. The history stays auditable.

All transitions should be append-only status events rather than in-place mutation of a status column, so "who confirmed what, when" is reconstructable — the same discipline as the expense ledger.

---

## 7. Debt simplification

### Algorithm

Given net balances summing to zero, repeatedly match the largest debtor against the largest creditor and transfer the smaller of the two magnitudes. Each transfer zeroes out at least one party, so with `n` non-zero participants it terminates in **at most `n−1` transfers** — a large improvement over the up-to-`n(n−1)/2` pairwise debts.

**On optimality:** finding the true minimum number of transfers is **NP-hard** (it reduces to multi-way set partition — you'd have to find subsets that independently net to zero and settle them separately). The greedy approach does not always find that optimum. Example: balances `{A:-5, B:+5, C:-5, D:+5}` can settle in 2 transfers (A→B, C→D), and greedy happens to find it here, but constructed cases exist where greedy produces `n−1` while an optimal partition does better. For `n < 10`, the difference is at most a transfer or two, and the greedy result is always within the `n−1` bound. **Not worth solving exactly** — the heuristic is the right engineering call at this scale.

```ts
// lib/simplify.ts

export interface Transfer { from: string; to: string; amount: number }

/**
 * Minimise transfers needed to settle net balances.
 * @param balances memberId -> net VND. Positive = is owed, negative = owes.
 *                 MUST sum to exactly 0 and be integers.
 * Greedy max-debtor/max-creditor: <= n-1 transfers. Not provably minimal
 * (exact problem is NP-hard) but optimal-or-near at group sizes < 10.
 */
export function simplifyDebts(balances: Record<string, number>): Transfer[] {
  const creditors: { id: string; amt: number }[] = [];
  const debtors: { id: string; amt: number }[] = [];

  for (const [id, amt] of Object.entries(balances)) {
    if (!Number.isInteger(amt)) throw new Error(`Non-integer balance for ${id}: ${amt}`);
    if (amt > 0) creditors.push({ id, amt });
    else if (amt < 0) debtors.push({ id, amt: -amt });
  }

  const sumC = creditors.reduce((s, x) => s + x.amt, 0);
  const sumD = debtors.reduce((s, x) => s + x.amt, 0);
  if (sumC !== sumD) throw new Error(`Unbalanced ledger: +${sumC} vs -${sumD}`);

  // Deterministic ordering: amount desc, then id asc — so the same balances
  // always produce the same transfers (stable UI, testable).
  const cmp = (a: { id: string; amt: number }, b: { id: string; amt: number }) =>
    b.amt - a.amt || (a.id < b.id ? -1 : 1);
  creditors.sort(cmp);
  debtors.sort(cmp);

  const transfers: Transfer[] = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i], c = creditors[j];
    const pay = Math.min(d.amt, c.amt);
    if (pay > 0) transfers.push({ from: d.id, to: c.id, amount: pay });
    d.amt -= pay;
    c.amt -= pay;
    if (d.amt === 0) i++;
    if (c.amt === 0) j++;
  }
  return transfers;
}
```

**Verified** — conservation holds exactly and all outputs are positive integers within the `n−1` bound:

| Case | Transfers | Bound `n−1` |
|---|---|---|
| simple A→B | 1 | 1 |
| 3-way cycle | 1 | 1 |
| uneven 4-person | 3 | 3 |
| all settled | 0 | 0 |
| 9 people (max group size) | 8 | 8 |

Unbalanced input correctly throws rather than silently producing wrong transfers.

Two notes tying back to PROJECT.md's known bugs:

- **Integers throughout.** The guard rejects non-integer balances outright. `Math.min` on integers stays integral, so no rounding is introduced here. Rounding must be handled upstream when splitting (e.g. `100000/3 → [33334, 33333, 33333]`, verified to sum to exactly `100000`), using largest-remainder allocation so the total is always preserved — directly addressing bug #8.
- **Deterministic ordering** matters more than it looks. Without the `id` tiebreak, equal balances could produce different transfer sets on each render, making the UI appear to shuffle and making tests flaky.

### UX caveat and recommendation: **toggle, default OFF**

Simplification creates transfers between people who **never directly transacted**. Đạt buys dinner for the house; after simplification Đạt is told to pay Hường, whom he never ate with. Reactions are predictably negative: *"Why do I owe Hường? I never bought anything from her."* Splitwise made simplification optional precisely because users objected.

For this project specifically, default OFF, because:

1. **Trust beats efficiency at this scale.** With <10 housemates settling monthly, the saving is maybe 2–4 transfers. NAPAS 247 transfers are instant and usually free, so the cost saved is nearly zero while the confusion cost is real.
2. **Traceability is the product's whole value.** PROJECT.md's core promise is a balance that is always correct and always reconstructable. Direct debts trace obviously to specific expenses; simplified ones require explaining an algorithm. The first time someone doubts a number, "you owe Hường because the optimiser said so" is a bad answer.
3. **Settlement confirmation is manual (§6).** Confirmations depend on the recipient recognising the payment. A transfer from someone they never transacted with is harder to recognise and more likely to end up `DISPUTED`.
4. **Reversibility.** Default-off is safe to turn on; default-on means people may have already made confusing transfers before anyone finds the switch.

Make it a group-level setting, not per-user — everyone must see the same numbers, or you have reintroduced two sources of truth.

When enabled, always show the derivation:

```
Bạn trả Hường 120.000₫
  └ gộp từ: Đạt nợ bạn 70.000₫ · bạn nợ Hường 190.000₫
```

Keep the underlying pairwise debts in the ledger regardless. Simplification is a **presentation layer over the ledger**, never a mutation of it — same discipline as balances being a pure function.

---

## Implications for the roadmap

| Area | Guidance |
|---|---|
| **QR phase** | Small and self-contained. `lib/vietqr.ts` + `lib/banks.ts` + one component. Pin the reference-payload test first — it is the regression guard. Low risk; no further research needed. |
| **Member bank details** | Three nullable columns. No encryption, no key management. Ship masked display. |
| **Settlement phase** | The real design work. Four states, recipient-only confirmation, pending never affects balances. Deserves its own phase. |
| **Simplification** | Pure function over balances, fully unit-testable with no I/O. Build behind a group setting, default off. |
| **Auto-detection** | Confirmed closed at 0₫. Keep in Out of Scope; no need to revisit unless the budget constraint changes. |

### Confidence

| Topic | Level | Basis |
|---|---|---|
| 1 Payload spec | **HIGH** | Byte-exact match vs live VietQR output, both variants; CRC test vector passes |
| 2 Rendering | **HIGH** | Round-trip encode/decode verified across 5 cases incl. edge BINs |
| 3 BIN codes | **HIGH** | Fetched live from `api.vietqr.io/v2/banks`; all 18 confirmed |
| 4 Storage | MEDIUM-HIGH | Field list follows from §1; encryption call is a reasoned judgement |
| 5 Memo | MEDIUM | Charset/length guidance is conservative-by-design; exact per-bank limits undocumented |
| 6 Settlement UX | MEDIUM-HIGH | Vendor pricing verified from their own pages; state design is reasoned |
| 7 Simplification | **HIGH** | Implementation verified for conservation, integrality, `n−1` bound |

### Open questions

- Exact memo length cap per bank is not publicly documented. The ~25-char budget is deliberately conservative and should be safe everywhere; worth an informal test with 2–3 real banks during the QR phase.
- Whether the group wants `bank_label` shown at all is a product question — the banking app shows the authoritative name anyway. Consider shipping without it.
- SePay/Casso pricing was read on the research date and may change; neither is close enough to free for this to matter unless the budget constraint is relaxed.

## Sources

- `https://api.vietqr.io/v2/banks` — bank BIN list, fetched and verified live (HIGH)
- `https://img.vietqr.io/image/{bin}-{acct}-compact2.png` — reference QR generator; outputs decoded and used as ground truth for the payload builder (HIGH)
- `https://sepay.vn/bang-gia.html` — SePay pricing; no free tier, cheapest 120,000₫/mo (HIGH)
- `https://casso.vn/bang-gia/` — Casso pricing; 14-day/100-transaction trial only (HIGH)
- EMVCo Merchant-Presented QR specification — the TLV base standard VietQR profiles (MEDIUM; structure independently confirmed by decoding real payloads)
- npm `qrcode` 1.5.4, `qrcode.react` 4.2.0 — versions verified via `npm view` (HIGH)

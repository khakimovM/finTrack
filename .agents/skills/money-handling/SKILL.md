---
name: money-handling
description: Correct handling of money amounts in FinTrack — BigInt tiyin storage, JSON string transport, conversion and formatting for Uzbek som. Use whenever writing code that reads, stores, computes, serializes, or displays an amount.
---

# Money in FinTrack

## The invariant
Money is an **integer count of tiyin** (1 UZS = 100 tiyin), held as `BigInt`.
Floating point is banned: `0.1 + 0.2 !== 0.3`, and a rounding error in a finance app is a
data-corruption bug, not a cosmetic one.

| Layer | Type | Example |
|---|---|---|
| PostgreSQL | `BIGINT` | `150050` |
| Prisma | `BigInt` | `150050n` |
| JSON / HTTP | `string` | `"150050"` |
| React state | `string` (tiyin) or `bigint` | `"150050"` |
| Rendered UI | formatted `string` | `1 500,50 so'm` |

## Serialization
Registered once, in `apps/api/src/main.ts`:

```ts
// BigInt has no JSON representation; emit it as a string.
(BigInt.prototype as unknown as { toJSON(): string }).toJSON = function () {
  return this.toString();
};
```
Entity mappers still convert explicitly so the DTO types are honest (`amount: string`).

## The only implementation — `packages/shared/src/money.ts`

```ts
export const TIYIN_PER_SOM = 100n;

export function somToTiyin(som: string | number): bigint {
  const normalized = String(som).replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) throw new InvalidAmountError(som);
  const [whole, frac = ''] = normalized.split('.');
  return BigInt(whole) * TIYIN_PER_SOM + BigInt(frac.padEnd(2, '0'));
}

export function tiyinToSom(tiyin: bigint | string): string {
  const value = BigInt(tiyin);
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const whole = abs / TIYIN_PER_SOM;
  const frac = (abs % TIYIN_PER_SOM).toString().padStart(2, '0');
  return `${negative ? '-' : ''}${whole}.${frac}`;
}

export function formatMoney(tiyin: bigint | string, opts?: { currency?: string }): string {
  // 150050n -> "1 500,50 so'm"  (non-breaking space groups, comma decimal)
}
```

Nothing else in the codebase may implement money arithmetic or formatting.

## Rules
- Never `parseFloat` an amount. Never `Number(amount)` for arithmetic.
- Never build a total in JavaScript when SQL can `SUM` it.
- Percentages (`spentPercent`, budget usage) are the only place a float is allowed, and only
  for display — compute as `Number((a * 10000n) / b) / 100`.
- Input fields collect som and convert at submit time, not on every keystroke.
- Never compare a formatted string; compare `BigInt`s.
- Negative display: minus sign **and** a colour **and** an icon. Colour alone is not enough.

## Test cases that must pass
`0`, `1` tiyin, `99` tiyin, exactly `100`, a value above `Number.MAX_SAFE_INTEGER`,
negative balances, `somToTiyin(tiyinToSom(x)) === x` for random `x`.

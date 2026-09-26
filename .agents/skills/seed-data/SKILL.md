---
name: seed-data
description: Generate realistic FinTrack demo data — a test user with accounts, categories, three months of transactions, budgets, and debts — so charts and filters can actually be exercised. Use when setting up the database, after a schema change, or when a view needs data to review.
---

# FinTrack seed data

## Why it matters
An empty dashboard hides every aggregation bug. Charts, period filters, pagination, and
budget thresholds cannot be reviewed without a few months of plausible data.

## What `pnpm db:seed` must produce

**Test user**
`aziz@fintrack.uz` / `Parol123!`, `strictMode: false`, base currency `UZS`.

**Accounts** — Naqd pul, Humo karta, UzCard, Jamg'arma (with differing opening balances).

**Categories** — 10 system defaults per user:
Oziq-ovqat 🍔, Transport 🚗, Uy-joy 🏠, Kommunal 💡, Kiyim 👕, Sog'liq 🏥,
Ko'ngilochar 🎬, Ta'lim 📚 (expense); Oylik 💼, Qo'shimcha daromad 💵 (income).
Plus two sub-categories to exercise the parent/child tree (e.g. Transport → Taksi, Yoqilg'i).

**Transactions** — 90 days, roughly 250 rows:
- salary on the 5th and 20th of each month (same amount, `INCOME`)
- 2–5 expenses per day, weighted realistically (food most frequent, rent once a month)
- larger spending on weekends
- at least one month deliberately over-spent, so the negative/over-budget UI is visible
- 3–4 transfers between accounts
- a handful of days with no transactions at all — this is what proves the zero-fill works

**Debts** — 5 rows covering every state:
active and not yet due, active and overdue, partially paid, fully paid,
one `I_BORROWED` and the rest `I_LENT`. Each with its ledger rows.

**Budgets** — 4 categories for the current month: one under 50%, one near 80%,
one over 100%, one untouched.

**Recurring rules** — 2 (rent monthly, internet monthly), with `nextRunAt` in the near future.

## Implementation rules
- Deterministic: seed the RNG with a fixed value so runs are reproducible.
- Idempotent: `upsert` by email; re-running must not duplicate.
- Use the same service-layer logic as the app where practical, so seeded data obeys the
  same invariants (ledger rows for debts, correct signs, atomic writes).
- Amounts in tiyin, realistic for Tashkent (a lunch ≈ 3 500 000 tiyin = 35 000 so'm).
- Print a summary when finished: counts per entity plus the resulting balance.

## Verify after seeding
- Dashboard shows non-empty charts for daily, monthly, and yearly period filters
- At least one overdue debt badge is visible
- One budget shows the over-100% state
- Total balance equals the sum of account balances

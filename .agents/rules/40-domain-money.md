# Domain rules — money, ledger, debts

This is the heart of the product. Read it fully.

## 1. Representation
- Storage and transport: **integer tiyin** as `BigInt` (DB) / `string` (JSON).
  `1 500,50 UZS` → `150050`.
- Arithmetic uses `BigInt` only. `Number` loses precision above 2^53 and rounds badly below it.
- `packages/shared/src/money.ts` owns `somToTiyin`, `tiyinToSom`, `formatMoney`, `addMoney`,
  `subMoney`. Nothing else may implement money maths.

## 2. The ledger
`Transaction` is an append-oriented ledger and the only source of truth for balance.

| type | Sign | In income/expense stats? | Meaning |
|---|---|---|---|
| `INCOME` | + | yes (income) | salary, side income |
| `EXPENSE` | − | yes (expense) | spending |
| `TRANSFER_IN` | + | no | arrives in another own account |
| `TRANSFER_OUT` | − | no | leaves an own account |
| `LOAN_GIVEN` | − | no | I lent money out |
| `LOAN_TAKEN` | + | no | I borrowed money |
| `LOAN_REPAY_IN` | + | no | a debtor repaid me |
| `LOAN_REPAY_OUT` | − | no | I repaid my debt |
| `ADJUSTMENT` | ± | no | manual balance correction |

**Balance** = `SUM(+ types) − SUM(− types)` over non-deleted rows, per account and in total.
It is computed, cached in Redis under `balance:{userId}`, and invalidated on every write.

**Statistics** (`/stats/*`, all charts) filter to `type IN ('INCOME','EXPENSE')`.
A loan appearing in the expense pie chart is a bug.

## 3. Transfers between own accounts
One user action → two ledger rows sharing a `transferGroupId`:
`TRANSFER_OUT` on the source, `TRANSFER_IN` on the destination, equal amounts, one
`prisma.$transaction`. Total balance is unchanged; deleting one row must delete both.

## 4. Debts
- `Debt.direction`: `I_LENT` (they owe me) or `I_BORROWED` (I owe them).
- Creating a debt writes the `Debt` row **and** its ledger row atomically
  (`I_LENT` → `LOAN_GIVEN`, `I_BORROWED` → `LOAN_TAKEN`).
- Partial repayment: a `DebtPayment` row + a ledger row (`LOAN_REPAY_IN` / `LOAN_REPAY_OUT`),
  atomically.
- `remainingAmount = Debt.amount − SUM(DebtPayment.amount)`; when it reaches zero the status
  becomes `PAID` and `paidAt` is set — in the same transaction.
- A payment may never exceed `remainingAmount` → `DEBT_OVERPAYMENT` (422).
- `isOverdue` is **computed at read time** (`status = ACTIVE AND dueDate < today`), never stored.
- Deleting a debt cascades to its ledger rows so the balance self-heals.

## 5. Strict mode
`User.strictMode` (default `false`).
- `false`: an outgoing operation may push the balance negative. The API succeeds; the UI shows
  the negative balance in red with a warning.
- `true`: any operation that would make the **account** balance negative is rejected with
  `422 INSUFFICIENT_BALANCE`, including the current balance and requested amount in `details`.

The check lives in exactly one place: `BalanceGuardService.assertSufficient()`. Every
outgoing operation (expense, transfer out, loan given, loan repay out) calls it. Do not
copy the condition into individual services.

## 6. Budgets
- A `Budget` caps one category for one month: `(userId, categoryId, month)` is unique.
- `spent` = sum of `EXPENSE` in that category and month. Usage crossing 80% and 100%
  raises a `Notification` (once per threshold per month — enforce idempotency).
- A budget never blocks a transaction. Only `strictMode` blocks.

## 7. Recurring transactions
- `RecurringRule` describes the template plus `frequency`, `nextRunAt`, `endsAt`.
- A BullMQ repeatable job materialises due rules into real `Transaction` rows once a day.
- Generation must be **idempotent**: a unique `(recurringRuleId, date)` prevents duplicates
  when the worker retries.

## 8. Multi-currency (Phase 8 — do not build earlier)
Each `Account` has a `currency`. A transaction stores `amount` in the account currency and
`amountBase` in the user's base currency, converted with the `ExchangeRate` of that date and
frozen. Historical rows are never retro-converted. Stats always use `amountBase`.

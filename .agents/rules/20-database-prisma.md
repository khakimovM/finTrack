# Database rules — Prisma & PostgreSQL

## Schema
- `apps/api/prisma/schema.prisma` is the single source of truth for the data model.
- Every model that belongs to a user has `userId` + an index that starts with `userId`.
- Money columns: `BigInt`. Dates without a time component: `DateTime @db.Date`.
  Timestamps: `DateTime @default(now())`.
- Soft delete via `deletedAt DateTime?` on `Transaction`, `Account`, `Category`.
  Every read filters `deletedAt: null`.
- `@@map` to snake_case table names; `@map` for snake_case columns.

## Migrations
- Never edit an applied migration. Create a new one.
- Never run `prisma migrate reset` or `prisma db push` against a database with data
  without explicit approval from the user.
- Every migration must be reversible in principle: if you drop a column, say so in the
  report and get approval first.
- After changing the schema: `pnpm db:migrate` → `pnpm prisma generate` → run tests.

## Query rules
- Every query includes `userId` in the `where`. No exceptions.
- Never `findUnique({ where: { id } })` for a user-owned row — use
  `findFirst({ where: { id, userId, deletedAt: null } })`.
- Select explicitly. Avoid returning `passwordHash` or token hashes by accident;
  use a `select` object or an `omit`.
- N+1 is a bug: use `include`/`select` or a single aggregate query.
- Aggregations happen in SQL (`GROUP BY`, `date_trunc`, `FILTER`), never by loading rows
  into Node and reducing them.

## Indexes to keep
`(userId, date)`, `(userId, type)`, `(userId, status)`, `(accountId, date)`,
`(categoryId)`. Add an index when you add a new filter; note it in your report.

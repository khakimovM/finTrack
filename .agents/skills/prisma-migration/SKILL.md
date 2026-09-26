---
name: prisma-migration
description: Safely change the FinTrack database schema — add models or columns, write and apply Prisma migrations, backfill data, and keep indexes correct. Use before any edit to schema.prisma or when a migration fails or drifts.
---

# Changing the FinTrack schema

## Non-negotiable
- Never edit a migration that has already been applied. Add a new one.
- Never run `prisma migrate reset`, `db push`, or anything that drops data without
  explicit approval from the user, in writing, in this session.
- Every user-owned model needs `userId` and an index beginning with `userId`.

## Procedure
1. Read `apps/api/prisma/schema.prisma` and `docs/03-DATA-MODEL.md` first.
2. Edit the schema. Follow the conventions:
   - money → `BigInt`
   - calendar date → `DateTime @db.Date`
   - timestamps → `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt`
   - soft delete → `deletedAt DateTime?`
   - `@@map("snake_case_table")`, `@map("snake_case_column")`
3. Create the migration with a descriptive name:
   `pnpm --filter api exec prisma migrate dev --name add_budget_thresholds`
4. Read the generated SQL in `prisma/migrations/*/migration.sql`. If it contains
   `DROP COLUMN`, `DROP TABLE`, or a non-nullable column added without a default —
   **stop and ask the user**.
5. `pnpm --filter api exec prisma generate`
6. Update the seed script if the new field needs data.
7. Run `pnpm verify`.

## Adding a required column to a populated table
Do it in three steps, never one:
1. Add it nullable, migrate.
2. Backfill with a script in `prisma/scripts/`.
3. Make it required, migrate again.

## Adding a new filter
Every new `where` filter needs a matching index. Composite indexes go
`(userId, <filter>, <sort>)` in that order.

## When the migration fails
- "drift detected" → the DB was changed outside Prisma. Report it, do not reset.
- "shadow database" error → check `DATABASE_URL` and that Postgres is running (`pnpm db:up`).
- Report the exact error text; do not retry blindly more than twice.

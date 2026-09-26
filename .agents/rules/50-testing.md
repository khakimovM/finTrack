# Testing rules

## What must be tested
Business logic is not optional to test. Minimum coverage before a phase is "done":

| Area | Test type | Must cover |
|---|---|---|
| Balance calculation | unit | all 9 transaction types, empty ledger, soft-deleted rows |
| Strict mode | unit + e2e | allowed on/off, exact 422 code and payload |
| Debt lifecycle | unit + e2e | create → partial pay → full pay → status flip; overpayment rejected |
| Transfers | e2e | both rows created, total balance unchanged, cascade delete |
| Stats aggregation | unit | day/month/year bucketing, empty buckets zero-filled, loans excluded |
| Ownership isolation | e2e | user A gets 404 (not 403) on user B's row, for every resource |
| Auth | e2e | register, login, refresh rotation, reuse of a rotated token is rejected |
| Money utils | unit | rounding, formatting, tiyin↔som round trip |

## How
- API unit tests: Jest, mock the repository, never the service under test.
- API e2e: Supertest against a real Postgres in Docker, migrated and seeded per suite,
  truncated between tests. No mocked database in e2e.
- Web: Vitest + Testing Library. Test behaviour through the DOM, not implementation details.
  Mock the network with MSW, not by stubbing hooks.
- Critical flows in Playwright: register → add income → add expense → see updated chart →
  create debt → settle it.

## Rules
- A bug fix starts with a failing test that reproduces it.
- Tests must be independent and order-agnostic. No shared mutable state between tests.
- No snapshot tests for anything with money or dates in it.
- Never delete or weaken an assertion to make a suite green.

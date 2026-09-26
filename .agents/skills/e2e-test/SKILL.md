---
name: e2e-test
description: Write API e2e tests (Jest + Supertest against real Postgres) and browser e2e tests (Playwright) for FinTrack, including auth setup, DB isolation, and the ownership-isolation checks required for every resource. Use when adding tests for a finished feature or reproducing a reported bug.
---

# FinTrack end-to-end tests

## API e2e — Jest + Supertest
Real Postgres in Docker. Never mock Prisma in e2e.

```
apps/api/test/
├── setup/app.ts          # builds the Nest app with the real DB
├── setup/db.ts           # truncate between tests
├── setup/auth.ts         # registerAndLogin() -> { agent, user }
└── <feature>.e2e-spec.ts
```

Rules:
- Truncate all tables between tests; never rely on execution order.
- Build state through the API, not by inserting rows directly — that is what you are testing.
- Assert the **whole documented envelope**: `success`, `data` shape, `meta` on lists,
  and the exact `error.code` on failures.

## The ownership test — required for every resource
```ts
it('does not leak another user\'s row', async () => {
  const alice = await registerAndLogin(app);
  const bob   = await registerAndLogin(app);
  const { body } = await alice.agent.post('/api/v1/transactions').send(validPayload).expect(201);

  await bob.agent.get(`/api/v1/transactions/${body.data.id}`).expect(404); // 404, not 403
  await bob.agent.patch(`/api/v1/transactions/${body.data.id}`).send({ note: 'x' }).expect(404);
  await bob.agent.delete(`/api/v1/transactions/${body.data.id}`).expect(404);
});
```

## Money-critical scenarios that must exist
1. Balance after each of the nine transaction types.
2. `strictMode: true` rejects an over-balance expense with `422 INSUFFICIENT_BALANCE` and
   the transaction is **not** persisted.
3. `strictMode: false` allows it and the balance goes negative.
4. Debt: create → partial payment → remaining amount correct → final payment → `PAID`.
5. Overpaying a debt returns `422 DEBT_OVERPAYMENT` and changes nothing.
6. Transfer creates exactly two rows, total balance unchanged; deleting cascades.
7. Loans never appear in `/stats/by-category`.
8. Refresh-token rotation: the old token is rejected after use.

## Browser e2e — Playwright
`apps/web/e2e/`. One storage-state fixture per role; do not log in through the UI in every test.

Critical path to keep green:
register → create account → add income → add expense → dashboard KPIs and chart update →
create a debt → record a partial payment → see the remaining amount → log out and back in.

Selectors: `getByRole` / `getByLabel`. Never CSS classes or `nth-child`.
Assert on user-visible text (`1 500,50 so'm`), not internal values.

## Rules
- A bug fix begins with a failing test that reproduces it.
- No `test.skip` left in the tree. No arbitrary `waitForTimeout` — wait for a condition.

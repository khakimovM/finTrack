---
description: Add a new API endpoint end to end, matching the documented contract.
---

# /new-endpoint

Ask for the resource and operation if not provided.

1. Find the endpoint in `docs/04-API-CONTRACT.md`. If it is not documented, write the
   contract entry first (path, auth, query/body, success payload, error codes) and confirm
   it with the user before writing code.
2. Add or extend the Zod schemas in `packages/shared/src/schemas/`.
3. Repository method — `userId` first argument, `where` scoped to the owner.
4. Service method — business rules, `prisma.$transaction` if more than one write,
   `BalanceGuardService.assertSufficient()` if money leaves an account,
   cache invalidation if a balance changed.
5. Controller method — thin, with Swagger decorators.
6. Entity mapper — `BigInt` → string, computed fields.
7. Tests — a service unit test plus an e2e test including the ownership-isolation case.
8. Frontend — API client function, React Query hook, invalidation entries.
9. `pnpm verify`, then check `/api/docs` renders the new route correctly.

Report the final request and response shape as actually implemented.

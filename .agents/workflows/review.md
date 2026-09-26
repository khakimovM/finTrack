---
description: Review the current diff against the project rules before committing.
---

# /review

Review the working diff. For each finding give: file, line, severity, and the fix.

**Security**
- [ ] Every Prisma `where` includes `userId`
- [ ] Not-found on someone else's row returns 404, not 403
- [ ] No `userId` read from body or query
- [ ] No secret, token, or password in source, logs, or the diff
- [ ] New write endpoints validate with a `.strict()` Zod schema

**Money**
- [ ] No `Float`, `parseFloat`, or `Number()` arithmetic on amounts
- [ ] Money is `BigInt` in the service, `string` in the DTO
- [ ] Balance derived, never stored; cache invalidated on write
- [ ] Loans excluded from income/expense statistics
- [ ] Multi-write money operations inside `prisma.$transaction`

**Structure**
- [ ] No Prisma call outside a repository
- [ ] No business logic in a controller
- [ ] Server data not held in Zustand
- [ ] Query keys from the registry, invalidations complete

**Quality**
- [ ] No `any`, `@ts-ignore`, `eslint-disable`, `.skip`, or `.only`
- [ ] All four view states present in new data views
- [ ] Response shape matches `docs/04-API-CONTRACT.md`
- [ ] Tests cover the new business rule, including the failure path
- [ ] Files under ~300 lines

Verdict: **ship** / **fix first** (with the blocking list).

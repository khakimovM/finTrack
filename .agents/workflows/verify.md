---
description: Run the full verification suite and report honestly.
---

# /verify

Run each command and paste the real output. Do not summarise as "passing" without it.

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm --filter api exec prisma validate
pnpm --filter api exec prisma migrate status
```

Then check by hand:
- `pnpm dev` starts both apps without an error in either console
- `/api/docs` loads and lists every implemented route
- `/api/v1/health` returns `ok` with a DB and Redis check
- The dashboard renders with seeded data at every period preset

Report:
- **Green** — what passed
- **Red** — every failure with the exact error text
- **Untested** — anything you could not run and why

Never claim green on something you did not run.

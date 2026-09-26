# Git and workflow rules

## Branching
- `main` is always green. Never commit directly to it.
- One branch per roadmap phase or task: `feat/phase-3-transactions`, `fix/balance-cache`.

## Commits
- Conventional Commits: `type(scope): summary`.
  Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`.
  Scopes: `api`, `web`, `shared`, `db`, `ci`.
- One logical change per commit. A migration and the code that uses it belong together.
- Never commit generated files, `.env`, `node_modules`, or `dist`.
- Do not amend, rebase, force-push, or rewrite history without asking.

## Before opening a PR
1. `pnpm verify` passes locally.
2. The phase's acceptance criteria in `docs/06-ROADMAP.md` are all met.
3. The PR description lists: what changed, which endpoints, how it was verified,
   and anything deliberately left out.

## Reporting back to the user
End every task with:
- **Done** — what now works
- **Verified** — the exact commands run and their result
- **Not done / assumptions** — anything skipped, guessed, or needing a decision
- **Next** — the next roadmap item

Never end with a claim you did not verify.

# AGENTS.md — FinTrack

> Standing instructions for every agent working in this workspace.
> Read this file completely before your first action in a session.

## 1. What this project is

**FinTrack** is a multi-user personal finance platform. Every user signs up, gets an
isolated dashboard, and tracks income, expenses, accounts, budgets, and debts, with
charts over daily / monthly / yearly / custom periods.

This is a **production-grade** build, not a toy. Full feature set, full test coverage
on business logic, full validation, full error handling.

## 2. Stack (non-negotiable)

| Layer | Choice |
|---|---|
| Monorepo | npm workspaces + Turborepo |
| Backend | **NestJS 10** (TypeScript, strict), Fastify adapter |
| ORM / DB | **Prisma 5** + **PostgreSQL 16** |
| Cache / Queue | Redis + BullMQ |
| Validation | **Zod** via `nestjs-zod` (backend), `zod` + react-hook-form (frontend) |
| Auth | JWT access + refresh, `httpOnly` cookies, bcrypt, refresh-token rotation |
| Docs | Swagger / OpenAPI at `/api/docs` |
| Frontend | **React 18 + Vite + TypeScript** |
| Server state | **TanStack Query v5** |
| Client state | **Zustand** |
| Routing | React Router v6 (`createBrowserRouter`) |
| UI | Tailwind CSS + shadcn/ui + lucide-react |
| Charts | Recharts |
| Tests | Jest + Supertest (api), Vitest + Testing Library (web), Playwright (e2e) |

Do **not** introduce another library without asking. No Express, no Redux, no Moment.js,
no Bootstrap, no `any`.

## 3. Repository layout

```
fintrack/
├── apps/
│   ├── api/                 # NestJS backend
│   └── web/                 # React frontend
├── packages/
│   └── shared/              # Zod schemas, DTO types, money & date utils (used by BOTH)
├── docs/                    # Specification — the source of truth
└── .agents/                 # Rules, skills, workflows, custom agents, MCP config
```

Types and validation schemas that both sides need live in `packages/shared`.
Never duplicate a Zod schema between `api` and `web`.

## 4. Read the spec before building

| Question | File |
|---|---|
| What are we building and why? | `docs/01-PRD.md` |
| How is it structured? | `docs/02-ARCHITECTURE.md` |
| What does the DB look like? | `docs/03-DATA-MODEL.md` + `apps/api/prisma/schema.prisma` |
| What are the endpoints? | `docs/04-API-CONTRACT.md` |
| What do the screens do? | `docs/05-FRONTEND-SPEC.md` |
| What do I build next? | `docs/06-ROADMAP.md` ← **start here** |
| When is a task finished? | `docs/07-DEFINITION-OF-DONE.md` |

`docs/04-API-CONTRACT.md` is a **contract**. If your implementation would deviate from it,
stop and ask — do not silently change the shape of a response.

## 5. Domain invariants — memorise these

These five rules define the product. Breaking any of them is a critical bug.

1. **Money is `BigInt` in tiyin (1 UZS = 100 tiyin).** Never `Float`, never `Number` for
   storage or arithmetic. Serialize to JSON as a **string**. Conversion happens only at
   the UI edge.
2. **Balance is never stored.** It is always derived by summing the ledger
   (`SUM(signed amounts)`), optionally cached in Redis with explicit invalidation.
3. **Lending money is not an expense.** `LOAN_GIVEN` moves balance but must never appear
   in expense statistics. Only `INCOME` and `EXPENSE` feed the category/period charts.
4. **Every query is scoped to the owner.** Every `where` clause includes `userId`.
   A missing `userId` filter is a security incident, not a bug.
5. **Multi-step money operations are atomic.** Creating a debt, settling a debt,
   transferring between accounts, recording a debt payment — all inside
   `prisma.$transaction()`. Never two separate awaits.

Full explanation: `.agents/rules/40-domain-money.md`.

## 6. Commands

```bash
npm install                   # install everything
npm run db:up                 # docker compose up postgres + redis
npm run db:migrate            # prisma migrate dev
npm run db:seed               # demo user + 3 months of data
npm run db:studio             # prisma studio

npm run dev                   # api (:5000) + web (:5173) together
npm run dev:api
npm run dev:web

npm run lint                  # eslint, all packages
npm run typecheck             # tsc --noEmit, all packages
npm run test                  # unit tests
npm run test:e2e              # api e2e (Jest) + web e2e (Playwright)
npm run verify                # lint + typecheck + test  ← run before saying "done"
```

## 7. How to work

- **Plan first.** For anything larger than a one-file change, write the plan and the file
  list before editing. State which roadmap phase you are in.
- **One phase at a time.** Do not jump ahead in `docs/06-ROADMAP.md`. Each phase has
  acceptance criteria; meet them, run `npm run verify`, then stop and report.
- **Vertical slices.** A feature means: Prisma model → migration → service → controller →
  DTO/Zod schema in `shared` → API client → React Query hook → UI → tests. Not "all
  backend, then all frontend."
- **Never claim something works without running it.** Run the command, paste real output.
  If a test fails, fix it — do not weaken the assertion or add `.skip`.
- **Errors are not decorations.** Every failure path returns the documented error code
  from `docs/04-API-CONTRACT.md`.

## 8. Ask before you do these

- Changing `prisma/schema.prisma` in a way that drops or renames a column
- `prisma migrate reset`, or any destructive DB command
- Changing an endpoint's request/response shape
- Adding a runtime dependency
- Committing anything, force-pushing, or touching git history
- Writing real credentials anywhere (use `.env`, which is gitignored)

## 9. Style

- TypeScript `strict: true`. No `any`, no non-null `!` to silence the compiler.
- Code, identifiers, comments, commit messages: **English**.
- User-visible UI strings: **Uzbek** (see `apps/web/src/lib/i18n`).
- Conventional commits: `feat(api): add debt partial payments`.
- Files ≤ 300 lines. If a service grows past that, split it.
- Comments explain *why*, never *what*.

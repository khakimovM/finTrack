# 02 — Arxitektura

## Monorepo

```
fintrack/
├── apps/
│   ├── api/          NestJS backend
│   └── web/          React frontend
├── packages/
│   └── shared/       Zod sxemalar, DTO tiplar, pul va sana utilitalari
├── docs/             Spetsifikatsiya (haqiqat manbai)
└── .agents/          Antigravity qoidalari, skillari, workflowlari
```

`packages/shared` ikkala tomonda ishlatiladi. Bitta Zod sxema — bitta joyda. Backend uni
`createZodDto` bilan DTOga, frontend `zodResolver` bilan formaga aylantiradi.

## Backend qatlamlari

```
HTTP
 └─ Controller      req/res, Swagger, @CurrentUser
     └─ Service     biznes qoidalar, $transaction, kesh invalidatsiyasi
         └─ Repository   barcha Prisma so'rovlari, userId scoping
             └─ PostgreSQL
```

Yon xizmatlar:
- `BalanceGuardService` — qat'iy rejim tekshiruvi (yagona joy)
- `BalanceService` — ledgerdan balans + Redis kesh
- `StatsRepository` — `$queryRaw` agregatsiyalari
- `NotificationService` — byudjet/qarz hodisalari
- BullMQ workerlar — takrorlanuvchi tranzaksiyalar, muddati o'tgan qarz tekshiruvi

## Backend papka strukturasi

```
apps/api/src/
├── main.ts
├── app.module.ts
├── config/                  env.validation.ts, configuration.ts
├── common/
│   ├── decorators/          @CurrentUser, @Public
│   ├── filters/             AllExceptionsFilter
│   ├── interceptors/        TransformInterceptor, LoggingInterceptor
│   ├── guards/              JwtAuthGuard, ThrottlerGuard
│   ├── exceptions/          InsufficientBalanceException, DebtOverpaymentException...
│   └── pipes/               ZodValidationPipe
├── infra/
│   ├── prisma/              PrismaModule, PrismaService
│   ├── redis/               CacheModule
│   └── queue/               BullMQ konfiguratsiyasi
└── modules/
    ├── auth/  users/  accounts/  categories/  tags/
    ├── transactions/  transfers/  debts/  budgets/
    ├── recurring/  stats/  notifications/  export/  health/
```

## Frontend strukturasi

```
apps/web/src/
├── main.tsx                 QueryClientProvider > RouterProvider
├── routes/index.tsx         createBrowserRouter, ProtectedRoute
├── pages/                   sahifa kompozitsiyasi
├── features/<feature>/      api/, hooks/, components/
├── components/ui/           shadcn/ui primitivlari
├── components/layout/       RootLayout, Sidebar, Header
├── components/charts/       Recharts wrapperlari
├── store/                   authStore, uiStore, periodStore (Zustand)
├── lib/                     axios, queryKeys, apiError, i18n, money, date
└── styles/
```

## Ma'lumot oqimi

```
UI hodisasi
 → React Query mutatsiyasi
   → axios (httpOnly cookie bilan)
     → Nest controller → service → repository → Postgres
       ← javob konverti { success, data }
   ← onSuccess: invalidateQueries(['transactions','stats','accounts'])
 → bog'liq querylar qayta o'qiladi → UI yangilanadi
```

Balans hech qachon frontendda hisoblanmaydi. Grafik ma'lumoti hech qachon frontendda
`reduce` qilinmaydi.

## Autentifikatsiya oqimi

1. Login → access (15 daq) va refresh (7 kun) `httpOnly` cookie
2. Refresh token bazada **hashlangan** holda, `familyId` bilan saqlanadi
3. Har `POST /auth/refresh` da eski token bekor qilinadi, yangisi beriladi (rotatsiya)
4. Bekor qilingan token qayta ishlatilsa — butun oila bekor qilinadi, qayta login talab etiladi
5. Frontend Axios interceptori 401 da bir marta refresh qiladi, muvaffaqiyatsiz bo'lsa `/login`

## Infratuzilma

`docker-compose.yml`: PostgreSQL 16, Redis 7, Adminer.
CI (GitHub Actions): install → lint → typecheck → test → e2e (Postgres service container).
Deploy: API → Railway/Render (`prisma migrate deploy` alohida qadam), Web → Vercel.

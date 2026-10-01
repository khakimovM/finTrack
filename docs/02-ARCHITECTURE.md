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
│   ├── queue/               BullMQ konfiguratsiyasi
│   └── telegram/            grammY Bot (yagona nusxa), yuborish, fayl yuklab olish
├── bootstrap/               configure-app (helmet/CSP, CSRF, Swagger), serve-web (web build)
└── modules/
    ├── auth/  users/  accounts/  categories/  tags/
    ├── transactions/  transfers/  debts/  budgets/
    ├── recurring/  stats/  notifications/  export/  health/  jobs/
    ├── telegram/            bot handlerlari, qoralamalar, outbox, kunlik xulosa, webhook
    └── assistant/           ovoz/matn → yozuvlar (Gemini, Groq, Claude adapterlari)
```

Bot faqat domen servislarini chaqiradi (TransactionsService, DebtPaymentsService…), shuning uchun
qat'iy rejim, byudjet, atomarlik va ownership qoidalari botda ham xuddi webdagidek ishlaydi. Botdan
kelgan har bir yozuv avval Redis'dagi **qoralama** bo'ladi; ledgerga faqat "Saqlash" bosilganda tushadi.

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

**Web (Telegram kodi)**
1. Sayt `POST /auth/telegram/start` → bot deep link'i ochiladi (`t.me/<bot>?start=login_<nonce>`).
2. Botda Start; yangi foydalanuvchi o'z raqamini ulashadi (hisob shu paytda yaratiladi).
3. Bot so'rovga bog'langan 6 xonali kodni yuboradi (HMAC bilan saqlanadi, 3 daqiqa, 5 urinish).
4. Sayt kodni `POST /auth/telegram/verify` ga yuboradi → access (15 daq) va refresh (7 kun) `httpOnly` cookie.
5. Refresh token bazada **hashlangan**, `familyId` (= sessiya) bilan; har refresh'da rotatsiya,
   qayta ishlatilgan token butun oilani bekor qiladi. Access tokenda `sid` bor: sessiya yakunlansa
   yoki hisob o'chsa, token darhol ishlamay qoladi (Redis tekshiruvi).

**Telegram Mini App**
1. Ilova bot menyu tugmasidan yoki inline tugmadan ochiladi (klaviatura tugmasi `initData` bermaydi).
2. `Telegram.WebApp.initData` → `POST /auth/telegram/webapp` (HMAC tekshiruvi) → access token **xotirada**,
   `Authorization: Bearer`. Muddati tugasa o'sha `initData` qayta almashtiriladi.

## Infratuzilma

- Lokal: `docker-compose.yml` (PostgreSQL 16, Redis 7, Adminer); bot long polling bilan ishlaydi.
- CI (GitHub Actions): verify (lint, typecheck, Jest + Vitest, build, migratsiya drift tekshiruvi) ·
  API e2e (Postgres + Redis) · Playwright (build + mock Telegram) · Docker image build.
- Production: **bitta Docker image, bitta Railway servisi** — API, BullMQ ishlari va web build (API
  `WEB_DIST_DIR` dan beradi). Pre-deploy: `prisma migrate deploy`; healthcheck: `/api/v1/health/ready`;
  Telegram webhook to'g'ridan-to'g'ri shu domenga keladi. Sayt va API bitta domenda bo'lgani uchun
  cookie'lar first-party, CORS yo'q. CSP faqat `web.telegram.org` ga ilovani iframe'da ochishga ruxsat beradi.

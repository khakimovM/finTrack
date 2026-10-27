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
- BullMQ workerlar — takrorlanuvchi tranzaksiyalar, muddati o'tgan qarz tekshiruvi, kunlik xulosa va
  eslatmalar, oylik hisobot (oyning oxirgi kuni 21:00, cron `0 21 L * *`)
- `TtsService` (`infra/tts/`) — oylik hisobotning ovozi, egasi tanlagan tartibda (2026-10-26):
  Gemini `gemini-3.8-flash-tts` → `gemini-3.8-flash-lite-tts` (ikkalasi bepul kalit, Kore ovozi, "Toshkentlik
  o'zbekdek, chet el aksentisiz o'qi" ko'rsatmasi bilan; har modelning o'z kunlik limiti) → Azure F0
  (`uz-UZ-SardorNeural`, oyiga 500 000 belgi) → pulli (standart o'chiq). Har provayderning oylik belgisi
  Redis'da sanaladi (bepul limitning 95% i), rad etgani bir muddat chetga qo'yiladi (Gemini'ning kuni
  tugagani — 24 soat). Gemini WAV/PCM qaytaradi — `opusenc` (Docker image'dagi `opus-tools`, ~1 MB)
  OGG/Opus'ga o'tkazadi. Hech biri ishlamasa hisobot faqat matn bo'lib ketadi.

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
    ├── telegram/            bot handlerlari, qoralamalar, outbox, kunlik xulosa, eslatmalar (7:00 / 22:00), oylik hisobot, webhook
    ├── assistant/           ovoz/matn → yozuvlar (Gemini, Groq, Claude adapterlari)
    ├── activity/            faollik kunlari (guard + bot), kunlik hisoblagichlar (Redis)
    └── admin/               ega paneli: kirish, stats/, users/, system/, broadcasts/ (docs/09)
```

`admin` — ownership qoidasidan (invariant #4) **yagona ongli istisno**: foydalanuvchilar kesimida
o'qiydi, lekin faqat sanoq va sanalarni; pul, balans va izoh SELECT qilinmaydi. O'zgartiradigan amallari
(bloklash, sessiyalarni tugatish, xabar tarqatish) audit yozuvi bilan bitta tranzaksiyada.

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

**Tillar (uz, ru).** Kutubxonasiz, tiplangan lug'atlar:
- **Asosiy lug'at.** `lib/i18n/uz/` asosiy lug'at, bo'lim (namespace) bo'yicha fayllarga bo'lingan. `lib/i18n/ru/` dagi har bir fayl `Dict['bo'lim']` tipiga yoziladi, shuning uchun yetishmagan kalitni kompilyator ushlaydi.
- **Matn olish.** Sahifa va komponentlarda render paytida `t()` / `tn()`. Router'dan tashqarida qayta chizilishi kerak bo'lgan joyda (toast) `useT()`.
- **Son bilan matn.** `tn(key, count)` `{count}` ni o'zi qo'yadi. O'zbekchada `counted('{count} ta …')` bitta shakl beradi, ruschada `ruForms(one, few, many)` uchta shakl beradi.
- **Modul darajasidagi konstantalar** matnning o'zini emas, `TextKey` ni saqlaydi va u render paytida tarjima qilinadi. Modul yuklanganda `t()` yoki `currencyWord()` chaqirilsa, til almashgandan keyin ham eski til qoladi.
- **Til qayerda saqlanadi.**
  - Til `stores/localeStore.ts` da va `localStorage` da turadi.
  - Sozlamalarda tanlangan til `PATCH /users/me { locale }` bilan akkauntga ham yoziladi.
  - Kirgan foydalanuvchida `user.locale` qo'llanadi (`lib/i18n/followAccount.ts`), shuning uchun boshqa qurilmalar ham shu tilda ochiladi.
- **Til almashganda** butun router qayta chiziladi: sana va summalar render paytida yoziladi.
- **Umumiy jadvallar.** Oy va hafta kunlari nomlari, valyuta so'zi, qisqa birliklar, `plural()` va xato kodlarining matni (`ERROR_TEXT`) `packages/shared/src/i18n/` da. Ularni web ham, bot ham ishlatadi.
- **Admin panel** har doim o'zbekcha.
- **Landing ikki manzilda.** `/` o'zbekcha, `/ru` ruscha; ikkalasi alohida prerender qilinadi (`hreflang`, o'z tilidagi meta). Tafsiloti `docs/05` "SEO va birinchi yuklanish" da.
- **Matn ichidagi element.** Gapning bir qismi qalin yoki havola bo'lsa, lug'atda `{bot}` kabi joy qoldiriladi va `withNodes()` (`lib/i18n/rich.tsx`) uni elementga almashtiradi.
- **Bot.** Lug'at `modules/telegram/i18n/{uz,ru}.ts` da (`BotTexts = typeof uz`, ruschasi shu tipga yoziladi). Har bir javob foydalanuvchining tilida: `BOT_TEXTS[userLocale(user)]`.
  - Menyu tugmalari ikkala tilda ham eshitiladi (`hears(menuLabels(key))`), shuning uchun til almashgandan keyin eski klaviaturadagi tugma ham ishlaydi. Callback data tilga bog'liq emas.
  - Til ⚙️ Sozlamalarda tanlanadi (`lang:uz|ru`). Profil yangilanadi, shu chatda menyu klaviaturasi va Mini App tugmasining nomi (`setChatMenuButton`) almashadi.
  - Buyruqlar va bot tavsifi tilga qarab o'rnatiladi: `setMyCommands`, `setMyDescription`, `setMyShortDescription`, `language_code: 'ru'` bilan.
  - Tez yozish ruscha yozuvlarni ham tushunadi: `45к`, `20 тыс`, `1,2 млн`, `вчера`, `сум`. Kategoriya taxmini ikkala tildagi standart nomlarni biladi.
  - Kirish xabarlari `auth/telegram-login.messages.ts` da (`LOGIN_TEXTS`). Admin panelga kirish kodi har doim o'zbekcha.
  - Oylik hisobotning ruscha matni va ovoz skripti `monthly-report-texts.ru.ts` da. Sonlar so'z bilan (`numberToWordsRu`), ovoz `ru-RU`.
- **Saqlanadigan matnlar** yaratilish paytida egasining tilida yoziladi va keyin o'zgarmaydi:
  - bildirishnoma `title`/`body`: `NotificationsService.createSafe(userId, { text: (t) => … })`, matnlar `notifications/notification-texts.ts` da;
  - avto izohlar ("Qarz: X", "Takroriy to‘lov", "To‘liq yopildi"): `common/i18n/auto-notes.ts`;
  - yangi hisobning standart kategoriyalari va hisobi: `auth/user-defaults.ts`.
- **Statistikadagi "Boshqa"** (`categoryId: null`) saqlanmaydi, uni ko'rsatadigan tomon tarjima qiladi: web'da `lib/categoryName.ts`, botda `categoryName()`.
- **Eksport** (CSV/XLSX) ustunlari so'rovning `Accept-Language` tilida.
- **Tekshiruv.** Har sahifa va forma uchun ruscha smoke test bor: `test/russian.ts` dagi `latinLeftovers()` rus ekranida lotin harfli so'z qoldirmaydi, testdagi ma'lumotdan tashqari.

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

**Admin panel**
`/admin/login` → `start=admin_<nonce>` → bot kodni faqat `ADMIN_TELEGRAM_IDS` dagi hisobga beradi
(boshqasiga "havola eskirgan") → `ft_admin` cookie (`SameSite=Strict`, `path=/api/v1/admin`, 8 soat,
1 soat harakatsizlik). `AdminGuard` sessiyasizlarga **404** beradi; ikki sessiya bir-biriga hech narsa
ochmaydi. Bloklangan hisob guard, refresh, kod, Mini App va botda to'xtatiladi (`403 ACCOUNT_BANNED`).

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
- Domen: **https://myfintrack.uz** (DNS — Cloudflare, apex CNAME "DNS only" → Railway; `www` Cloudflare'da
  301 bilan apex'ga; pochta — Cloudflare Email Routing). `*.up.railway.app` dagi sahifa so'rovlari `CLIENT_URL`
  ga 301 (API emas).
- Web build (`apps/web` `npm run build`): Vite → landing'ning SSR build'i (`src/entry-prerender.tsx`) →
  `scripts/prerender.mjs`. Natija: `index.html` — o'zbekcha landing HTML'i ichida (`/`), `ru.html` — ruscha (`/ru`;
  `/ru/` → 301), `app.html` — bo'sh qobiq `noindex` bilan (`/login`, `/app/*`, `/admin/*`; boshqa manzil — shu qobiq **404** bilan), har matnli
  faylning `.br`/`.gz` nusxasi (`serve-web.ts` `preCompressed` bilan beradi, `Vary: Accept-Encoding`).
  Ilova sahifalari alohida chunk'lar (`routes.tsx` `lazy`): landing faqat o'ziga kerak kodni yuklaydi.

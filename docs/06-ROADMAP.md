# 06 — Yo'l xaritasi

Agent har safar **shu fayldan** keyingi vazifani oladi. Bosqichlar ketma-ket bajariladi.
Bosqich tugagach `/phase-report` ishlatiladi va **to'xtaladi** — keyingisi tasdiqdan keyin.

---

## Bosqich 0 — Monorepo skeleti
**Vazifa:** pnpm workspaces + Turborepo, `apps/api` (Nest), `apps/web` (Vite+React),
`packages/shared`; ESLint, Prettier, Husky + lint-staged, `tsconfig` bazasi;
`docker-compose.yml` (Postgres 16, Redis 7, Adminer); `.env.example`; root skriptlar.

**Qabul mezonlari**
- [ ] `pnpm install` xatosiz
- [ ] `pnpm db:up` Postgres va Redisni ko'taradi
- [ ] `pnpm dev` ikkala ilovani ishga tushiradi (`:5000`, `:5173`)
- [ ] `pnpm lint`, `pnpm typecheck` yashil
- [ ] `GET /api/v1/health` `{"status":"ok"}` qaytaradi

---

## Bosqich 1 — Baza va infratuzilma
**Vazifa:** `schema.prisma` ni to'liq qo'llash, birinchi migratsiya, `PrismaModule`,
`CacheModule` (Redis), `ConfigModule` + Zod env validatsiyasi, global
`TransformInterceptor` / `AllExceptionsFilter` / `ZodValidationPipe`, Pino logger,
Swagger `/api/docs`, Throttler, Helmet, CORS.

**Qabul mezonlari**
- [ ] `prisma migrate dev` barcha modellarni yaratadi, `prisma validate` yashil
- [ ] Yetishmayotgan env o'zgaruvchisi bo'lsa ilova ishga tushmaydi va sababni aytadi
- [ ] Xatolik konverti hujjatdagi shaklga aynan mos
- [ ] `/api/docs` ochiladi
- [ ] `BigInt` JSONda string bo'lib chiqadi

---

## Bosqich 2 — Autentifikatsiya
**Vazifa:** 9 ta auth endpointi, bcrypt(12), access/refresh cookie, refresh rotatsiyasi va
oila bekor qilish, `JwtAuthGuard` + `@Public()` + `@CurrentUser()`, sessiyalar ro'yxati,
register paytida 10 ta standart kategoriya va default hisob yaratish.

**Qabul mezonlari**
- [ ] Register → login → me → refresh → logout to'liq ishlaydi
- [ ] Rotatsiya qilingan tokenni qayta ishlatish `401 TOKEN_REUSE_DETECTED` va oilani bekor qiladi
- [ ] Parol javoblarda va loglarda hech qachon ko'rinmaydi
- [ ] `/auth/login` da rate limit 5/min ishlaydi
- [ ] e2e: noto'g'ri parol va mavjud bo'lmagan email bir xil xabar qaytaradi

---

## Bosqich 3 — Hisoblar, kategoriyalar, teglar
**Vazifa:** uchta modul, CRUD, kategoriya daraxti (parent/child), tartiblash,
arxivlash, `BalanceService` (ledgerdan hisoblash + Redis kesh + invalidatsiya).

**Qabul mezonlari**
- [ ] `GET /accounts` hisoblangan `balance` va `meta.totalBalance` qaytaradi
- [ ] Kategoriya o'chirilsa tranzaksiyalar qoladi (`categoryId = null`)
- [ ] Tizim kategoriyasini o'chirish `422 SYSTEM_CATEGORY`
- [ ] Har bir resurs uchun ownership e2e testi (404) yashil
- [ ] Balans keshi yozuvda invalidatsiya qilinadi (test bilan isbotlangan)

---

## Bosqich 4 — Ledger: tranzaksiyalar va o'tkazmalar
**Vazifa:** tranzaksiya CRUD, filtr/saralash/sahifalash, `meta.sums`, soft delete + restore,
ommaviy o'chirish, `POST /transfers` (ikki yozuv, bitta `$transaction`),
`BalanceGuardService` va `strictMode`.

**Qabul mezonlari**
- [ ] To'qqiz turning har biri balansga to'g'ri ta'sir qiladi (unit test)
- [ ] `strictMode: true` → `422 INSUFFICIENT_BALANCE` va yozuv **saqlanmaydi**
- [ ] `strictMode: false` → balans manfiyga tushadi
- [ ] O'tkazma umumiy balansni o'zgartirmaydi; bittasini o'chirish ikkalasini o'chiradi
- [ ] `LOAN_*` / `TRANSFER_*` ni `POST /transactions` orqali yaratib bo'lmaydi
- [ ] 10 000 yozuvda ro'yxat < 300 ms

---

## Bosqich 5 — Qarzlar
**Vazifa:** qarz CRUD, `DebtPayment` (qisman to'lov), `settle`, `remainingAmount` va
`isOverdue` hisoblash, `meta.summary`, ledger yozuvlari bilan atomik bog'lanish.

**Qabul mezonlari**
- [ ] Qarz yaratilganda `Debt` + ledger yozuvi bitta `$transaction` da
- [ ] Qisman to'lov qoldiqni to'g'ri kamaytiradi, status `PARTIALLY_PAID` bo'ladi
- [ ] Qoldiq 0 → `PAID` + `paidAt`, o'sha tranzaksiyada
- [ ] Ortiqcha to'lov `422 DEBT_OVERPAYMENT`, hech narsa o'zgarmaydi
- [ ] Qarz o'chirilsa ledger kaskad o'chadi va balans tiklanadi
- [ ] Qarzlar `/stats/by-category` da **ko'rinmaydi** (test bilan isbotlangan)

---

## Bosqich 6 — Statistika
**Vazifa:** 7 ta stats endpointi, `$queryRaw` agregatsiyalari, bo'sh bucketlarni nol bilan
to'ldirish, oldingi davr bilan solishtirish, Redis kesh.

**Qabul mezonlari**
- [ ] `groupBy` `day/week/month/year` uchun bucketlar to'g'ri
- [ ] Ma'lumotsiz kunlar `0` bilan to'ldirilgan
- [ ] Faqat `INCOME`/`EXPENSE` qatnashadi
- [ ] Oy chegaralari (1-kun, oxirgi kun) to'g'ri — off-by-one testi bor
- [ ] 50 000 yozuvda < 500 ms

---

## Bosqich 7 — Frontend: skelet va auth
**Vazifa:** Vite + TS + Tailwind + shadcn/ui, `createBrowserRouter`, `RootLayout`,
`ProtectedRoute`, axios interceptorlari (401 → refresh), `authStore`, `uiStore`,
login/register sahifalari, i18n (uz), dark mode, `queryKeys` reyestri.

**Qabul mezonlari**
- [x] Login qilib bo'sh dashboardga kirish mumkin
- [x] Access token muddati tugaganda avtomatik refresh bo'ladi, foydalanuvchi sezmaydi
- [x] Sahifa yangilanganda sessiya saqlanadi
- [x] Dark mode va 375px ishlaydi

---

## Bosqich 8 — Frontend: ledger va hisoblar
**Vazifa:** tranzaksiyalar sahifasi (filtr, qidiruv, sahifalash, URL sinxronizatsiyasi),
yaratish/tahrirlash modallari, `MoneyInput`, hisoblar sahifasi, o'tkazma modali,
kategoriyalar sahifasi.

**Qabul mezonlari**
- [x] Barcha filtrlar URLda saqlanadi va sahifa yangilanishidan omon qoladi
- [x] To'rt holat har bir ko'rinishda bor
- [x] Mutatsiyadan keyin balans va statistika avtomatik yangilanadi
- [x] `strictMode` xatosi o'zbekcha toast sifatida ko'rinadi
- [x] Mobil: jadval kartalarga aylanadi

---

## Bosqich 9 — Frontend: dashboard va grafiklar
**Vazifa:** davr filtri (`periodStore`), 4 KPI karta, 5 grafik, byudjet progresslari,
oxirgi tranzaksiyalar bloki.

**Qabul mezonlari**
- [x] Davr o'zgarganda barcha grafiklar birga yangilanadi
- [x] Bo'sh davrda `EmptyState`, o'qsiz grafik emas
- [x] Tooltiplarda pul formatlangan
- [x] Manfiy balans qizil + ikonka + minus bilan
- [x] Yillik davrda `groupBy` avtomatik `month`

---

## Bosqich 10 — Byudjetlar, qarz UI, bildirishnomalar
**Vazifa:** byudjet moduli (backend + UI), qarz sahifasi (qisman to'lovlar bilan),
bildirishnomalar (backend hodisalari + UI qo'ng'iroq ikonkasi + o'qilgan holati).

**Qabul mezonlari**
- [x] 80% va 100% chegaralarida bildirishnoma **bir marta** yuboriladi
- [x] Byudjet tranzaksiyani bloklamaydi
- [x] Qarz progress bari qoldiqni to'g'ri ko'rsatadi
- [x] Bildirishnomalar o'qilgan deb belgilanadi

---

## Bosqich 11 — Takrorlanuvchi to'lovlar va eksport
**Vazifa:** BullMQ worker (kunlik), `RecurringRule` CRUD + `run-now`, idempotentlik,
CSV va XLSX eksport (filtrlar bilan).

**Qabul mezonlari**
- [x] Worker ikki marta ishga tushsa ham dublikat yaratilmaydi
- [x] `run-now` darhol tranzaksiya yaratadi
- [x] Eksport fayli filtrlarga mos va pul to'g'ri formatlangan

---

## Bosqich 12 — Sifat va deploy
**Vazifa:** test qamrovini 80% ga yetkazish, Playwright kritik yo'li, GitHub Actions CI,
Dockerfile'lar, README va skrinshotlar, deploy (API + Web + boshqariladigan Postgres).

**Qabul mezonlari**
- [x] CI har PR da lint + typecheck + test + e2e ishlatadi
- [x] Playwright: register → kirim → chiqim → grafik → qarz → qisman to'lov yashil
- [x] Migratsiya deployda alohida qadam sifatida bajariladi
- [x] README bo'yicha begona odam loyihani 5 daqiqada ko'tara oladi

---

## Production va Telegram bosqichlari (A–I)

Audit natijasida 0–12 bosqichlar ustiga qilingan ishlar (batafsil: git tarixi,
`feat/production-hardening` branch). Auth endi **faqat Telegram** orqali: 2-bosqichdagi
email/parol endpointlari olib tashlangan.

| Bosqich | Mazmuni | Holat |
|---|---|---|
| A | Migratsiyalar, xavfsizlik (CSRF, CSP, rate limit, loglarda sir yo'q), Prisma xatolari, vaqt zonasi | ✅ |
| B | Boshqariladigan yozuvlar, qator qulflari, refresh CAS, userId scoping, byudjet/kategoriya qoidalari | ✅ |
| C | BullMQ jadval, recurring quvib yetish, qarz eslatmalari, bildirishnoma dedupe | ✅ |
| D | Telegram OTP kirish, sessiyalar, `users/me`, Sozlamalar sahifasi | ✅ |
| E | Botdan boshqarish: tez kiritish, hisobot, qarzlar, sozlamalar, Telegram push, kunlik xulosa | ✅ |
| F | Ovozli yordamchi (Gemini → Groq → Claude) | ✅ |
| G | Telegram Mini App (`initData` kirish, mavzu, Back tugmasi) | ✅ |
| H | Takroriy to'lovlar va hisobotlar sahifalari, invalidatsiya jadvali, Vitest | ✅ |
| I | Yagona Docker image + Railway, CI (4 job), Playwright (mock Telegram), hujjatlar | ✅ |

Qolgan: haqiqiy Telegram bilan sinov (ovoz, Mini App) va production deploy — foydalanuvchi bilan birga.

---

## Ixtiyoriy — Bosqich 13: ko'p valyuta
`Account.currency`, `ExchangeRate`, `amountBase`, kurs qotirish, statistikani bazaviy
valyutada hisoblash. Faqat 12-bosqich tugagach boshlanadi.

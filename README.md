# FinTrack

Ko'p foydalanuvchili shaxsiy moliya platformasi: kirim-chiqim, hisoblar, byudjetlar, qarzlar,
takroriy to'lovlar va hisobotlar. Kirish **faqat Telegram orqali** (bot bir martalik kod yuboradi),
moliyani **botning o'zidan** ham boshqarish mumkin — matn yoki ovozli xabar bilan — va ilova
**Telegram Mini App** sifatida bot ichida ochiladi.

| Qatlam | Texnologiya |
|---|---|
| Monorepo | npm workspaces + Turborepo (`apps/api`, `apps/web`, `packages/shared`) |
| Backend | NestJS 10 (Fastify), Prisma 5 + PostgreSQL 16, Redis + BullMQ, grammY (Telegram) |
| Frontend | React 18 + Vite, TanStack Query v5, Zustand, Tailwind, Recharts |
| Ovozli yordamchi | Gemini (tekin tarif, model zanjiri) → Groq Whisper (zaxira) → ixtiyoriy Claude |
| Testlar | Jest + Supertest (API), Vitest + Testing Library + MSW (web), Playwright (brauzer) |
| Deploy | Bitta Docker image (API web'ni ham beradi) → Railway |

---

## Lokal ishga tushirish

**Talablar:** Node.js 22, Docker Desktop.

```bash
npm install
npm run db:up          # PostgreSQL (:5434) va Redis (:6380)
cp .env.example apps/api/.env
npm run db:deploy      # migratsiyalar
npm run dev            # API :5000 va web :5173
```

> PowerShell `npm.ps1 cannot be loaded` desa: `npm.cmd` ishlating yoki bir marta
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

### Telegram bot (kirish uchun majburiy)
1. [@BotFather](https://t.me/BotFather) → `/newbot` → token va username oling (test uchun alohida bot tavsiya etiladi).
2. `apps/api/.env` ga yozing:
   ```
   TELEGRAM_BOT_TOKEN=...
   TELEGRAM_BOT_USERNAME=mening_fintrack_botim
   ```
3. `npm run dev` — lokal muhitda bot **long polling** bilan ishlaydi (webhook kerak emas).
4. <http://localhost:5173> → "Telegram orqali kirish" → botda Start → raqamni ulashing → kodni kiriting.

Namunaviy ma'lumot: `DEMO_TELEGRAM_ID=<sizning Telegram ID>` qo'yib `npm run db:seed` — shu ID bilan
kirganingizda 3 oylik demo ma'lumot ko'rinadi.

### Ovozli yordamchi (ixtiyoriy)
`GEMINI_API_KEY` ([AI Studio](https://aistudio.google.com), tekin) va `GROQ_API_KEY`
([Groq](https://console.groq.com), tekin) ni `apps/api/.env` ga yozing. Botga ovozli xabar yuboring —
u yozuvlarni qoralama sifatida chiqaradi, siz faqat tasdiqlaysiz. Diqqat: Gemini'ning tekin tarifida
Google so'rovlarni o'z mahsulotlarini yaxshilash uchun ishlatishi mumkin.

### Mini App'ni lokal sinash
Telegram Mini App'ni faqat HTTPS manzildan ochadi: lokal sinov uchun HTTPS tunnel
(masalan, `cloudflared tunnel --url http://localhost:5173`) va `WEB_APP_URL=<tunnel manzili>` kerak.

---

## Tekshiruvlar

| Buyruq | Nima qiladi |
|---|---|
| `npm run verify` | lint + typecheck + unit testlar (API Jest + web Vitest) — "tayyor" deyishdan oldin |
| `npm run build` | shared → api → web |
| `npm --workspace=api run test:e2e` | API e2e: haqiqiy Postgres/Redis, soxta Telegram Bot API |
| `npm --workspace=web run test:e2e` | Playwright: build qilingan ilova + mock Telegram (avval `npm run build` va `npx playwright install chromium`) |
| `npm run test:e2e` | ikkalasi, ketma-ket |

E2E testlar faqat nomi `_test` bilan tugaydigan bazada ishlaydi (`fintrack_test`), jadvallarni tozalaydi —
ishchi bazangizga tegmaydi.

---

## Production: Railway

Bitta servis: API + fon ishlari (BullMQ) + web (API `apps/web/dist` ni o'zi beradi — sayt va API bitta
domenda, shuning uchun cookie'lar first-party va CORS kerak emas). Konfiguratsiya: `Dockerfile`, `railway.json`
(pre-deploy'da `prisma migrate deploy`, healthcheck `/api/v1/health/ready`).

1. Railway'da loyiha → **PostgreSQL** va **Redis** qo'shing.
2. GitHub repodan servis yarating (root papka; `railway.json` avtomatik o'qiladi).
3. Servisga domen bering (Settings → Networking → Generate Domain yoki o'z domeningiz).
4. O'zgaruvchilar (Variables):

   | O'zgaruvchi | Qiymat |
   |---|---|
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
   | `REDIS_URL` | `${{Redis.REDIS_URL}}` |
   | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `OTP_SECRET` | har biri `openssl rand -base64 48` |
   | `CLIENT_URL`, `WEB_APP_URL` | `https://<domen>` |
   | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` | production bot |
   | `TELEGRAM_WEBHOOK_URL` | `https://<domen>/api/v1/telegram/webhook` |
   | `TELEGRAM_WEBHOOK_SECRET` | `openssl rand -hex 32` |
   | `GEMINI_API_KEY`, `GROQ_API_KEY` | ixtiyoriy (ovozli yordamchi) |

5. Deploy. Ishga tushganda API webhook'ni, bot buyruqlarini va "Ilova" menyu tugmasini o'zi o'rnatadi.

### Production checklist
- [ ] `https://<domen>/api/v1/health/ready` → `{"status":"ok","db":"ok","redis":"ok"}`
- [ ] Telegram'da `getWebhookInfo`: url to'g'ri, `last_error_message` yo'q
- [ ] Saytda Telegram orqali kirish va botda `50000 taksi` → saqlash ishlaydi
- [ ] Bot menyusidagi "Ilova" tugmasi Mini App'ni ochadi va avtomatik kiritadi
- [ ] Railway loglarida token, cookie yoki moliyaviy matn ko'rinmaydi
- [ ] Swagger production'da yopiq (`SWAGGER_ENABLED` bo'sh)
- [ ] Bazaning muntazam zaxira nusxasi olinadi (Railway volume backup yoki rejalashtirilgan `pg_dump`)

O'z serveringizda: `docker compose -f docker-compose.prod.yml up -d --build` (oldiga HTTPS proxy qo'ying).

---

## Loyihaning beshta qonuni

1. **Pul — `BigInt` tiyinda** (1 so'm = 100 tiyin), JSONda string.
2. **Balans saqlanmaydi** — har doim ledgerdan hisoblanadi.
3. **Qarz berish xarajat emas** — `LOAN_*` statistikaga kirmaydi.
4. **Har bir so'rov `userId` bilan cheklangan.**
5. **Ko'p bosqichli pul amallari atomar** (`prisma.$transaction`).

Batafsil: `AGENTS.md`, `.agents/rules/40-domain-money.md`.

## Hujjatlar

| Fayl | Mazmuni |
|---|---|
| `docs/01-PRD.md` | Nima quriladi va nega |
| `docs/02-ARCHITECTURE.md` | Qatlamlar, modullar, auth va deploy topologiyasi |
| `docs/03-DATA-MODEL.md` | Ledger mantiqi, qarz hisobi, indekslar |
| `docs/04-API-CONTRACT.md` | 77 endpoint, xato kodlari, so'rov/javob namunalari |
| `docs/05-FRONTEND-SPEC.md` | Sahifalar, state chegarasi, invalidatsiya jadvali |
| `docs/06-ROADMAP.md` | Bosqichlar va qabul mezonlari |
| `docs/07-DEFINITION-OF-DONE.md` | "Tayyor" degani nima |

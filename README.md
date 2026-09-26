# FinTrack

Ko'p foydalanuvchili shaxsiy moliya platformasi. NestJS + PostgreSQL + Prisma backend,
React + TanStack Query frontend. Google Antigravity bilan agent yordamida qurish uchun
to'liq sozlangan.

## Talablar (Prerequisites)

- **Node.js**: `>=20.11.0`
- **npm**: `>=10.0.0`
- **Docker va Docker Compose** (PostgreSQL 16 va Redis 7 uchun)

---

## Loyihani ishga tushirish (Qadam-baqadam qo'llanma)

Barcha dasturchilar loyihani qiynalmasdan o'z kompyuterlarida ishga tushirishlari uchun quyidagi bosqichlarni ketma-ket bajaring:

### 1-qadam: Docker Desktop-ni ishga tushirish
1. Kompyuteringizda **Docker Desktop** dasturini oching.
2. Dastur to'liq yuklanguncha kuting (pastki chap burchakda yashil rangda *"Engine running"* bo'lishi kerak).

### 2-qadam: Terminalda loyiha papkasiga kirish
Terminalni oching va loyiha joylashgan papkaga kiring:
```powershell
cd fintrack
```

> [!TIP]
> **Windows PowerShell foydalanuvchilari uchun muhim:**  
> Agar PowerShell'da `File npm.ps1 cannot be loaded because running scripts is disabled` degan xatolik chiqsa:
> - Buyruqlarni `npm` o'rniga **`npm.cmd`** deb yozing (masalan: `npm.cmd run dev`), **yoki**
> - Terminalda bir marta quyidagi ruxsat berish buyrug'ini bajaring:
>   ```powershell
>   Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
>   ```

### 3-qadam: Ma'lumotlar bazasi va Redis-ni ko'tarish
PostgreSQL (port `5434`) va Redis (port `6380`) konteynerlarini fonda ishga tushiring:
```bash
npm run db:up
```
*(yoki to'g'ridan-to'g'ri: `docker compose up -d`)*

### 4-qadam: Bog'liqliklar va Prisma-ni sozlash
1. Konfiguratsiya faylini tayyorlang va paketlarni o'rnating:
   ```bash
   cp .env.example .env          # agar .env mavjud bo'lmasa
   npm install
   ```
2. Prisma Client generatsiya qilish va sxemani sinxronlash:
   ```bash
   npm run db:generate
   ```
3. Test ma'lumotlar va namunaviy foydalanuvchini yuklash (seed):
   ```bash
   npm run db:seed
   ```

### 5-qadam: Loyihani ishga tushirish (Dev serverlar)
API va Web ilovani bir vaqtda parallel ishga tushirish:
```bash
npm run dev
```

*(Agar xohlasangiz, ikkita alohida terminal ochib alohida ham yurgizishingiz mumkin: birinchisida `npm run dev:api`, ikkinchisida `npm run dev:web`)*.

---

### 6-qadam: Havolalar va foydalanuvchi ma'lumotlari

Loyihani brauzerda oching:
- 🌐 **Web ilova (Frontend):** [http://localhost:5173](http://localhost:5173)
- 🔌 **Backend API:** [http://localhost:5000/api/v1](http://localhost:5000/api/v1)
- 📖 **Swagger API Hujjatlari:** [http://localhost:5000/api/docs](http://localhost:5000/api/docs)
- 🗄️ **Adminer (DB boshqaruvi):** [http://localhost:8081](http://localhost:8081)
- 👤 **Standart test foydalanuvchi:** `aziz@fintrack.uz` / `Parol123!`

---

### Loyihani to'xtatish:
- **Dev serverlarni to'xtatish:** Terminalda `Ctrl + C` tugmalarini bosing.
- **Docker konteynerlarni to'xtatish:** 
  ```bash
  npm run db:down
  ```

---

### Production muhitida Docker Compose orqali ishga tushirish

Ilovani production rejimida barcha konteynerlar (postgres, redis, api, web) bilan birga ko'tarish:

```bash
docker compose -f docker-compose.prod.yml up -d --build
npm --workspace=api run db:deploy
```

---

## Sinov va sifat nazorati (Verification)

Loyihada 80%+ test qamrovi, qat'iy TypeScript (`strict: true`) va ESLint qoidalari o'rnatilgan.

| Buyruq | Vazifasi |
|---|---|
| `npm run verify` | Monorepo bo'ylab `lint` + `typecheck` + `test` (coverage bilan) |
| `npm run lint` | ESLint tekshiruvi (`api`, `web`, `shared`) |
| `npm run typecheck` | TypeScript tekshiruvi (`tsc --noEmit`) |
| `npm run test` | Jest testlari (servislar, yordamchi modullar, hisob-kitoblar) |
| `npm run test:e2e` | Playwright e2e testlari (kritik foydalanuvchi oqimi) |

---

## Arxitektura va texnologiyalar

| Qatlam | Texnologiya | Tavsif |
|---|---|---|
| **Monorepo** | npm workspaces + Turborepo | `apps/api`, `apps/web`, `packages/shared` |
| **Backend** | NestJS 10 (Fastify) | TypeScript strict, BullMQ, Redis, Pino logger |
| **Ma'lumotlar bazasi** | PostgreSQL 16 + Prisma 5 | Tranzaksion ledger, indekslangan so'rovlar |
| **Frontend** | React 18 + Vite + TS | TanStack Query v5, Zustand, Tailwind CSS, Recharts |
| **Validatsiya** | Zod / nestjs-zod | Backend va frontend uchun yagona `packages/shared` sxemalari |
| **Sinovlar** | Jest + Playwright | Biznes mantiq uchun 88%+ qamrov, Playwright e2e |

---

## Loyihaning beshta qonuni (Domain Invariants)

1. **Pul — `BigInt` tiyinda (1 UZS = 100 tiyin)**: Hech qachon `Float` yoki `Number` saqlanmaydi va hisoblanmaydi. JSON orqali `string` ko'rinishida uzatiladi.
2. **Balans saqlanmaydi**: Doimo ledger yozuvlarining yig'indisi (`SUM(signed amounts)`) orqali hisoblanadi.
3. **Qarz berish xarajat emas**: `LOAN_GIVEN` operatsiyasi hisob balansini o'zgartiradi, ammo xarajatlar statistikasiga kirmaydi.
4. **Har bir so'rov `userId` bo'yicha cheklangan**: So'rovlarda `userId` filtrining yo'qligi xavfsizlik insidenti deb baholanadi.
5. **Ko'p bosqichli pul amallari atomar**: O'tkazmalar, qarzlarni so'ndirish, qayta hisoblar faqat `prisma.$transaction()` ichida bajariladi.

---

## Antigravity bilan ishlash

Loyihani Antigravityda oching. Agent avtomatik o'qiydi:

| Fayl / papka | Nima |
|---|---|
| `AGENTS.md` | Asosiy qoidalar — agent har sessiyada shundan boshlaydi |
| `.agents/rules/` | 8 ta qoida fayli (backend, DB, frontend, pul, test, xavfsizlik, git) |
| `.agents/skills/` | 8 ta skill — kerak bo'lganda avtomatik yuklanadi |
| `.agents/workflows/` | `/next-task`, `/review`, `/verify`, `/debug`, `/new-endpoint`, `/new-page`, `/phase-report` |
| `.agents/agents/` | 4 ta persona: backend-architect, frontend-engineer, qa-reviewer, devops |
| `.agents/mcp_config.json` | MCP serverlar: postgres, filesystem, context7, playwright, github |
| `.agents/hooks.json` | Destruktiv buyruqlarni bloklovchi hook + formatlash |
| `docs/` | Spetsifikatsiya — haqiqat manbai |

### Birinchi sessiya

```
/next-task
```

Agent `docs/06-ROADMAP.md` dan keyingi bosqichni oladi, rejasini aytadi, bajaradi va to'xtaydi.
Har bosqich oxirida:

```
/phase-report      → holat hisoboti
/review            → diffni qoidalar bo'yicha tekshirish
/verify            → lint + typecheck + test
```

### Personalarga vazifa berish
```
@backend-architect  5-bosqich: qarz modulini qisman to'lovlar bilan qil
@frontend-engineer  Dashboard grafiklarini spec bo'yicha qur
@qa-reviewer        Oxirgi diffni tekshir va buzilgan joyini top
@devops             CI ni ishga tushir va deploy konfiguratsiyasini tayyorla
```

---

## Hujjatlar

| Fayl | Mazmuni |
|---|---|
| `docs/01-PRD.md` | Nima quriladi va nega |
| `docs/02-ARCHITECTURE.md` | Qatlamlar, papka strukturasi, ma'lumot oqimi |
| `docs/03-DATA-MODEL.md` | Ledger mantiqi, qarz hisobi, indekslar |
| `docs/04-API-CONTRACT.md` | 72 endpoint, so'rov/javob namunalari |
| `docs/05-FRONTEND-SPEC.md` | Sahifalar, state chegarasi, invalidatsiya jadvali |
| `docs/06-ROADMAP.md` | 13 bosqich, har birida qabul mezonlari |
| `docs/07-DEFINITION-OF-DONE.md` | "Tayyor" degani nima |

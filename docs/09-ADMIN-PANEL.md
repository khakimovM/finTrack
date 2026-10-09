# 09 — Admin panel (Bosqich J)

Loyiha egasi uchun yopiq panel: foydalanuvchilar statistikasi, o'sish, faollik, foydalanish,
tizim holati va boshqaruv. **Faqat bitta odam kira oladi** — egasi. Ish `feat/admin` branch'ida,
J1–J7 bosqichlari ketma-ket; har bosqichdan keyin `npm run verify` + testlar + o'zbekcha hisobot
va **to'xtash**; oxirida bitta PR.

## Qabul qilingan qarorlar (2026-10-08)

| Savol | Qaror |
|---|---|
| Foydalanuvchi haqida qancha ma'lumot | **Faqat faollik**: ism, @username, ro'yxatdan o'tgan sana, oxirgi faollik, yozuvlar **soni**, kanallar. Summa, balans, izoh, qarzdor ismlari **ko'rinmaydi**. |
| Boshqaruv | Bloklash + sessiyalarni tugatish, botdan xabar tarqatish, tizim holati, CSV eksport — **hammasi** |
| Admin sessiyasi | **8 soat** mutlaq muddat, **1 soat** harakatsizlikdan keyin tugaydi |
| Kim admin | `ADMIN_TELEGRAM_IDS` env (vergul bilan ajratilgan Telegram ID'lar). DB'dagi rol emas: bazadagi xato yoki SQL bilan admin bo'lib bo'lmaydi |

## Kirish: botda ikki xil kod

| | Foydalanuvchi | Admin |
|---|---|---|
| Sahifa | `/login` | `/admin/login` |
| Deep link | `start=login_<nonce>` | `start=admin_<nonce>` |
| Bot xabari | "🔑 Kirish kodi: 123456" | "🛡 **Admin panel** kirish kodi: 654321" (boshqa sarlavha, ogohlantirish, "Bu men emasman") |
| Kim oladi | Har qanday ro'yxatdan o'tgan foydalanuvchi | Faqat `ADMIN_TELEGRAM_IDS` dagi ID |
| Natija | `accessToken`/`refreshToken` cookie | Alohida `ft_admin` cookie (opaque token, DB'da hash) |

- Ruxsatsiz odam `admin_` havolasini ochsa, bot oddiy "havola eskirgan" deb javob beradi
  (admin borligi oshkor bo'lmaydi). So'rov bekor qilinadi, `ADMIN_LOGIN_DENIED` audit'ga yoziladi.
- `/id` bot buyrug'i — yuboruvchiga o'z Telegram ID'sini aytadi (`ADMIN_TELEGRAM_IDS` ni to'ldirish uchun).
- Admin oddiy foydalanuvchi sifatida ham kiraveradi — ikki sessiya bir-biridan mustaqil.

## Xavfsizlik

- Admin route'lar `/api/v1/admin/*`, alohida `AdminGuard`: cookie → `admin_sessions` (token SHA-256),
  muddat (8 soat) va harakatsizlik (1 soat) tekshiriladi, foydalanuvchining `telegramId` **har so'rovda**
  allowlist'da qayta tekshiriladi, `lastUsedAt` yangilanadi.
- Admin bo'lmaganga (yoki admin o'chirilganda — `ADMIN_TELEGRAM_IDS` bo'sh) **404**, 403 emas.
- `ft_admin` cookie: `httpOnly`, `secure`, `SameSite=Strict`, `path=/api/v1/admin`. Mavjud CSRF guard
  (`X-Requested-With`) admin yozuvlariga ham qo'llanadi.
- Rate limit: start 5/min, verify 10/min, kod 3 daqiqa, 5 urinish (mavjud OTP qoidalari).
- **Invariant #4 dan ongli istisno**: admin modul foydalanuvchilar kesimida agregat o'qiydi. Istisno faqat
  `modules/admin` ichida, faqat o'qish (bloklash/sessiya/tarqatishdan tashqari), faqat sanoq va
  sanalar — pul miqdori va matnli maydonlar SELECT qilinmaydi (repository testida tekshiriladi).
- Har admin amali (`LOGIN`, `LOGIN_DENIED`, `LOGOUT`, `BAN`, `UNBAN`, `REVOKE_SESSIONS`, `BROADCAST`,
  `EXPORT`) `admin_audit_logs` ga yoziladi.

## Ma'lumotlar modeli (faqat additiv migratsiyalar)

- `TelegramLoginPurpose` += `ADMIN`.
- `AdminSession`: id, userId, tokenHash (unique), ipAddress, userAgent, createdAt, lastUsedAt,
  expiresAt, revokedAt.
- `AdminAuditLog`: id, adminUserId, action, targetUserId?, meta (JSON), ipAddress, createdAt.
- `User` += `lastSeenAt`, `bannedAt`, `banReason`.
- `UserActivityDay`: (userId, day DATE, channel WEB|MINIAPP|BOT|UNKNOWN) unique — DAU/WAU/MAU va kogortalar uchun.
- `Transaction` += `source` (WEB | MINIAPP | BOT | VOICE | RECURRING), nullable — eski yozuvlar "noma'lum".
- `Broadcast`: id, adminUserId, text, segment, total, sent, failed, blocked, status, createdAt, finishedAt.
- Ovozli yordamchi so'rovlari: Redis kunlik hisoblagichlar (provayder × ok/xato), 120 kun TTL.

Faollik yozish: autentifikatsiyalangan so'rov (JwtAuthGuard) va bot xabari → Redis `SET NX`
(`activity:day:{day}:{channel}:{userId}`, 26 soat) → birinchi marta bo'lsa `UserActivityDay` upsert;
`lastSeenAt` 5 daqiqada ko'pi bilan bir marta. Har so'rovda DB'ga yozilmaydi. Tarixiy ma'lumot:
`transactions.created_at` va `refresh_tokens.created_at` dan 0006 migratsiyasining o'zida (kanal `UNKNOWN`).

## Bosqichlar

### J1 — Admin kirish va poydevor
Env (`ADMIN_TELEGRAM_IDS`, Zod), migratsiya (`ADMIN` purpose, `AdminSession`, `AdminAuditLog`),
`admin` modul: `POST /admin/auth/telegram/start`, `GET .../status/:id`, `POST .../verify`, `POST /admin/auth/logout`,
`GET /admin/auth/me`; bot: `admin_` payload + allowlist + alohida xabar matni; `/id` buyrug'i;
`AdminGuard` (404); web: `/admin/login` (LoginStates qayta ishlatiladi), lazy `/admin/*` layout,
`AdminProtectedRoute`, chiqish.

**Qabul mezonlari** (bajarildi, 2026-10-08)
- [x] Admin `/admin/login` → bot "🛡 Admin panel kirish kodi" → panelga kiradi (`e2e/admin.spec.ts`, `test/admin.e2e-spec.ts`)
- [x] Allowlist'da yo'q odam: bot "havola eskirgan", so'rov bekor, audit'da `LOGIN_DENIED`
- [x] Oddiy `accessToken` bilan `/api/v1/admin/*` → 404; `ft_admin` bilan oddiy API → 401
- [x] 1 soat harakatsizlik va 8 soat muddat tugashi testlangan (fake time)
- [x] `ADMIN_TELEGRAM_IDS` bo'sh → barcha admin route'lar 404, bot `admin_` ni rad etadi

### J2 — Faollik ma'lumotlari
Migratsiya (`lastSeenAt`, `UserActivityDay`, `Transaction.source`, `bannedAt`), faollik yozuvchi
(guard + bot), tranzaksiya yaratish joylarida `source`, ovozli yordamchi hisoblagichlari, tarixiy
faollikni to'ldirish (0006 migratsiyasida, idempotent).

**Qabul mezonlari** (bajarildi, 2026-10-08)
- [x] Bir kunda 100 so'rov → bitta `UserActivityDay` qatori (Redis throttle testi)
- [x] Sayt, Mini App, bot, ovoz, takroriy to'lov — har biri to'g'ri `source` bilan (`test/activity.e2e-spec.ts`)
- [x] Backfill ikki marta ishlasa ham dublikat yo'q

Rejadan farqlar: (1) tarixiy faollik alohida skript emas, **0006 migratsiyasining o'zida** to'ldiriladi —
production'da qo'lda ishga tushiriladigan qadam yo'q; (2) tarixiy kunlarning kanali ma'lum emas, shuning
uchun ular `WEB` emas, alohida `UNKNOWN` kanali bilan yoziladi (statistikada "kanal noma'lum").

### J3 — Statistika API
`GET /admin/stats/overview` (jami/yangi/faol foydalanuvchilar, bugun/7/30 kun, oldingi davrga nisbatan;
yozuvlar soni; botni bloklaganlar; bloklanganlar), `GET /admin/stats/growth?from&to&groupBy`
(yangi, kumulyativ, DAU/WAU/MAU, yozuvlar soni), `GET /admin/stats/retention` (haftalik kogortalar,
0–8 hafta), `GET /admin/stats/usage` (kanal ulushi, funksiyalardan foydalanish: qarz, byudjet, takroriy,
teg, 2+ hisob; ovozli yordamchi provayderlari va xatolar), `GET /admin/stats/funnel` (ro'yxatdan o'tdi →
birinchi yozuv → 5+ yozuv → 2-haftada qaytdi). `$queryRaw`, bo'sh bucket'lar 0, Redis kesh 60 s.

**Qabul mezonlari** (bajarildi, 2026-10-08; bitta istisno pastda)
- [x] Hech bir javobda summa, balans yoki matnli maydon yo'q (`test/admin-stats.e2e-spec.ts` har javobni aylanib chiqadi)
- [x] Bucket va kogorta chegaralari Toshkent vaqtida to'g'ri (23:59 / 00:00 testlari, kun, hafta, oy)
- [~] 10 000 foydalanuvchi / 500 000 yozuvda har endpoint < 500 ms (`ADMIN_PERF=1`,
  `test/admin-stats-perf.e2e-spec.ts`): overview ~440, kunlik o'sish ~100, retention ~200, usage ~140,
  funnel (bir yil) ~470 ms. **Istisno:** bir yillik haftalik o'sish birinchi marta ~750 ms, keyingi
  safar ~400 ms.

Rejadan farqlar: (1) yangi indekslar (0007): `transactions (createdAt, type)`,
`user_activity_days (day, userId)`; statistika so'rovlari `work_mem = 64MB` bilan ishlaydi;
(2) haftalik/oylik turli faol foydalanuvchilarni kunlardan qo'shib bo'lmaydi va ular eng og'ir so'rov
(bir yil haftalab, 10 000 kishi: `COUNT(DISTINCT)` bilan 2,7 s). Ikki yechim qo'llandi: so'rov "avval
DISTINCT, keyin COUNT" ko'rinishida (hash, 4 marta tezroq) va **tugagan bucket'lar keshi**: oraliq
ichida to'liq yotgan va bugundan oldin tugagan hafta/oy sanog'i Redis hash'da
(`admin:stats:closed-active:{groupBy}`) bir hafta saqlanadi, keyingi so'rov faqat qolganlarini
hisoblaydi.

### J4 — Foydalanuvchilar va tizim API
`GET /admin/users?q&sort&status&page` (ism, @username, telefon niqoblangan `+998 •• ••• •• 12`,
sana, oxirgi faollik, yozuvlar/hisoblar soni, kanallar, holat), `GET /admin/users/:id` (profil +
90 kunlik faollik + sanoqlar), `POST /admin/users/:id/ban|unban` (sabab bilan; bloklangan kira olmaydi,
botga "hisobingiz bloklangan", sessiyalar bekor), `POST /admin/users/:id/revoke-sessions`,
`GET /admin/users/export.csv`, `GET /admin/system` (DB, Redis, BullMQ navbatlari va oxirgi xatolar,
`getWebhookInfo`, versiya — `RAILWAY_GIT_COMMIT_SHA`, uptime, DB hajmi), `GET /admin/audit`.

**Qabul mezonlari** (bajarildi, 2026-10-09; `test/admin-users.e2e-spec.ts`)
- [x] Bloklangan foydalanuvchi: sayt, Mini App va bot orqali kira olmaydi; ochiq sessiyalari tugaydi
- [x] Admin o'zini bloklay olmaydi (ro'yxatdagi har qanday admin hisobi: `422 CANNOT_BAN_ADMIN`)
- [x] CSV'da summa yo'q, telefon niqoblangan; eksport audit'ga yoziladi

Rejadan farqlar va aniqlashtirishlar: (1) yangi xato kodi `403 ACCOUNT_BANNED` — kod bilan kirish,
Mini App va refresh'da (refresh'da u bo'lmasa, bekor qilingan token "o'g'irlik" deb ko'rinardi); Mini App'da
alohida "Hisobingiz bloklangan" ekrani; (2) bot bloklangan hisobga **har qanday** xabarga bir xil javob beradi
va handler'lar ishlamaydi, faollik ham yozilmaydi; ochilgan `/start login_…` so'rovi darhol `CANCELLED`;
(3) bloklash, sessiyalarni tugatish va audit yozuvi bitta tranzaksiyada; eksport auditi fayl berilishidan
oldin, yozilmasa fayl ham berilmaydi; (4) ro'yxatdagi "kanallar" — oxirgi 30 kun; (5) telefon bo'yicha
qidiruv yo'q (faqat ism, @username, Telegram ID).

### J5 — Admin UI
`/admin`: Umumiy ko'rinish (KPI + o'sish grafigi + faol foydalanuvchilar + kanallar donut + yangi
ro'yxatdan o'tganlar), Foydalanuvchilar (jadval, qidiruv, filtr, CSV, tafsilot paneli: faollik
kalendari, bloklash, sessiyalarni tugatish — `useConfirm` bilan), O'sish va qaytish (kogorta heatmap),
Foydalanish (funksiyalar, bot vs sayt, ovozli yordamchi), Tizim, Audit jurnali. Dizayn tizimi va
animatsiyalar qayta ishlatiladi; to'rt holat; telefonda ham ishlaydi; "Admin" belgisi.

**Qabul mezonlari** (bajarildi, 2026-10-09)
- [x] Har sahifada skeleton / xato / bo'sh / natija (har vidjet o'zi alohida; `AdminPanel.test.tsx`)
- [x] 390px da jadval kartalarga aylanadi (jadval 1024px dan; Playwright gorizontal scroll yo'qligini ham tekshiradi)
- [x] Admin bo'lmagan `/admin` ga kirsa 404 sahifasi (`e2e/admin.spec.ts`, `AdminLoginPage.test.tsx`)

Rejadan farqlar va aniqlashtirishlar: (1) J1 dagi "/admin → /admin/login" yo'naltirish o'rniga sessiyasiz
tashrif endi **404**; faqat shu tab'da sessiya bo'lgan va u tugagan bo'lsa `/admin/login` ga qaytaradi;
(2) tafsilot paneli alohida yon panel emas, `Modal lg` (telefonda to'liq sheet) — mavjud dizayn tizimi;
(3) Playwright'da ega bir marta kiradi: bot bitta odamga 15 daqiqada 5 tadan ortiq kod bermaydi.

### J6 — Botdan xabar tarqatish
`POST /admin/broadcasts/preview` (segment: hammasi / 30 kunda faol / 30+ kun faol emas → qabul
qiluvchilar soni), `POST /admin/broadcasts/test` (faqat adminning o'ziga), `POST /admin/broadcasts`
(tasdiq bilan), BullMQ navbati ~25 xabar/s, `telegramBlockedAt` larga yuborilmaydi, 403 → belgilanadi,
jarayon va natija UI'da; `notifyTelegram: false` bo'lganlarga ham yuboriladimi — J6 boshida so'raladi.

**Qaror (2026-10-09):** `notifyTelegram: false` bo'lganlarga — **har xabar uchun tanlanadi**: formada
"Bildirishnomalarni o'chirganlarga ham yuborish" belgisi, standart holatda o'chiq.

**Qabul mezonlari** (bajarildi, 2026-10-09; `test/admin-broadcasts.e2e-spec.ts`, `e2e/admin.spec.ts`)
- [x] Avval test xabari, keyin tasdiq oynasida aniq qabul qiluvchilar soni (server ham tekshiradi:
  test qilinmagan matn → `422 BROADCAST_NOT_TESTED`, son o'zgargan → `409 RECIPIENTS_CHANGED`)
- [x] Qayta ishga tushsa ham bir odamga ikki marta bormaydi (bir vaqtda uchta yuboruvchi va uzilgan yuborish testlangan)
- [x] Natija: yuborildi / bot bloklangan / xato (jarayon UI'da har 2 s yangilanadi)

Aniqlashtirishlar: (1) qabul qiluvchilar yaratish paytida qotiriladi (`BroadcastRecipient`, 0008);
(2) bir vaqtda faqat bitta xabar (`409 BROADCAST_IN_PROGRESS`) — ikkitasi botning ~30 xabar/s chegarasini
bo'lishib oshirib yuborardi; (3) xabar oddiy matn, formatlashsiz; (4) Telegram vaqtinchalik xato bersa (429,
tarmoq) bir marta qayta urinadi, keyin `failed`.

### J7 — Hujjatlar, e2e, deploy
`docs/01–05` yangilanadi (admin roli, arxitektura, data model, API kontrakt, frontend), Playwright:
admin kirishi (mock Telegram), ruxsatsiz rad etish, bloklash oqimi. Railway: `.railway/railway.ts` ga
`ADMIN_TELEGRAM_IDS: preserve()` qo'shiladi (aks holda IaC apply uni o'chirib yuboradi), qiymat
`railway variable set` bilan, keyin deploy.

**Qabul mezonlari**
- [x] `npm run verify` va `npm run test:e2e` yashil (2026-10-09)
- [ ] Production'da admin kirishi va rad etish qo'lda tekshirilgan

`.railway/railway.ts` da `ADMIN_TELEGRAM_IDS: preserve()` bor; `railway config plan` — "up to date"
(qiymat hali qo'yilmagan, preserve uni yaratmaydi ham, o'chirmaydi ham). Windows'da `plan`/`apply` uchun
SDK CLI versiyasini `_` env orqali tekshiradi: PowerShell'da
`$env:_ = "$env:APPDATA
pm
ode_modules@railwaycliinailway.exe"; & $env:_ config plan`.

## Production'ga chiqarish

1. PR `feat/admin` → `main`, CI yashil bo'lgach merge.
2. Deploy: `railway redeploy -s finTrack --from-source -y` (avtomatik deploy hali ishlamaydi).
   Pre-deploy 0005–0008 migratsiyalarini qo'llaydi (hammasi additiv; 0006 tarixiy faollikni to'ldiradi).
3. Botga `/id` yozib o'z Telegram ID'ingizni oling.
4. `railway variable set ADMIN_TELEGRAM_IDS=<id> -s finTrack` — o'zgaruvchi qo'yilishi qayta deploy qiladi.
5. Qo'lda tekshirish: `/admin` → 404; `/admin/login` → bot "🛡 Admin panel" kodi → panel; boshqa Telegram
   hisobidan `admin_` havolasi → "havola eskirgan" va audit'da `LOGIN_DENIED`.

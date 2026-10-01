# 04 — API kontrakti

Barcha yo'llar: `/api/v1/...` (Telegram webhook va health ham shu prefiks ostida). Bu hujjat
**kontrakt** — implementatsiya bundan chetga chiqsa, avval hujjat o'zgartiriladi va tasdiqlanadi.
Sxemalarning manbasi: `packages/shared/src/schemas/*` (Zod), hujjat ular bilan mos turadi.

## Umumiy qoidalar

- **Pul** har doim tiyinda (1 so'm = 100 tiyin), JSONda **string**: `"4500000"` = 45 000 so'm.
- **Sana** `YYYY-MM-DD`; "bugun" foydalanuvchining vaqt zonasida (`User.timezone`) hisoblanadi.
- **Autentifikatsiya**: web — `httpOnly` cookie (`accessToken` 15 daq., `refreshToken` 7 kun,
  `/api/v1/auth` yo'liga bog'langan). Telegram Mini App — `Authorization: Bearer <accessToken>`.
  Ikkalasi kelsa **Bearer ustun**.
- **CSRF**: holatni o'zgartiruvchi har bir so'rovda (`POST/PATCH/PUT/DELETE`) `X-Requested-With`
  sarlavhasi majburiy, aks holda `403 CSRF_REJECTED`. Istisno: Telegram webhook.
- **Ownership**: boshqa foydalanuvchining resursi uchun **404**, 403 emas — mavjudligi oshkor bo'lmasin.

## Umumiy konvert

**Muvaffaqiyat**
```json
{ "success": true, "data": { } }
```

**Ro'yxat**
```json
{ "success": true, "data": [ ], "meta": { "page": 1, "limit": 20, "total": 137, "totalPages": 7 } }
```

**Xatolik**
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "Balansingiz yetarli emas",
    "details": { "currentBalance": "3000000", "requested": "4500000" }
  },
  "meta": { "requestId": "01J9...", "timestamp": "2026-08-29T10:00:00.000Z" }
}
```
`message` — foydalanuvchiga ko'rsatish mumkin bo'lgan o'zbekcha matn; stack trace hech qachon qaytmaydi.

## Xato kodlari

| Status | Kodlar |
|---|---|
| 400 | `VALIDATION_ERROR`, `OTP_INVALID` (`details.attemptsLeft`) |
| 401 | `UNAUTHENTICATED`, `TOKEN_REUSE_DETECTED`, `REFRESH_RACE`, `TELEGRAM_INIT_DATA_INVALID`, `TELEGRAM_INIT_DATA_EXPIRED` |
| 403 | `FORBIDDEN`, `CSRF_REJECTED`, `TELEGRAM_NOT_REGISTERED` |
| 404 | `NOT_FOUND` — topilmadi **yoki** boshqa foydalanuvchiniki |
| 409 | `CONFLICT`, `CONCURRENT_UPDATE`, `ACCOUNT_EXISTS`, `ACCOUNT_HAS_HISTORY`, `CATEGORY_EXISTS`, `TAG_EXISTS`, `BUDGET_EXISTS`, `DEBT_ALREADY_PAID`, `RECURRING_ALREADY_RAN` |
| 413 | `PAYLOAD_TOO_LARGE` (tana > 1 MB) |
| 422 | `INSUFFICIENT_BALANCE`, `DEBT_OVERPAYMENT`, `INVALID_CATEGORY_TYPE`, `INVALID_CATEGORY_DEPTH`, `CIRCULAR_CATEGORY`, `INVALID_TRANSACTION_TYPE`, `INVALID_REFERENCE`, `MANAGED_TRANSACTION`, `SAME_ACCOUNT_TRANSFER`, `SYSTEM_CATEGORY`, `FUTURE_DATE`, `ACCOUNT_ARCHIVED`, `LAST_ACCOUNT`, `EXPORT_TOO_LARGE`, `RECURRING_INACTIVE`, `OTP_EXPIRED` |
| 429 | `RATE_LIMITED`, `OTP_ATTEMPTS_EXCEEDED`, `OTP_RESEND_LIMIT` |
| 500 | `INTERNAL_ERROR` |
| 503 | `SERVICE_UNAVAILABLE` (DB/Redis), `TELEGRAM_UNAVAILABLE` (bot sozlanmagan) |

---

## Endpointlar ro'yxati (77 ta)

✅ — sessiya kerak · ❌ — ochiq · 🍪 — refresh cookie · 🤖 — Telegram webhook sirli tokeni

### Auth (9)
| Metod | Yo'l | Auth | Vazifasi |
|---|---|---|---|
| POST | `/auth/telegram/start` | ❌ | kirish so'rovini ochish, bot deep link'ini olish |
| GET | `/auth/telegram/status/:requestId` | ❌ | so'rov holati (sahifa ~2 s da so'raydi) |
| POST | `/auth/telegram/verify` | ❌ | bot yuborgan 6 xonali kod → sessiya cookie'lari |
| POST | `/auth/telegram/resend` | ❌ | kodni qayta yuborish |
| POST | `/auth/telegram/webapp` | ❌ | Mini App: imzolangan `initData` → access token |
| POST | `/auth/refresh` | 🍪 | refresh token rotatsiyasi |
| POST | `/auth/logout` | 🍪 | joriy sessiyani yakunlash |
| POST | `/auth/logout-all` | ✅ | barcha sessiyalarni yakunlash |
| GET | `/auth/me` | ✅ | joriy foydalanuvchi |

Email/parol bilan ro'yxatdan o'tish va kirish **yo'q**: hisob faqat Telegram orqali ochiladi.

### Users (6)
`GET /users/me` · `PATCH /users/me` · `GET /users/me/sessions` · `DELETE /users/me/sessions/:id` ·
`POST /users/me/telegram/link` · `DELETE /users/me`

### Accounts (7)
`GET /accounts` · `GET /accounts/:id` · `POST /accounts` · `PATCH /accounts/:id` ·
`DELETE /accounts/:id` · `POST /accounts/:id/archive` · `PATCH /accounts/reorder`

### Categories (6)
`GET /categories` (daraxt) · `GET /categories/:id` · `POST /categories` ·
`PATCH /categories/:id` · `DELETE /categories/:id` · `PATCH /categories/reorder`

### Tags (4)
`GET /tags` · `POST /tags` · `PATCH /tags/:id` · `DELETE /tags/:id`

### Transactions (7)
`GET /transactions` · `GET /transactions/:id` · `POST /transactions` ·
`PATCH /transactions/:id` · `DELETE /transactions/:id` · `POST /transactions/bulk-delete` ·
`POST /transactions/:id/restore`

### Transfers (2)
`POST /transfers` · `DELETE /transfers/:groupId` (ikkala yozuv birga bekor qilinadi)

### Debts (9)
`GET /debts` · `GET /debts/:id` · `POST /debts` · `PATCH /debts/:id` · `DELETE /debts/:id` ·
`GET /debts/:id/payments` · `POST /debts/:id/payments` · `DELETE /debts/:id/payments/:paymentId` ·
`POST /debts/:id/settle`

### Budgets (5)
`GET /budgets?month=` · `GET /budgets/status?month=` · `POST /budgets` · `PATCH /budgets/:id` ·
`DELETE /budgets/:id`

### Recurring (6)
`GET /recurring?isActive=` · `GET /recurring/:id` · `POST /recurring` · `PATCH /recurring/:id` ·
`DELETE /recurring/:id` · `POST /recurring/:id/run-now`

### Stats (7)
`GET /stats/summary` · `GET /stats/timeseries` · `GET /stats/by-category` ·
`GET /stats/by-account` · `GET /stats/balance-trend` · `GET /stats/debts` · `GET /stats/compare`

### Notifications (4)
`GET /notifications` · `PATCH /notifications/:id/read` · `POST /notifications/read-all` ·
`DELETE /notifications/:id`

### Export (2)
`GET /export/transactions.csv` · `GET /export/transactions.xlsx`

### Telegram (1)
`POST /telegram/webhook` 🤖 — `X-Telegram-Bot-Api-Secret-Token` noto'g'ri bo'lsa `404`.

### Health (2)
`GET /health` (jarayon tirik) · `GET /health/ready` (DB + Redis; ishlamasa `503`)

---

## Telegram orqali kirish

### `POST /auth/telegram/start`
Tana yo'q. `201`:
```json
{ "success": true, "data": {
  "requestId": "5546d5a9-…", "deepLink": "https://t.me/fintrack_bot?start=login_MKv1Q…",
  "botUsername": "fintrack_bot", "expiresAt": "2026-09-28T09:22:44.208Z" } }
```
So'rov 5 daqiqa amal qiladi. Bot sozlanmagan bo'lsa `503 TELEGRAM_UNAVAILABLE`.

### `GET /auth/telegram/status/:requestId`
```json
{ "success": true, "data": { "status": "CODE_SENT", "codeExpiresAt": "2026-09-28T09:20:44.000Z" } }
```
`status`: `PENDING` → (`AWAITING_CONTACT`) → `CODE_SENT` → `CONSUMED` | `CANCELLED` | `EXPIRED`.
Yangi foydalanuvchi botda o'z raqamini ulashadi (`AWAITING_CONTACT`), shundan keyin hisob
(10 ta standart kategoriya + "Naqd pul" hisobi) yaratiladi va kod yuboriladi.

### `POST /auth/telegram/verify`
```json
{ "requestId": "5546d5a9-…", "code": "482913" }
```
`200` — `accessToken` va `refreshToken` httpOnly cookie sifatida o'rnatiladi, javobda `{ "user": … }`.
Kod 3 daqiqa amal qiladi, bir marta ishlatiladi. Xatolar: `400 OTP_INVALID` (`details.attemptsLeft`),
5-urinishdan keyin `429 OTP_ATTEMPTS_EXCEEDED`, muddati o'tgan yoki ishlatilgan — `422 OTP_EXPIRED`.
Muvaffaqiyatli kirishdan so'ng bot "yangi kirish" ogohlantirishini yuboradi.

### `POST /auth/telegram/webapp`
```json
{ "initData": "query_id=…&user=%7B%22id%22%3A…%7D&auth_date=1790576272&hash=…" }
```
`200` (cookie o'rnatilmaydi — Telegram webview'ida ular ishonchsiz):
```json
{ "success": true, "data": { "user": { … }, "accessToken": "eyJ…", "accessTokenExpiresIn": 900 } }
```
`initData` bot tokeni bilan HMAC orqali tekshiriladi, 24 soat amal qiladi. Har bir Mini App ochilishi
bitta sessiya (sessiyalar ro'yxatida "Telegram ilovasi"); token muddati tugasa ilova xuddi shu
`initData` ni qayta almashtiradi. Xatolar: `401 TELEGRAM_INIT_DATA_INVALID`,
`401 TELEGRAM_INIT_DATA_EXPIRED`, `403 TELEGRAM_NOT_REGISTERED` (avval botda ro'yxatdan o'tish kerak).

### `POST /auth/refresh`
Cookie'dagi refresh token tekshiriladi, bekor qilinadi, yangisi beriladi. Allaqachon almashtirilgan
token 30 soniya ichida kelsa (ikki tab bir vaqtda) — `401 REFRESH_RACE`, so'rovni qaytarish kifoya;
undan keyin kelsa — butun oila bekor qilinadi, `401 TOKEN_REUSE_DETECTED`.

### `GET /auth/me` → `data.user`
```json
{
  "id": "8f1a…", "name": "Aziz", "email": null, "telegramUsername": "aziz",
  "telegramLinked": true, "phone": "+99890***4567", "avatarUrl": null,
  "baseCurrency": "UZS", "locale": "uz", "timezone": "Asia/Tashkent", "strictMode": false,
  "notifyTelegram": true, "dailyDigest": false, "createdAt": "2026-08-29T09:12:00.000Z"
}
```
Telefon raqami hech qachon to'liq qaytmaydi.

## Users

- `PATCH /users/me` — `{ name?, locale?, timezone?, strictMode?, notifyTelegram?, dailyDigest? }` (`.strict()`), `200 { user }`.
- `GET /users/me/sessions` — `[{ id, userAgent, ipAddress, createdAt, lastUsedAt, expiresAt, isCurrent }]`.
- `DELETE /users/me/sessions/:id` — `204`; o'sha sessiyaning tokenlari darhol ishlamay qoladi.
- `POST /users/me/telegram/link` — eski (email) hisobni Telegram'ga ulash: `{ requestId, deepLink, expiresAt }`.
- `DELETE /users/me` — `{ "confirm": "O‘CHIRISH" }`; barcha ma'lumotlar atomar o'chiriladi, `200`, cookie'lar tozalanadi.

---

## Hisoblar va tranzaksiyalar

### `GET /accounts`
```json
{
  "success": true,
  "data": [
    { "id": "a1…", "name": "Humo karta", "type": "CARD", "currency": "UZS",
      "openingBalance": "0", "balance": "12550000", "icon": "💳", "color": "#6366f1",
      "isDefault": true, "sortOrder": 1, "archivedAt": null, "transactionCount": 87 }
  ],
  "meta": { "totalBalance": "18900000" }
}
```
`balance` — ledgerdan hisoblanadi, bazada ustun emas. `DELETE /accounts/:id`: tarixi bor hisob uchun
`409 ACCOUNT_HAS_HISTORY` (arxivlash taklif qilinadi); oxirgi faol hisob — `422 LAST_ACCOUNT`.
Arxivlangan hisobga yozuv — `422 ACCOUNT_ARCHIVED`.

### `POST /transfers`
```json
{ "fromAccountId": "a1…", "toAccountId": "a2…", "amount": "5000000", "date": "2026-08-29", "note": "Kartaga" }
```
`201` — `transferGroupId`, `out`, `in` yozuvlari va yangi balanslar. Xatolar: `422 SAME_ACCOUNT_TRANSFER`,
`422 INSUFFICIENT_BALANCE` (qat'iy rejim), `404` — hisob boshqa foydalanuvchiniki.

### `GET /transactions`
Query: `page` (1), `limit` (20, max 100), `type`, `accountId`, `categoryId`, `tagId`, `from`, `to`,
`minAmount`, `maxAmount`, `search`, `sort` (`date:desc`).
```json
{
  "success": true,
  "data": [
    { "id": "t1…", "type": "EXPENSE", "amount": "4500000", "date": "2026-08-15", "note": "Oilaviy xarid",
      "account": { "id": "a1…", "name": "Humo karta", "icon": "💳" },
      "category": { "id": "c1…", "name": "Oziq-ovqat", "icon": "🍔", "color": "#ef4444" },
      "tags": [{ "id": "g1…", "name": "oila", "color": "#94a3b8" }],
      "debtId": null, "transferGroupId": null, "createdAt": "2026-08-15T10:23:00.000Z" }
  ],
  "meta": { "page": 1, "limit": 20, "total": 137, "totalPages": 7,
            "sums": { "income": "500000000", "expense": "437500000" } }
}
```
`meta.sums` — **filtr bo'yicha** jami (joriy sahifa emas).

### `POST /transactions`
```json
{ "type": "EXPENSE", "accountId": "a1…", "amount": "4500000", "categoryId": "c1…",
  "date": "2026-08-15", "note": "Oilaviy xarid", "tagIds": ["g1…"] }
```
`INCOME`/`EXPENSE` uchun `categoryId` majburiy va turi mos bo'lishi shart (`422 INVALID_CATEGORY_TYPE`);
`LOAN_*`, `TRANSFER_*` bu yerda yaratilmaydi (`422 INVALID_TRANSACTION_TYPE`); kelajakdagi sana —
`422 FUTURE_DATE`. `201`:
```json
{ "success": true, "data": {
  "transaction": { … }, "accountBalance": "8050000", "totalBalance": "14400000",
  "budgetAlert": { "categoryId": "c1…", "percent": 92.4, "limit": "200000000", "spent": "184800000" } } }
```
`budgetAlert` — faqat chegara oshganda, aks holda `null`.

**Boshqariladigan yozuvlar.** `PATCH`, `DELETE`, `bulk-delete` va `restore` faqat `INCOME`/`EXPENSE`
uchun. O'tkazma va qarz yozuvlari uchun `422 MANAGED_TRANSACTION` (`details.transferGroupId` yoki
`details.debtId`) — ular `DELETE /transfers/:groupId` yoki qarz endpointlari orqali o'zgaradi.

---

## Qarzlar

### `POST /debts`
```json
{ "direction": "I_LENT", "personName": "Jasur", "personPhone": "+998901234567", "accountId": "a1…",
  "amount": "50000000", "date": "2026-08-29", "dueDate": "2026-09-01", "note": "To'yga" }
```
`$transaction` ichida: `Debt` + ledger yozuvi (`I_LENT` → `LOAN_GIVEN`, `I_BORROWED` → `LOAN_TAKEN`).
`date` bo'lmasa — bugun. `201`: `{ debt, transaction, totalBalance }`; `debt` obyektida `paidAmount`,
`remainingAmount`, `status` (`ACTIVE` | `PARTIALLY_PAID` | `PAID`), `isOverdue`, `daysLeft`.

### `POST /debts/:id/payments`
```json
{ "amount": "20000000", "accountId": "a1…", "paidAt": "2026-08-29", "note": "birinchi qism" }
```
`201`: `{ payment, debt, transaction, totalBalance }`. Qoldiq qulflangan holda qayta hisoblanadi:
ortiqcha summa — `422 DEBT_OVERPAYMENT`, **hech narsa o'zgarmaydi**; to'langan qarz — `409 DEBT_ALREADY_PAID`.
`POST /debts/:id/settle` — `{ accountId, paidAt?, note? }`, qoldiqning hammasi.
`DELETE /debts/:id/payments/:paymentId` — to'lov va uning ledger yozuvi atomar bekor qilinadi, status qayta hisoblanadi.

### `GET /debts`
Query: `direction`, `status`, `overdue=true`, `page`, `limit`. `meta.summary`:
`{ owedToMe, iOwe, net, overdueCount }`.

## Takroriy to'lovlar

### `POST /recurring`
```json
{ "accountId": "a1…", "categoryId": "c1…", "type": "EXPENSE", "amount": "150000000",
  "frequency": "MONTHLY", "dayOfCycle": 5, "startsAt": "2026-09-05", "endsAt": null, "note": "Ijara" }
```
`frequency`: `DAILY` | `WEEKLY` (`dayOfCycle` 1–7, dushanba = 1) | `MONTHLY` (1–31; qisqa oyda oyning
oxirgi kuni) | `YEARLY` (sana `startsAt` dan). O'tgan davrlar to'ldirilmaydi; birinchi to'lov kuni bugun
bo'lsa, u darhol yoziladi. Javob:
```json
{ "id": "r1…", "accountId": "a1…", "categoryId": "c1…", "type": "EXPENSE", "amount": "150000000",
  "frequency": "MONTHLY", "dayOfCycle": 5, "startsAt": "2026-09-05", "endsAt": null,
  "nextRunAt": "2026-10-05", "isActive": true, "note": "Ijara",
  "account": { "id": "a1…", "name": "Humo karta", "icon": "💳" },
  "category": { "id": "c1…", "name": "Uy-joy", "icon": "🏠", "color": "#84cc16" },
  "createdAt": "…", "updatedAt": "…" }
```
`PATCH /recurring/:id` — `{ amount?, note?, isActive?, dayOfCycle?, endsAt? }`. Qayta faollashtirish yoki
kunni o'zgartirish jadvalni bugundan qayta hisoblaydi (o'tgan davrlar yozilmaydi).
`POST /recurring/:id/run-now` — bugungi to'lov; nofaol qoida — `422 RECURRING_INACTIVE`, bugungi yozuv
o'chirilgan bo'lsa — `409 RECURRING_ALREADY_RAN`.

---

## Statistika

### `GET /stats/summary?from=2026-08-01&to=2026-08-31`
```json
{ "success": true, "data": {
  "totalBalance": "12550000", "isNegative": false,
  "periodIncome": "500000000", "periodExpense": "437500000", "periodNet": "62500000", "spentPercent": 87.5,
  "byAccount": [{ "accountId": "a1…", "name": "Humo karta", "balance": "8050000" }],
  "debt": { "owedToMe": "30000000", "iOwe": "20000000", "net": "10000000", "overdueCount": 1 },
  "topCategory": { "id": "c1…", "name": "Oziq-ovqat", "amount": "180000000" },
  "transactionCount": 42,
  "previousPeriod": { "income": "500000000", "expense": "398000000", "changePercent": 9.9 } } }
```
Qarz yozuvlari kirim/chiqimga **kirmaydi** — faqat `INCOME` va `EXPENSE`.

### `GET /stats/timeseries?groupBy=day&from=&to=`
`groupBy`: `day` | `week` | `month` | `year`. Bo'sh davrlar `0` bilan to'ldiriladi. Oraliq cheklangan
(`day` uchun ≤ 400 kun), aks holda `400 VALIDATION_ERROR`.

### `GET /stats/by-category?type=EXPENSE&from=&to=`
`{ total, items: [{ categoryId, name, icon, color, amount, percent, count, children[] }] }`.

### `GET /stats/compare?currentFrom=&currentTo=&previousFrom=&previousTo=`
```json
{ "success": true, "data": {
  "current":  { "from": "2026-09-01", "to": "2026-09-28", "income": "800000000", "expense": "300000000", "net": "500000000", "transactionCount": 12 },
  "previous": { "from": "2026-08-01", "to": "2026-08-28", "income": "0", "expense": "200000000", "net": "-200000000", "transactionCount": 7 },
  "changes": { "incomeChange": "800000000", "incomeChangePercent": 100, "expenseChange": "100000000",
               "expenseChangePercent": 50, "netChange": "700000000", "netChangePercent": 350 },
  "byCategory": [{ "categoryId": "c1…", "name": "Transport", "icon": "🚗", "color": "#f97316",
                   "currentAmount": "300000000", "previousAmount": "200000000", "change": "100000000", "changePercent": 50 }] } }
```
Oldingi qiymat 0 va joriysi musbat bo'lsa `changePercent` = 100 (UI buni "yangi" deb ko'rsatadi).
`byCategory` — faqat xarajatlar, joriy summa bo'yicha kamayish tartibida.

### `GET /budgets/status?month=2026-08`
```json
{ "success": true,
  "data": [{ "id": "b1…", "category": { "id": "c1…", "name": "Oziq-ovqat", "icon": "🍔", "color": "#ef4444" },
             "limitAmount": "200000000", "spent": "184800000", "remaining": "15200000", "percent": 92.4, "state": "WARNING" }],
  "meta": { "month": "2026-08", "totalLimit": "500000000", "totalSpent": "437500000" } }
```
`state`: `OK` (< 80) · `WARNING` (80–100) · `EXCEEDED` (> 100). Subkategoriyalar xarajati ota kategoriya
byudjetiga qo'shiladi.

## Eksport
`GET /export/transactions.csv` va `.xlsx` — `GET /transactions` filtrlari bilan. Formula injection'ga
qarshi hujayralar tozalanadi; juda katta natija — `422 EXPORT_TOO_LARGE` (oraliqni qisqartirish kerak).

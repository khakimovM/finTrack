# 04 — API kontrakti

Barcha yo'llar: `/api/v1/...`. Bu hujjat **kontrakt** — implementatsiya bundan chetga
chiqsa, avval hujjat o'zgartiriladi va tasdiqlanadi.

## Umumiy konvert

**Muvaffaqiyat**
```json
{ "success": true, "data": { } }
```

**Ro'yxat**
```json
{
  "success": true,
  "data": [ ],
  "meta": { "page": 1, "limit": 20, "total": 137, "totalPages": 7 }
}
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

## Status kodlar

| Kod | Qachon |
|---|---|
| 200 / 201 / 204 | o'qish-yangilash / yaratish / o'chirish |
| 400 `VALIDATION_ERROR` | Zod validatsiyasi yiqildi |
| 401 `UNAUTHENTICATED` | token yo'q, yaroqsiz yoki muddati tugagan |
| 404 `NOT_FOUND` | topilmadi **yoki** boshqa foydalanuvchiniki |
| 409 `EMAIL_TAKEN`, `CATEGORY_EXISTS`, `ACCOUNT_EXISTS`, `DEBT_ALREADY_PAID` | konflikt |
| 422 `INSUFFICIENT_BALANCE`, `DEBT_OVERPAYMENT`, `INVALID_CATEGORY_TYPE`, `SAME_ACCOUNT_TRANSFER`, `SYSTEM_CATEGORY` | biznes qoidasi buzildi |
| 429 `RATE_LIMITED` | limitdan oshdi |
| 500 `INTERNAL_ERROR` | kutilmagan xato (stack trace hech qachon qaytmaydi) |

> **Muhim:** boshqa foydalanuvchining resursi uchun **404**, 403 emas — mavjudligi oshkor bo'lmasin.

---

## Endpointlar ro'yxati (72 ta)

### Auth (9)
| Metod | Yo'l | Auth | Vazifasi |
|---|---|---|---|
| POST | `/auth/register` | ❌ | ro'yxatdan o'tish |
| POST | `/auth/login` | ❌ | kirish |
| POST | `/auth/refresh` | 🍪 | tokenni rotatsiya qilish |
| POST | `/auth/logout` | ✅ | joriy sessiyadan chiqish |
| POST | `/auth/logout-all` | ✅ | barcha sessiyalardan chiqish |
| GET | `/auth/me` | ✅ | joriy foydalanuvchi |
| POST | `/auth/forgot-password` | ❌ | tiklash havolasi |
| POST | `/auth/reset-password` | ❌ | yangi parol |
| POST | `/auth/verify-email` | ❌ | emailni tasdiqlash |

### Users (5)
`PATCH /users/me` · `PATCH /users/me/password` · `GET /users/me/sessions` ·
`DELETE /users/me/sessions/:id` · `DELETE /users/me`

### Accounts (7)
`GET /accounts` · `GET /accounts/:id` · `POST /accounts` · `PATCH /accounts/:id` ·
`DELETE /accounts/:id` · `POST /accounts/:id/archive` · `PATCH /accounts/reorder`

### Categories (6)
`GET /categories` (tree) · `GET /categories/:id` · `POST /categories` ·
`PATCH /categories/:id` · `DELETE /categories/:id` · `PATCH /categories/reorder`

### Tags (4)
`GET /tags` · `POST /tags` · `PATCH /tags/:id` · `DELETE /tags/:id`

### Transactions (7)
`GET /transactions` · `GET /transactions/:id` · `POST /transactions` ·
`PATCH /transactions/:id` · `DELETE /transactions/:id` · `POST /transactions/bulk-delete` ·
`POST /transactions/:id/restore`

### Transfers (2)
`POST /transfers` · `DELETE /transfers/:groupId`

### Debts (8)
`GET /debts` · `GET /debts/:id` · `POST /debts` · `PATCH /debts/:id` · `DELETE /debts/:id` ·
`GET /debts/:id/payments` · `POST /debts/:id/payments` · `POST /debts/:id/settle`

### Budgets (5)
`GET /budgets?month=` · `POST /budgets` · `PATCH /budgets/:id` · `DELETE /budgets/:id` ·
`GET /budgets/status?month=`

### Recurring (6)
`GET /recurring` · `GET /recurring/:id` · `POST /recurring` · `PATCH /recurring/:id` ·
`DELETE /recurring/:id` · `POST /recurring/:id/run-now`

### Stats (7)
`GET /stats/summary` · `GET /stats/timeseries` · `GET /stats/by-category` ·
`GET /stats/by-account` · `GET /stats/balance-trend` · `GET /stats/debts` ·
`GET /stats/compare` (davrlarni solishtirish)

### Notifications (4)
`GET /notifications` · `PATCH /notifications/:id/read` · `POST /notifications/read-all` ·
`DELETE /notifications/:id`

### Export (2)
`GET /export/transactions.csv` · `GET /export/transactions.xlsx`

### Health (2)
`GET /health` · `GET /health/ready`

---

## Batafsil namunalar

### `POST /auth/register`
```json
{ "name": "Aziz Karimov", "email": "aziz@mail.uz", "password": "Parol123!" }
```
`201` — `accessToken` va `refreshToken` httpOnly cookie sifatida o'rnatiladi:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "8f1a...", "name": "Aziz Karimov", "email": "aziz@mail.uz",
      "baseCurrency": "UZS", "locale": "uz", "strictMode": false,
      "createdAt": "2026-08-29T09:12:00.000Z"
    }
  }
}
```
Server: emailni tekshiradi → bcrypt(12) → `User` → **10 ta standart kategoriya** →
**"Naqd pul" default hisobi** → tokenlar. `409 EMAIL_TAKEN` band bo'lsa.

### `POST /auth/login`
```json
{ "email": "aziz@mail.uz", "password": "Parol123!" }
```
`200` — register bilan bir xil. Xato bo'lsa har doim bitta xabar:
`401 INVALID_CREDENTIALS` — email topilmagani va parol xatoligini **ajratmang**.

### `POST /auth/refresh`
Cookie'dagi refresh token tekshiriladi, bekor qilinadi, yangisi beriladi.
Allaqachon almashtirilgan token kelsa → butun oila bekor qilinadi, `401 TOKEN_REUSE_DETECTED`.

---

### `GET /accounts`
```json
{
  "success": true,
  "data": [
    {
      "id": "a1...", "name": "Humo karta", "type": "CARD", "currency": "UZS",
      "openingBalance": "0", "balance": "12550000",
      "icon": "💳", "color": "#6366f1", "isDefault": true,
      "archivedAt": null, "transactionCount": 87
    }
  ],
  "meta": { "totalBalance": "18900000" }
}
```
`balance` — hisoblangan qiymat, bazada ustun emas.

### `POST /transfers`
```json
{ "fromAccountId": "a1...", "toAccountId": "a2...", "amount": "5000000",
  "date": "2026-08-29", "note": "Kartaga o'tkazdim" }
```
`201`:
```json
{
  "success": true,
  "data": {
    "transferGroupId": "tg_01J9...",
    "out": { "id": "t1...", "type": "TRANSFER_OUT", "accountId": "a1...", "amount": "5000000" },
    "in":  { "id": "t2...", "type": "TRANSFER_IN",  "accountId": "a2...", "amount": "5000000" },
    "balances": { "a1...": "7550000", "a2...": "11350000", "total": "18900000" }
  }
}
```
Xatolar: `422 SAME_ACCOUNT_TRANSFER`, `422 INSUFFICIENT_BALANCE` (strictMode),
`404` — hisob boshqa foydalanuvchiniki.

---

### `GET /transactions`
Query: `page` (1), `limit` (20, max 100), `type`, `accountId`, `categoryId`, `tagId`,
`from`, `to`, `minAmount`, `maxAmount`, `search`, `sort` (`date:desc`).

```json
{
  "success": true,
  "data": [
    {
      "id": "t1...", "type": "EXPENSE", "amount": "4500000",
      "date": "2026-08-15", "note": "Oilaviy xarid",
      "account":  { "id": "a1...", "name": "Humo karta", "icon": "💳" },
      "category": { "id": "c1...", "name": "Oziq-ovqat", "icon": "🍔", "color": "#ef4444" },
      "tags": [{ "id": "g1...", "name": "oila", "color": "#94a3b8" }],
      "debtId": null, "transferGroupId": null,
      "createdAt": "2026-08-15T10:23:00.000Z"
    }
  ],
  "meta": {
    "page": 1, "limit": 20, "total": 137, "totalPages": 7,
    "sums": { "income": "500000000", "expense": "437500000" }
  }
}
```
`meta.sums` — **filtr bo'yicha** umumiy summa (joriy sahifa emas).

### `POST /transactions`
```json
{
  "type": "EXPENSE", "accountId": "a1...", "amount": "4500000",
  "categoryId": "c1...", "date": "2026-08-15",
  "note": "Oilaviy xarid", "tagIds": ["g1..."]
}
```
Validatsiya: `amount` > 0 butun son (string); `INCOME`/`EXPENSE` uchun `categoryId` majburiy
va `category.type === type`; `LOAN_*`, `TRANSFER_*` bu endpoint orqali **yaratilmaydi**
(`422 INVALID_TRANSACTION_TYPE`); `date` kelajakda bo'lmasin.

`201`:
```json
{
  "success": true,
  "data": {
    "transaction": { "id": "t9...", "type": "EXPENSE", "amount": "4500000", "date": "2026-08-15" },
    "accountBalance": "8050000",
    "totalBalance": "14400000",
    "budgetAlert": { "categoryId": "c1...", "percent": 92.4, "limit": "200000000", "spent": "184800000" }
  }
}
```
`budgetAlert` — faqat chegara oshgan bo'lsa, aks holda `null`.

`422` (strictMode yoqilgan):
```json
{ "success": false, "error": { "code": "INSUFFICIENT_BALANCE",
  "message": "Balansingiz yetarli emas",
  "details": { "accountId": "a1...", "currentBalance": "3000000", "requested": "4500000" } } }
```

---

### `POST /debts`
```json
{ "direction": "I_LENT", "personName": "Jasur", "personPhone": "+998901234567",
  "accountId": "a1...", "amount": "50000000", "dueDate": "2026-09-01", "note": "To'yga" }
```
Server `$transaction` ichida: `Debt` + ledger yozuvi
(`I_LENT` → `LOAN_GIVEN`, `I_BORROWED` → `LOAN_TAKEN`) + kesh invalidatsiyasi.

`201`:
```json
{
  "success": true,
  "data": {
    "debt": {
      "id": "d1...", "direction": "I_LENT", "personName": "Jasur",
      "amount": "50000000", "paidAmount": "0", "remainingAmount": "50000000",
      "dueDate": "2026-09-01", "status": "ACTIVE", "isOverdue": false, "daysLeft": 3
    },
    "transaction": { "id": "t20...", "type": "LOAN_GIVEN", "amount": "50000000" },
    "totalBalance": "9400000"
  }
}
```

### `POST /debts/:id/payments`
```json
{ "amount": "20000000", "accountId": "a1...", "paidAt": "2026-08-29", "note": "birinchi qism" }
```
`201`:
```json
{
  "success": true,
  "data": {
    "payment": { "id": "p1...", "amount": "20000000", "paidAt": "2026-08-29" },
    "debt": { "id": "d1...", "paidAmount": "20000000", "remainingAmount": "30000000",
              "status": "PARTIALLY_PAID" },
    "transaction": { "id": "t21...", "type": "LOAN_REPAY_IN", "amount": "20000000" },
    "totalBalance": "11400000"
  }
}
```
Qoldiqdan ko'p bo'lsa `422 DEBT_OVERPAYMENT` va **hech narsa o'zgarmaydi**.
Qoldiq 0 ga yetganda `status = PAID`, `paidAt` o'sha tranzaksiyada o'rnatiladi.

### `GET /debts`
Query: `direction`, `status`, `overdue=true`, `page`, `limit`.
```json
{
  "success": true,
  "data": [ /* debt obyektlari, remainingAmount va isOverdue bilan */ ],
  "meta": {
    "page": 1, "limit": 20, "total": 5, "totalPages": 1,
    "summary": { "owedToMe": "30000000", "iOwe": "20000000", "net": "10000000", "overdueCount": 1 }
  }
}
```

---

### `GET /stats/summary?from=2026-08-01&to=2026-08-31`
```json
{
  "success": true,
  "data": {
    "totalBalance": "12550000", "isNegative": false,
    "periodIncome": "500000000", "periodExpense": "437500000", "periodNet": "62500000",
    "spentPercent": 87.5,
    "byAccount": [{ "accountId": "a1...", "name": "Humo karta", "balance": "8050000" }],
    "debt": { "owedToMe": "30000000", "iOwe": "20000000", "net": "10000000", "overdueCount": 1 },
    "topCategory": { "id": "c1...", "name": "Oziq-ovqat", "amount": "180000000" },
    "transactionCount": 42,
    "previousPeriod": { "income": "500000000", "expense": "398000000", "changePercent": 9.9 }
  }
}
```

### `GET /stats/timeseries?groupBy=day&from=2026-08-01&to=2026-08-31`
`groupBy`: `day` | `week` | `month` | `year`.
```json
{
  "success": true,
  "data": [
    { "bucket": "2026-08-01", "income": "0",         "expense": "12000000", "net": "-12000000" },
    { "bucket": "2026-08-02", "income": "500000000", "expense": "3500000",  "net": "496500000" }
  ],
  "meta": { "groupBy": "day", "from": "2026-08-01", "to": "2026-08-31", "bucketCount": 31 }
}
```
**Bo'sh kunlar `0` bilan to'ldiriladi** — SQL ularni qaytarmaydi, backend to'ldiradi.
Bo'shliq qolsa grafik yolg'on ko'rsatadi.

SQL:
```sql
SELECT date_trunc($4, t.date)::date AS bucket,
       COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'INCOME'),  0) AS income,
       COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'EXPENSE'), 0) AS expense
FROM transactions t
WHERE t.user_id = $1 AND t.deleted_at IS NULL
  AND t.date BETWEEN $2 AND $3
  AND t.type IN ('INCOME','EXPENSE')
GROUP BY 1 ORDER BY 1;
```

### `GET /stats/by-category?type=EXPENSE&from=&to=`
```json
{
  "success": true,
  "data": {
    "total": "437500000",
    "items": [
      { "categoryId": "c1...", "name": "Oziq-ovqat", "icon": "🍔", "color": "#ef4444",
        "amount": "180000000", "percent": 41.1, "count": 18,
        "children": [{ "categoryId": "c11...", "name": "Restoran", "amount": "40000000", "percent": 9.1 }] }
    ]
  }
}
```

### `GET /budgets/status?month=2026-08`
```json
{
  "success": true,
  "data": [
    { "id": "b1...", "category": { "id": "c1...", "name": "Oziq-ovqat", "icon": "🍔", "color": "#ef4444" },
      "limitAmount": "200000000", "spent": "184800000", "remaining": "15200000",
      "percent": 92.4, "state": "WARNING" }
  ],
  "meta": { "month": "2026-08", "totalLimit": "500000000", "totalSpent": "437500000" }
}
```
`state`: `OK` (<80) · `WARNING` (80–100) · `EXCEEDED` (>100).

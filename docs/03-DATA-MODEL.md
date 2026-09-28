# 03 — Ma'lumotlar modeli

To'liq sxema: `apps/api/prisma/schema.prisma`. Bu hujjat **nima uchun** shundayligini tushuntiradi.

## Umumiy qoidalar

| Qoida | Sabab |
|---|---|
| Pul → `BigInt` (tiyin) | `0.1 + 0.2 !== 0.3`. Moliyaviy ilovada float — ma'lumot buzilishi |
| Sana → `DateTime @db.Date` | Vaqt komponenti timezone chalkashligini keltiradi |
| `userId` + `@@index([userId, ...])` | Har bir so'rov egasi bo'yicha filtrlanadi |
| `deletedAt` (soft delete) | Tranzaksiya tarixi yo'qolmaydi, tiklash mumkin |
| `@@map` snake_case | SQL tomonda o'qilishi qulay |

## Ledger — `Transaction`

Barcha pul harakati **bitta jadvalda**. Balans shu jadvaldan hosil qilinadi.

| type | Ishora | Statistikada | Ma'nosi |
|---|---|---|---|
| `INCOME` | + | ✅ kirim | oylik, qo'shimcha daromad |
| `EXPENSE` | − | ✅ chiqim | sarf |
| `TRANSFER_IN` | + | ❌ | o'z hisobiga tushdi |
| `TRANSFER_OUT` | − | ❌ | o'z hisobidan chiqdi |
| `LOAN_GIVEN` | − | ❌ | qarz berdim |
| `LOAN_TAKEN` | + | ❌ | qarz oldim |
| `LOAN_REPAY_IN` | + | ❌ | qarzdorim qaytardi |
| `LOAN_REPAY_OUT` | − | ❌ | qarzimni qaytardim |
| `ADJUSTMENT` | ± | ❌ | qo'lda tuzatish |

**Balans:**
```sql
SELECT a.opening_balance + COALESCE(SUM(
  CASE WHEN t.type IN ('INCOME','TRANSFER_IN','LOAN_TAKEN','LOAN_REPAY_IN')
       THEN t.amount ELSE -t.amount END
), 0) AS balance
FROM accounts a
LEFT JOIN transactions t
  ON t.account_id = a.id AND t.deleted_at IS NULL
WHERE a.user_id = $1 AND a.deleted_at IS NULL
GROUP BY a.id, a.opening_balance;
```

**Statistika** har doim `type IN ('INCOME','EXPENSE')` filtri bilan. Qarz doiraviy
diagrammada ko'rinsa — bu bag.

### Nega qarz xarajat emas?

Do'stingizga 500 000 so'm berdingiz: pulingiz kamaydi, lekin **sarflamadingiz** — u sizning
aktivingiz, vaqtincha boshqa odamda. Agar `EXPENSE` deb yozilsa, foydalanuvchi "bu oy 500
ming sarfladim" degan yolg'on ma'lumot oladi va byudjet hisobi buziladi.

## Transfer

Bitta amal → ikkita yozuv, umumiy `transferGroupId`:
`TRANSFER_OUT` (manba hisob) va `TRANSFER_IN` (maqsad hisob), teng summa, bitta
`prisma.$transaction`. Umumiy balans o'zgarmaydi. Bittasini o'chirish ikkalasini o'chiradi.

## Qarz va to'lovlar

```
Debt (principal)
 ├── Transaction        LOAN_GIVEN / LOAN_TAKEN     ← yaratilganda
 └── DebtPayment[]
      └── Transaction   LOAN_REPAY_IN / _OUT        ← har to'lovda
```

- `remainingAmount = Debt.amount − SUM(DebtPayment.amount)` — **hisoblanadi, saqlanmaydi**
- Qoldiq 0 ga yetganda `status = PAID`, `paidAt = now()` — **o'sha `$transaction` ichida**
- To'lov qoldiqdan ko'p bo'lsa → `422 DEBT_OVERPAYMENT`; qoldiq qarz qatori qulflangan holda
  (`SELECT … FOR UPDATE`) qayta hisoblanadi, parallel to'lovlar ortiqcha o'tib ketolmaydi
- To'lovni bekor qilish (`DELETE /debts/:id/payments/:paymentId`) to'lov va uning ledger yozuvini
  birga o'chiradi, status qayta hisoblanadi
- `isOverdue = status != PAID AND dueDate < today` — o'qish paytida, foydalanuvchi zonasida hisoblanadi
- Qarz o'chirilsa ledger yozuvlari kaskad o'chadi va balans o'z-o'zidan tiklanadi
- Qarz yozuvlarini `/transactions` orqali o'zgartirib bo'lmaydi — `422 MANAGED_TRANSACTION`

## Byudjet

`(userId, categoryId, month)` — unikal. `month` doim oyning 1-kuni. Faqat `EXPENSE` kategoriyasiga;
subkategoriyalar xarajati ota kategoriya byudjetiga qo'shiladi. Foiz `BigInt` bilan hisoblanadi.
`notifiedAt` maydoni oxirgi yuborilgan chegarani (0/80/100) saqlaydi va shartli `updateMany` bilan
o'rnatiladi — parallel yozuvlarda ham bildirishnoma bir marta ketadi; limit oshirilsa qayta hisoblanadi.

## Takrorlanuvchi qoida

`@@unique([recurringRuleId, date])` — worker qayta ishga tushsa ham o'sha kun uchun ikkinchi
tranzaksiya yaratilmaydi. Idempotentlikning butun mexanizmi shu bitta constraintda (o'chirilgan
yozuv ham hisoblanadi: foydalanuvchi o'chirgan to'lov qayta paydo bo'lmaydi).

- Orqada qolgan davrlar quvib yetiladi (bir ishga tushishda ≤ 366 ta), lekin yaratishda yoki
  qayta faollashtirishda o'tmish to'ldirilmaydi — jadval bugundan boshlanadi.
- Qat'iy rejimda mablag' yetmasa, davr o'tkazib yuboriladi va `RECURRING_SKIPPED` bildirishnomasi yoziladi.
- Hisob o'chirilsa/arxivlansa qoida to'xtatiladi.

## Hisobni o'chirish

Tarixi (tranzaksiya, qarz yoki takroriy qoida) bor hisob o'chirilmaydi — `409 ACCOUNT_HAS_HISTORY`,
arxivlanadi (`archivedAt`): balansi hisobotlarda qoladi, yangi yozuv qabul qilmaydi. Tarixsiz hisob
butunlay o'chiriladi. Oxirgi faol hisobni o'chirib/arxivlab bo'lmaydi.

## Foydalanuvchi va Telegram

- `User.telegramId` (`@unique`) — asosiy identifikator: kirish faqat Telegram orqali (0004 migratsiyasidan).
  `email`/`passwordHash` faqat eski hisoblar uchun qolgan, nullable.
- `User.phone` (`@unique`) — botda **o'z** kontaktini ulashganda yoziladi (kontakt egasi = yozuvchi
  tekshiriladi); API uni faqat maskalangan holda qaytaradi.
- `notifyTelegram`, `dailyDigest` — bot bildirishnomalari; `telegramBlockedAt` — foydalanuvchi botni
  bloklagan (Telegram 403): unga fon xabarlari yuborilmaydi, yangi xabar yozsa tozalanadi.
- `timezone` — "bugun" shu zonada hisoblanadi (qarz muddati, takroriy to'lov, `FUTURE_DATE`).

## Telegram orqali kirish — `TelegramLoginRequest`

Bitta kirish urinishi. Deep link'dagi `nonce` faqat hash ko'rinishida (`nonceHash @unique`) saqlanadi;
kod ham `HMAC(requestId:code, OTP_SECRET)` — ochiq holda hech qayerda yo'q. Kod so'rovga bog'langan,
3 daqiqa amal qiladi, 5 urinish (`attempts`, qator qulfi ostida hisoblanadi), bir marta ishlatiladi.
`status`: `PENDING` → `AWAITING_CONTACT` → `CODE_SENT` → `CONSUMED` | `CANCELLED` | `EXPIRED`.

## Bildirishnomalar

`@@unique([userId, dedupeKey])` — bir hodisa (masalan, "Transport byudjeti sentabrda 80%") bir marta
yoziladi, parallel yozuvlar yoki qayta ishga tushgan job ham ikkinchisini yarata olmaydi.
`telegramSentAt` — outbox navbati xabarni Telegram'ga yuborgach belgilaydi (qayta urinishda ikki marta ketmaydi).

## Refresh token va sessiyalar

Token **hashlangan** holda saqlanadi (baza o'g'irlansa ham foydasiz). `familyId` bir
qurilmadagi ketma-ket tokenlarni bog'laydi = **bitta sessiya**. Allaqachon almashtirilgan token
qayta ishlatilsa, butun oila bekor qilinadi — bu o'g'irlangan tokenni aniqlash usuli (30 soniyalik
"ikki tab" oynasidan tashqari). Mini App sessiyasi ham oila: uning qatori hech kimga berilmaydigan
token bilan yaratiladi, faqat sessiyalar ro'yxatida ko'rinishi va bekor qilinishi uchun.

## Indekslar

`(userId, date)`, `(userId, type, date)`, `(accountId, date)`, `(categoryId)`,
`(userId, status, deletedAt)`, `(userId, dueDate)`, `(transferGroupId)`,
`(nextRunAt, isActive)`.

Yangi filtr qo'shsangiz — mos indeks ham qo'shiladi. Kompozit indeks tartibi:
`(userId, filtr, saralash)`.

## Ko'p valyuta (8-bosqich)

`Account.currency` + `ExchangeRate`. Tranzaksiya `amount` (hisob valyutasida) va
`amountBase` (foydalanuvchi bazaviy valyutasida, **o'sha kun kursida qotirilgan**) saqlaydi.
Eski yozuvlar hech qachon qayta konvertatsiya qilinmaydi. Statistika `amountBase` bo'yicha.

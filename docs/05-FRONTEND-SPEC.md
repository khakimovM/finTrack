# 05 — Frontend spetsifikatsiyasi

## Sahifalar

| Yo'l | Sahifa | Auth |
|---|---|---|
| `/login`, `/register`, `/forgot-password`, `/reset-password` | auth | ❌ |
| `/app` | Dashboard | ✅ |
| `/app/transactions` | Tranzaksiyalar | ✅ |
| `/app/accounts` | Hisoblar | ✅ |
| `/app/debts` | Qarzlar | ✅ |
| `/app/budgets` | Byudjetlar | ✅ |
| `/app/categories` | Kategoriyalar | ✅ |
| `/app/recurring` | Takrorlanuvchi to'lovlar | ✅ |
| `/app/reports` | Hisobotlar va eksport | ✅ |
| `/app/settings` | Sozlamalar | ✅ |

## Routing

```tsx
createBrowserRouter([
  { path: '/', element: <AuthLayout />, children: [ /* login, register, ... */ ] },
  { path: '/app', element: <ProtectedRoute><RootLayout /></ProtectedRoute>,
    errorElement: <ErrorPage />,
    children: [ { index: true, element: <DashboardPage /> }, /* ... */ ] },
  { path: '*', element: <NotFoundPage /> },
]);
```
`main.tsx`: `QueryClientProvider` → `RouterProvider` (shu tartibda).
`ProtectedRoute` `GET /auth/me` javobini kutadi; yuklanayotganda to'liq ekranli skeleton.

## State chegarasi

| Ma'lumot | Qayerda |
|---|---|
| tranzaksiya, kategoriya, hisob, byudjet, qarz, statistika, bildirishnoma | **React Query** |
| auth user, tema, til, sidebar holati, tanlangan davr, ochiq modal | **Zustand** |

Server ma'lumotini Zustandga ko'chirish — ushbu loyihadagi eng qattiq taqiq.

## Query kalitlari va invalidatsiya

| Mutatsiya | invalidateQueries |
|---|---|
| transaction create/update/delete/restore | `transactions`, `stats`, `accounts`, `budgets` |
| transfer create/delete | `transactions`, `accounts`, `stats` |
| debt create/delete | `debts`, `transactions`, `accounts`, `stats` |
| debt payment / settle | `debts`, `transactions`, `accounts`, `stats` |
| budget create/update/delete | `budgets`, `stats` |
| category create/update/delete | `categories`, `transactions`, `stats`, `budgets` |
| account create/update/archive | `accounts`, `transactions`, `stats` |
| recurring run-now | `recurring`, `transactions`, `accounts`, `stats` |

Ortiqcha invalidatsiya xavfsiz; yetishmagani foydalanuvchiga eski pulni ko'rsatadi.

## Dashboard

**Davr filtri** (sahifa yuqorisida, `periodStore` da): `Bugun · Shu hafta · Shu oy ·
Shu yil · Oraliq`. `{ from, to, groupBy }` ni barcha stats querylariga uzatadi.
Yillik davrda `groupBy` avtomatik `month` bo'ladi — 365 nuqta o'qilmaydi.

**KPI kartalar (4)**
| Karta | Manba | Rang qoidasi |
|---|---|---|
| Davr kirimi | `summary.periodIncome` | yashil |
| Davr chiqimi | `summary.periodExpense` | qizil |
| Umumiy balans | `summary.totalBalance` | manfiy → qizil + ⚠️ ikonka + minus belgisi |
| Qarz saldosi | `summary.debt.net` | musbat yashil, manfiy sariq |

Har kartada oldingi davr bilan farq: `↑ 9.9%` (`previousPeriod.changePercent`).

**Xarajat progress bar** — `spentPercent`: 0–70 yashil, 70–100 sariq, >100 qizil +
"Bu davrda kirimingizdan 12% ko'p sarfladingiz".

**Grafiklar**
1. Chiziqli — `stats/timeseries`, kirim (yashil) va chiqim (qizil)
2. Doiraviy — `stats/by-category?type=EXPENSE`, bo'lak rangi kategoriya rangida
3. Ustunli — kategoriyalar taqqoslash
4. Area — `stats/balance-trend`, balans dinamikasi
5. Byudjet progress barlari — `budgets/status`

**Pastda** — oxirgi 5 tranzaksiya + muddati yaqin qarzlar.

## Tranzaksiyalar sahifasi
Filtr paneli (sana oralig'i, tur, hisob, kategoriya, teg, summa oralig'i, qidiruv —
400 ms debounce, holat URL search paramsda saqlanadi, sahifa yangilansa ham qoladi).
Jadval: sana · hisob · kategoriya · izoh · teglar · summa · amallar.
Ko'p tanlash → ommaviy o'chirish. Sahifalash serverdan.
"+ Qo'shish" → modal (tur tanlash tab: Kirim / Chiqim / O'tkazma).
`meta.sums` filtr bo'yicha jami sifatida jadval tepasida ko'rsatiladi.

## Qarzlar sahifasi
Ikkita tab: **Menga qarzdor** / **Men qarzdorman**, har birida jami summa.
Karta: ism, umumiy summa, **qoldiq**, progress bar (to'langan ulush), muddat, status badge.
`isOverdue` → qizil "Muddati o'tgan (5 kun)"; `daysLeft ≤ 3` → sariq.
Amallar: "To'lov qo'shish" (qisman) va "To'liq to'landi". To'lovlar tarixi accordionda.
Filtr: `Barchasi · Faol · Qisman · To'langan · Muddati o'tgan`.

## Byudjetlar sahifasi
Oy tanlagich. Har kategoriya uchun progress bar: sarflangan / limit / qolgan.
Rang `state` bo'yicha (`OK`/`WARNING`/`EXCEEDED`). Limitni inline tahrirlash.

## Hisoblar sahifasi
Kartalar ro'yxati, har birida balans va tranzaksiya soni. Umumiy balans yuqorida.
"O'tkazma" tugmasi → modal (qaysi hisobdan, qaysisiga, summa).
Arxivlash (o'chirish emas) — tarix saqlanadi.

## Sozlamalar
Profil (ism, avatar), parol, til (uz/ru/en), mavzu, **qat'iy rejim** toggle:
> "Yoqilganda balansingizdan ortiq xarajat yozib bo'lmaydi. O'chirilganda balans manfiyga
> tushishi mumkin va qizil ko'rsatiladi."

Bazaviy valyuta, akkauntni o'chirish (matn bilan tasdiqlash).

## To'rt holat — majburiy
Har bir ma'lumotli ko'rinishda: **loading skeleton**, **error + qayta urinish**,
**empty + CTA**, **success**. Bittasi yo'q bo'lsa sahifa tayyor emas.

## Formatlash
- Pul: `1 250 000,00 so'm` — faqat `formatMoney` orqali
- Sana: `date-fns` + `uz` locale, `15-avgust, 2026`
- Manfiy qiymat: minus + rang + ikonka (faqat rang yetarli emas)
- Kirim `+`, chiqim `−` prefiksi

## Mobil (375px)
Jadval → kartalar; sidebar → `Sheet`; grafiklar gorizontal scroll konteynerida;
tap maydoni ≥ 44px; modal → pastdan chiquvchi sheet.

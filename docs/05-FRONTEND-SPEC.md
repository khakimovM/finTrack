# 05 — Frontend spetsifikatsiyasi

Dizayn manbasi — `design/` (Claude Design handoff): `fintrack-tokens.css`, `Handoff.dc.html`
(token → Tailwind jadvali va komponentlar), `App.dc.html` (butun ilova), `Landing`, `Login`,
`Mini App Screen`, `System Page`. Yangi ekran yoki holat qo'shishdan oldin o'sha yerdan qarang.

## Sahifalar

| Yo'l | Sahifa | Auth |
|---|---|---|
| `/` | Landing (birinchi kirgan odamni kutib oladi) | ❌ |
| `/login` | Telegram orqali kirish (kod botga keladi) | ❌ |
| `/register` | → `/login` (ro'yxatdan o'tish botda) | ❌ |
| `/app` | Bosh sahifa (dashboard) | ✅ |
| `/app/transactions` | Tranzaksiyalar | ✅ |
| `/app/accounts` | Hisoblar | ✅ |
| `/app/categories` | Kategoriyalar va teglar (`?tab=income`, `?tab=tags`) | ✅ |
| `/app/debts` | Qarzlar (`?debt=<id>` — o'sha qarzni ochib ko'rsatadi) | ✅ |
| `/app/budgets` | Byudjetlar (`?month=YYYY-MM`) | ✅ |
| `/app/recurring` | Takroriy to'lovlar | ✅ |
| `/app/reports` | Hisobotlar va eksport | ✅ |
| `/app/notifications` | Bildirishnomalar | ✅ |
| `/app/settings` | Sozlamalar | ✅ |
| `/dev/ui` | Komponentlar galereyasi (faqat `npm run dev`) | — |
| `*` | 404 | — |

Telegram Mini App ichida (`launchedFromTelegram()`) avval splash chiziladi, keyin `initData`
bilan kiriladi; ro'yxatdan o'tmagan / sessiya tugagan / xato holatlari uchun alohida ekranlar bor.

## Qobiq (`components/layout`)

- `AppShell`: ≥1200px — 268px sidebar, 640–1199px — 84px rail (foydalanuvchi almashtira oladi),
  <640px — pastki `TabBar` (markazda "+") va "Ko'proq" sheet.
- `PageHeader`: har sahifada bitta `h1`, sticky va blur. Telefonda 56px top bar, asosiy tugmalar
  sarlavha ostida.
- `QuickAdd` ("+") — Chiqim, Kirim, O'tkazma, Qarz. Formalar `stores/formStore.ts` orqali
  `GlobalForms` da bir marta o'rnatilgan va istalgan joydan ochiladi (tranzaksiya — tahrirlash
  rejimida ham).
- Toast'lar pastda markazda (telefonda tab bar ustida); o'chirishlar 6 soniyalik "Qaytarish" bilan.

## Dizayn tizimi

- **Token'lar**: `src/styles/tokens.css` — `fintrack-tokens.css` nusxasi, `:root` yorug', `.dark`
  qorong'i. Tailwind ranglari faqat token'lardan (`bg-card`, `text-text-muted`, `bg-income`,
  `chart.1–9` …); opacity modifier `color-mix(...)` orqali ishlaydi.
- **Breakpoint'lar**: `sm 640 · md 768 · lg 1024 · xl 1200 · 2xl 1440`. `useIsMobile()` = <640.
- **Shrift**: Onest (`@fontsource-variable/onest`), raqamlar `tabular-nums`.
- **Komponentlar** (`components/ui`): Button, Input/SearchInput, Textarea, MoneyInput, Dropdown,
  Segmented, Tabs, Switch, Checkbox, Chip (+ChangeChip, TagChip, FilterChip, CountBadge), Amount,
  Card, KpiCard, Progress, EmojiTile, Avatar, Skeleton, EmptyState, ErrorState, Pagination,
  Modal (≥640 dialog, <640 to'liq sheet), Sheet, ConfirmDialog (`useConfirm`), Menu (desktop
  popover, telefonda sheet), Popover, DatePicker, RangePicker, ChoiceGrid, EmojiGrid/Swatches,
  AccountPicker/CategoryPicker. Grafiklar (`components/charts`, Recharts): AreaTrend, Donut,
  BarList, GroupedBars.
- Saqlangan rang (hex) `lib/colors.ts` orqali `chart-N` token'iga moslanadi; emoji plitkalari 16%
  tiniq fonda.
- `lib/useSortable.ts` — tartiblash: sichqoncha, barmoq (pointer events) va klaviatura
  (strelkalar). HTML5 drag ishlatilmaydi — u telefonda ishlamaydi.

## State chegarasi

| Ma'lumot | Qayerda |
|---|---|
| tranzaksiya, kategoriya, teg, hisob, byudjet, qarz, takroriy qoida, statistika, bildirishnoma | **React Query** |
| auth user, mavzu, sidebar holati, dashboard davri, ochiq global forma, toast | **Zustand** |
| filtrlar, sahifa, saralash, tanlangan oy/tab | **URL search params** |

Server ma'lumotini Zustandga ko'chirish — ushbu loyihadagi eng qattiq taqiq.

## Query kalitlari va invalidatsiya

Manba — `lib/invalidation.ts` (`invalidateAfter(queryClient, kind)`).

| Yozuv turi | invalidateQueries |
|---|---|
| transaction (create/update/delete/restore/bulk) | `transactions`, `stats`, `accounts`, `budgets`, `notifications`, `tags` |
| transfer (create/delete) | `transactions`, `accounts`, `stats`, `notifications` |
| debt, debtPayment | `debts`, `transactions`, `accounts`, `stats`, `notifications` |
| budget | `budgets`, `stats` |
| category | `categories`, `transactions`, `stats`, `budgets`, `recurring` |
| account | `accounts`, `transactions`, `stats`, `recurring`, `debts` |
| tag | `tags`, `transactions` |
| recurring (tahrir, to'xtatish, o'chirish) | `recurring` |
| recurringRun (yaratish, davom ettirish, "Hozir bajarish") | `recurring`, `transactions`, `accounts`, `stats`, `budgets`, `notifications` |

Ortiqcha invalidatsiya xavfsiz; yetishmagani foydalanuvchiga eski pulni ko'rsatadi.

## Bosh sahifa

**Davr** (`periodStore`): `Bugun · Shu hafta · Shu oy · Shu yil · Oraliq` (dushanbadan
boshlanadigan kalendar). Hafta — `groupBy=day`, oy — `week`, yil — `month`.

**KPI (4)**: davr kirimi, davr chiqimi (o'zgarish `summary.previousPeriod` dan), umumiy balans
(o'zgarish `balance-trend` boshi va oxiridan; manfiy → qizil + ⚠ + minus), qarz saldosi (chip'siz).
Kirim/xarajat nisbati paneli: 0–70% yashil, 70–100% sariq, >100% qizil.

**Grafiklar**: kirim-chiqim oqimi (Bugun — `createdAt` soati bo'yicha), xarajat ulushi (donut),
kategoriyalar (bar list), balans dinamikasi. **Pastda**: byudjetlar, oxirgi tranzaksiyalar, qarzlar.
Har vidjetning o'z skeleton/xato/bo'sh holati bor. Hech narsa yo'q bo'lsa — "Boshlash uchun uchta qadam".

## Tranzaksiyalar

- Filtrlar URL'da: `search` (400 ms debounce), `type`, `accountId`, `categoryId` (ota kategoriya
  subkategoriyalarni ham qamraydi), `tagId`, `period` (`last7 · thisMonth · lastMonth · last90`)
  yoki boshqa sahifadan kelgan `from`/`to`, `min`/`max` (so'm), `sort` (`new · old · big · small`), `page`.
- Faol filtrlar chip bo'lib chiqadi; telefonda "Filtrlar (N)" sheet.
- `meta.sums` — "Filtr bo'yicha kirim/chiqim" va `incomeCount`/`expenseCount`.
- Desktop: kunlar bo'yicha guruhlangan jadval (sarlavhada kunning sof summasi joriy sahifadan),
  summa bo'yicha saralanganda guruhsiz. Telefon: kartalar va "Yana yuklash" (`useInfiniteQuery`).
- O'tkazma qatori "A → B" (`transferPeer`), qarz qatori shaxs ismi (`debt.personName`),
  `ADJUSTMENT` — qulf, tahrirlanmaydi.
- Qator menyusi: kirim/chiqim — Tahrirlash, O'chirish; o'tkazma — "O'tkazmani bekor qilish"
  (qaytarish qayta `POST /transfers`); qarz — "Qarzga o'tish". Bir nechta yozuvni o'chirish (desktop).
- Eksport (CSV/XLSX) — ekrandagi filtrlar bilan.
- Forma: yaratish/tahrirlash, Kirim↔Chiqim almashtirish, kategoriya va hisob tanlagichlari,
  teg yaratish, qat'iy rejim xatosi (oldindan va server javobi bo'yicha).

## Hisoblar

Jami balans banneri, "Faol" va "Arxiv" tablari, karta menyusi (tahrirlash, asosiy qilish,
arxivlash, o'chirish), tartiblash rejimi (sudrab, keyin Saqlash). Tarixi bor hisob o'chirilmaydi —
arxivlash taklif qilinadi; oxirgi faol hisob uchun alohida dialog. Boshlang'ich balans faqat
yaratishda; keyin balans faqat tranzaksiyalar orqali o'zgaradi.

## Kategoriyalar va teglar

Chiqim/Kirim daraxti (ikki daraja), "Standart" tizim kategoriyalari (o'chirilmaydi),
"+ Subkategoriya", sudrab tartiblash (darhol saqlanadi, faqat bir darajadagilar orasida).
Kategoriya o'chirilsa tranzaksiyalar kategoriyasiz qoladi, uning byudjetlari o'chadi.
Teglar: ishlatilish soni, joyida yaratish va nomini o'zgartirish, rang.

## Qarzlar

Yo'nalish kartalari ("Menga qarzdor", "Men qarzdorman") — ham jami, ham filtr; saldo va muddati
o'tganlar soni. Holat chip'lari soni bilan. Karta: asl summa, to'langan %, qoldiq, progress,
muddat ("Muddati o'tgan!", "N kun qoldi"), to'lovlar tarixi (hisob nomi bilan, o'chirish mumkin).
"To'lov kiritish" va "To'liq yopish" — bitta forma; qoldiqdan ortiq summa oldindan rad etiladi.

## Byudjetlar

Oy almashtirgich, oy bo'yicha jami (limit, sarflangan, qoldiq). Karta zonasi: <80% "Me'yorida",
80–100% "80% dan oshdi", >100% "Oshib ketdi" va qancha ortiq. Byudjet ota kategoriyaga qo'yiladi,
subkategoriyalar hisobga olinadi.

## Takroriy to'lovlar

"Faol" / "To'xtatilgan" tablari, karta (jadval, keyingi to'lov, tugash sanasi), "Hozir bajarish",
"To'xtatish/Davom ettirish". Forma "Keyingi to'lov" ni ko'rsatadi — `packages/shared/src/recurrence.ts`
dagi `firstRunDate()` bilan, API ham shu funksiyadan foydalanadi.

## Hisobotlar

Davr: `Shu oy · O'tgan oy · Shu yil · Oraliq` ("Qo'llash" bilan). Davom etayotgan oy/yil oldingi
davrning **shu kunlari** bilan solishtiriladi. Kartalar (`stats/compare`): Kirim, Chiqim, Sof natija.
"Davrlar solishtiruvi" — ikkita `stats/timeseries` 1–7, 8–14… (yilda oylar, oraliqda ≤6 bo'lak)
ga yig'iladi (`features/reports/buckets.ts`). Kategoriyalar — to'rtta `stats/by-category`
(kirim va chiqim, hozir va oldin).

## Sozlamalar

Profil (ism, vaqt zonasi), qat'iy rejim / Telegram bildirishnomalari / kunlik xulosa (21:00),
mavzu (Yorug' · Qorong'i · Tizim; Mini App'da yashirin — Telegram mavzusiga ergashadi),
Telegram ulanishi, faol sessiyalar (IP qisman yashiriladi), "Barcha qurilmalardan chiqish",
akkauntni o'chirish ("O'CHIRISH" deb yozib, keyin tasdiq dialogi).

## Admin panel (`/admin/*`, faqat egasi — `docs/09-ADMIN-PANEL.md`)

Alohida lazy chunk: oddiy foydalanuvchi uning kodini yuklamaydi. Qobiq — logo + "Admin" belgisi, mavzu,
chiqish, ostida gorizontal bo'limlar (telefonda suriladi). Sessiyasiz `/admin/*` — oddiy **404**
sahifasi (API ham 404 beradi); kirish faqat `/admin/login` orqali. Sessiya panel ochiq turganda tugasa
(har qanday admin so'rovi 404) — `/admin/login` ga qaytaradi (tab'dagi `sessionStorage` belgisi).

| Bo'lim | Ichida |
|---|---|
| Umumiy | 4 KPI (oldingi davrga nisbatan `ChangeChip`), hisob holatlari, 30 kunlik faol/yangi grafigi, kanallar donut, yozuv manbalari, yangi ro'yxatdan o'tganlar |
| Foydalanuvchilar | qidiruv (300 ms), holat tablari, saralash, CSV; ≥1024 jadval, undan kichik — kartalar; filtrlar va ochiq karta URL'da (`?q&status&sort&page&open`). Karta (`Modal lg`): sanoqlar, 90 kunlik faollik kalendari, yozuv manbalari; bloklash (sabab formasi, 3–300), blokdan chiqarish va sessiyalarni tugatish (`useConfirm`). Admin hisobida tugmalar yo'q |
| O'sish | davr (30/90 kun, 1 yil) × guruh (kun/hafta/oy); faol+yangi, jami, yozuvlar grafiklari; yangi foydalanuvchilar yo'li; 12 haftalik kogorta heatmap |
| Foydalanish | davr (7/30/90); kanallar donut, yozuv manbalari, funksiyalar, AI yordamchi va provayderlar |
| Tizim | DB, Redis, Telegram, versiya kartalari; navbatlar jadvali va oxirgi xatolar; har 30 s yangilanadi |
| Audit | amal turi filtri, sahifalash; kim → kimga, tafsilot bir qatorda, IP |

"Bugun" — Toshkent kuni (`features/admin/periods.ts`). Faqat sanoqlar va sanalar ko'rsatiladi.

## To'rt holat — majburiy

Har bir ma'lumotli ko'rinishda: **loading skeleton**, **error + qayta urinish**, **empty + CTA**,
**success**. Bittasi yo'q bo'lsa sahifa tayyor emas.

## Formatlash (`lib/money.ts`, `lib/format.ts`)

- Pul: `1 250 000 so'm` — ming ajratgichi NBSP, minus U+2212; kirim `+` yashil, chiqim `−` qizil,
  o'tkazma va qarz ishorasiz. Grafik o'qlarida "1,5 mln", "250 ming".
- Manfiy balans: minus + qizil + ⚠ (faqat rang yetarli emas).
- Sana: o'z jadvallarimiz — "3-oktabr, 2026", "3-okt", "Bugun · 3-oktabr, shanba",
  "1–31-oktabr, 2026". Xom ISO sana ko'rsatilmaydi.
- UI matnlari o'zbekcha.

## Mobil (390px)

Jadval → kartalar; sidebar → tab bar va "Ko'proq"; modal → pastdan to'liq sheet; menyular → sheet;
tap maydoni ≥ 44px; gorizontal scroll yo'q.

## Harakat (`lib/motion.ts`)

- **Davomiylik** (dizayn tizimi, "Motion"): `fast 120` hover/bosish/switch, `base 200` popover/menyu/toast,
  `slow 320` modal/sheet/progress. Chiqish — kirishning 0,75 qismi, `ease-in`. Landing'da `reveal 640`.
  Faqat `transform` va `opacity` animatsiya qilinadi.
- **Kamroq harakat** (`prefers-reduced-motion`): `--motion-distance: 0` — siljish va kattalashish 120ms
  fade'ga aylanadi; skeleton to'xtaydi; yopilish darhol; raqamlar sanalmaydi; grafiklar chizilmaydi;
  landing darhol yakuniy holatda. Spinner aylanadi (u holat ko'rsatkichi).
- `usePresence` — overlay chiqish animatsiyasi tugaguncha DOM'da turadi; `useOpenSnapshot` — yopilayotgan
  modal oxirgi kontentini ko'rsatadi. `Collapse` — balandlik (FAQ, qarz to'lovlari tarixi, landing menyusi).
- `useCountUp` / `useCountingTiyin` / `CountingAmount` — KPI raqamlari sanaladi; oraliq kadrlar butun
  so'm, oxirgi kadr API'dan kelgan aniq BigInt.
- Ro'yxatlar: `.ft-stagger` — qo'shilgan elementlar navbat bilan chiqadi; yangi saqlangan tranzaksiya
  qatori `.ft-flash` bilan bir lahza yorishadi. Sahifalar `pathname` bo'yicha fade bo'lib ochiladi.
- Testlar: Vitest'da kamroq harakat yoqilgan (`setReducedMotion(false)` bilan o'chiriladi), Playwright
  ham `reducedMotion: 'reduce'` bilan; `motion.spec.ts` animatsiyaning o'zini tekshiradi.

## Tekshiruv

`npm run verify` (lint, typecheck, unit — Vitest + MSW), `npm run test:e2e` (API e2e + Playwright:
`critical-path`, `mobile`, `miniapp`, `reorder`, `motion`).

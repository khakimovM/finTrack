# 08 — Dizayn brief: Claude Design uchun promptlar

FinTrack'ni to'liq qayta chizish uchun prompt to'plami. Promptlar ingliz tilida, ekrandagi barcha matnlar o'zbekcha.
Bu fayl dizayn tayyor bo'lgach implementatsiya uchun spetsifikatsiya ham bo'ladi.

## Qanday foydalanish

1. Promptlarni **tartib bilan** yuboring: 0 → 7. Har biri alohida xabar. Natijani ko'rib, kerak bo'lsa tuzattiring,
   keyin keyingisiga o'ting.
2. **Reference rasmlarni 0-prompt bilan birga** yuklang. 8–12 ta rasm yetarli:
   - 3–4 ta desktop dashboard;
   - 2–3 ta mobil ilova ekrani;
   - 2 ta landing page;
   - 1–2 ta dark mode namunasi.

   Biror ekran uchun aniq reference bo'lsa (masalan, landing), uni o'sha raund bilan ham qo'shing.
3. Har raunddan keyin tekshiring:
   - 4 holat bormi: yuklanish, bo'sh, xato, to'ldirilgan;
   - 390px mobil variant bormi;
   - matnlar o'zbekcha va to'g'rimi.
4. Tayyor dizaynni (havola yoki rasmlar) olib keling. Implementatsiya shu fayl va dizayn asosida qilinadi.

[NEW] belgisi: backend'da tayyor, lekin hozirgi saytda interfeysi yo'q funksiya.

---

## Prompt 0 — Master brief + design system

```text
You are designing a complete UI redesign for FinTrack, a personal finance web app for Uzbekistan. I will send the brief in rounds. This first message sets the product context and the rules every screen must follow, and asks for the design system. Each later message covers a group of screens; always reuse the design system from this round.

## Product
FinTrack is a multi-user personal finance platform (currency: Uzbek so‘m, UZS). Each user tracks income and expenses, accounts (cards, cash, bank, savings), transfers between their own accounts, monthly budgets per category, debts (money lent and borrowed, with partial payments), recurring payments, and reports. Sign-in is Telegram-only: there are no passwords; a one-time 6-digit code arrives from the FinTrack Telegram bot. The same data can be managed from the bot (typing "50000 taksi" or sending a voice message creates a draft the user confirms), and the web app also opens inside Telegram as a Mini App.

Users: Uzbek-speaking adults aged 18–45, mostly on phones, heavy Telegram users, not finance experts. They want to answer "where did my money go?", never forget who owes what, and stay inside their budgets.

Brand personality: calm, trustworthy, modern, clear. Friendly but not childish. Not crypto, not gaming, no neon. The product name is "FinTrack". Propose a simple logo: a wordmark plus a small mark that also works as a 32px favicon and as the Telegram bot avatar.

## References
I am attaching reference images. Take the visual language from them: layout density, colour mood, typography feel, card and chart style. Take functionality only from this brief. If a reference conflicts with the brief, the brief wins. Do not copy logos, brand names or illustrations from the references.

## Technical constraints (the design will be implemented exactly, so stay inside these)
- React + Tailwind CSS. Every colour is a semantic token (CSS variable) with a light and a dark value. No one-off hex colours inside screens.
- Components are hand-built in the shadcn/ui style; no exotic widgets. Icons: lucide only. Account and category icons are emoji picked by the user — keep them, shown on a tile tinted with the item's colour.
- Charts must be drawable with Recharts: area, line, bar (vertical or horizontal), donut. Chart colours come from tokens and must work in both themes.
- One Google Font family (optionally a second one for numbers) with Latin Extended support, because Uzbek uses o‘, g‘ and ʼ. Numbers use tabular figures.
- Frames: desktop 1440, tablet 768, mobile 390. Everything must work at 375px wide with no horizontal scrolling.
- Telegram Mini App: the same app runs inside Telegram's webview — no browser bar, safe-area insets respected, light/dark follows Telegram, and Telegram's native Back button is used (no in-app back arrow needed there).

## Display rules (finance domain)
- Money: "1 250 000 so‘m" — space as thousands separator, comma decimals only when non-zero ("1 500,50 so‘m"). Chart axes use short forms: "1,5 mln", "250 ming".
- Income: green with "+". Expense: red with "−" (U+2212). Transfers between own accounts: neutral colour. Debt movements (lent, borrowed, repaid) have their own calm style (e.g. blue/violet): they are NOT income or expense and never appear in expense charts.
- Negative balance: "−" sign + red + a warning icon. Colour is never the only signal.
- Dates: "15-avgust, 2026", short "15-avg", relative "Bugun" / "Kecha", month titles "Oktabr 2026". Never show raw ISO dates like 2026-08-15 or 15.08 in the UI.
- Accessibility: WCAG AA contrast in both themes, touch targets ≥ 44px on mobile, visible keyboard focus, reduced-motion friendly.
- Every data view has four designed states: loading (skeleton shaped like the final layout), error (short message + "Qayta urinish"), empty (icon or small illustration, one-line explanation, primary action), and filled.
- All UI copy is Uzbek (Latin script). Use the exact strings I give in quotes and keep the apostrophes as written (o‘, g‘, ʼ). Where I give no copy, write short, plain Uzbek.

## Sample data (use the same data on every screen)
- User: "Aziz Karimov", @aziz_k, time zone Toshkent.
- Accounts: "Humo karta" 💳 (card, default, 12 550 000 so‘m), "Uzcard" 💳 (card, 4 300 000 so‘m), "Naqd pul" 💵 (cash, 1 200 000 so‘m), "Jamg‘arma" 🏦 (savings, 25 000 000 so‘m). Total: 43 050 000 so‘m.
- Expense categories: Oziq-ovqat 🍔, Transport 🚗 (subcategory Taksi 🚕), Uy-joy 🏠, Kommunal 💡, Kiyim 👕, Sog‘liq 🏥, Ko‘ngilochar 🎬, Taʼlim 📚. Income categories: Oylik 💼, Qo‘shimcha daromad 💵.
- Tags: "oila", "ish", "sayohat".
- This month (Oktabr 2026): income 9 700 000 so‘m, expense 6 380 000 so‘m.
- Debts: Jasur Karimov owes me 2 000 000 so‘m, due 20-sentabr, 2026 (overdue). I owe Dilnoza Rahimova 1 500 000 so‘m, 600 000 already paid (partially paid), due in 2 days.
- Budgets for Oktabr 2026: Oziq-ovqat limit 2 500 000, spent 1 400 000 (OK); Transport limit 800 000, spent 690 000 (86%, warning); Ko‘ngilochar limit 500 000, spent 620 000 (exceeded).
- Recurring: "Oylik maosh" +8 500 000 (every month on the 5th), "Kvartira ijarasi" −3 000 000 (every month on the 1st), "Internet" −150 000 (every month on the 10th, paused).
- Recent transactions: Taksi −35 000 (Bugun), Korzinka (Oziq-ovqat) −284 000, Oylik maosh +8 500 000, transfer Humo karta → Jamg‘arma 1 000 000, "Qarz berildi — Jasur Karimov" 2 000 000.

## Information architecture
Desktop sidebar, grouped:
- Asosiy: "Bosh sahifa", "Tranzaksiyalar", "Hisoblar"
- Rejalashtirish: "Byudjetlar", "Qarzlar", "Takroriy to‘lovlar"
- Tahlil: "Hisobotlar"
- Sozlash: "Kategoriyalar va teglar", "Sozlamalar"
Mobile: bottom tab bar "Bosh sahifa" · "Tranzaksiyalar" · centre "+" · "Qarzlar" · "Ko‘proq" (a sheet with the remaining sections).
Global quick add "+": a header button on desktop and the centre tab on mobile. It opens a small chooser: "Chiqim", "Kirim", "O‘tkazma", "Qarz".

## Deliverable for this round: the design system board (light and dark)
1. Tokens: background, surface, card, popover/elevated, border, input, ring, text (primary, secondary, muted), primary (+hover, +foreground), success, warning, danger, info, plus finance tokens: income, expense, transfer, debt, and chart-1…chart-9 for categories.
2. Typography scale (display, h1–h4, body, small, caption, and numeric styles including large KPI numbers), spacing scale, radius scale, shadows/elevation, motion (durations and easing).
3. Components with their states (default, hover, focus, disabled, loading, error):
   Button (primary, secondary, outline, ghost, destructive, link; sizes sm, md, lg, icon) · Input with label, help and error text · MoneyInput (right-aligned, "so‘m" suffix, live thousands grouping) · Select and searchable Combobox (emoji items, nested children) · Date picker and date-range picker · Segmented control · Tabs · Switch with label and description · Checkbox · Status chip (neutral, success, warning, danger, info) · Amount (income, expense, neutral, negative balance) · KPI card (value + change vs previous period) · Progress bar with thresholds (green < 80%, amber 80–100%, red > 100%) · Card · Data table and its mobile card-row equivalent · Pagination ("Jami 248 tadan 1–20 ko‘rsatilmoqda") · Modal on desktop ↔ bottom sheet with drag handle on mobile · Confirm dialog (normal and destructive) · Toast (success, error, warning, info, and one with an action button "Qaytarish") · Dropdown menu · Notification item (read and unread) · Empty state · Error state · Skeletons · Avatar · Tag chip (removable) · Emoji tile · Colour swatch picker · Emoji picker grid · OTP input (6 boxes) · Steps list · Filter chips.
Keep the board practical: a developer will copy it into Tailwind tokens one-to-one.
```

---

## Prompt 1 — Landing, login, tizim sahifalari

```text
Round 1. Use the FinTrack design system from round 0. Design these screens at 1440 and 390, light theme, plus dark versions of the landing hero and the login card.

### 1. Landing page "/" (new — the first thing a visitor sees)
Small, one page, quick to scan. It replaces the old behaviour of sending visitors straight to the login form.
- Header: logo; anchor links "Imkoniyatlar", "Qanday ishlaydi", "Savollar"; theme toggle; button "Kirish". If the visitor already has a session the button reads "Ilovaga o‘tish" — show this variant too. On mobile the links collapse into a menu.
- Hero: write a headline and sub-headline in simple, confident Uzbek around the idea "Pulingiz qayerga ketayotganini biling — saytda ham, Telegram’da ham". Primary CTA "Telegram orqali boshlash" (goes to /login). Secondary CTA "Botni ochish" (opens t.me/fintrack_cwa_bot). Small trust line: "Parol kerak emas · Kod Telegram’ga keladi". Visual: the real dashboard UI in a browser frame, overlapped by a phone showing the Telegram bot chat — the user types "50000 taksi" and the bot replies with a draft card ("Chiqim · 50 000 so‘m", "Kategoriya: Transport › Taksi", "Hisob: Humo karta") with buttons "✅ Saqlash", "📁 Kategoriya", "❌ Bekor".
- "Imkoniyatlar": six feature cards (lucide icon, title, one line):
  1. "Kirim va chiqimlar" — har bir so‘m o‘z kategoriyasida.
  2. "Hisoblar va o‘tkazmalar" — karta, naqd pul va jamg‘arma bir joyda.
  3. "Byudjetlar" — limitning 80% va 100% ida ogohlantirish.
  4. "Qarzlar" — kim kimga qarzdor, qisman to‘lovlar va muddatlar.
  5. "Takroriy to‘lovlar" — oylik, ijara va obunalar o‘zi yoziladi.
  6. "Hisobotlar" — davrlarni solishtirish, CSV va Excel eksport.
- "Telegram ichida moliya" band, four points with small UI vignettes: fast typing ("45k tushlik", "kecha 1,2 mln ijara"); voice messages ("🎙 Eshitdim: «tushlikka qirq besh ming»" → a draft to confirm); daily summary at 21:00 and alerts about budgets and debt due dates; the Mini App opened with the "Ilova" button.
- "Qanday ishlaydi", three steps: 1) "Telegram orqali kiring" — bot kod yuboradi; 2) "Hisoblaringizni qo‘shing"; 3) "Saytda, botda yoki ovoz bilan yozib boring".
- Security band: parolsiz kirish; kod faqat sizning Telegram’ingizga keladi; faol sessiyalarni ko‘rish va yakunlash; maʼlumotlaringiz faqat sizga ko‘rinadi.
- "Savollar", an FAQ accordion with five items: "Telegram’siz foydalansa bo‘ladimi?" (yo‘q, kirish faqat Telegram orqali); "Ovozli xabarni qanday yuboraman?"; "Maʼlumotlarimni yuklab olsam bo‘ladimi?" (CSV va Excel); "Qarz berish xarajat hisoblanadimi?" (yo‘q — balans o‘zgaradi, lekin xarajat statistikasiga kirmaydi); "Bir nechta karta qo‘shsam bo‘ladimi?".
- Final CTA band and footer ("© 2026 FinTrack", links "Kirish" and "Telegram bot").
Do not invent prices, user counts, ratings or testimonials.

### 2. Login "/login"
A centred card on a calm background with the logo, plus a link back to the landing page. Title "FinTrack’ga kirish". Description "Parol shart emas: kirish kodi Telegram’dagi botimizga keladi. Birinchi marta kirsangiz, hisob avtomatik yaratiladi." Footer note with a shield icon: "Kodni hech kimga bermang — FinTrack xodimlari uni hech qachon so‘ramaydi." Design every state:
a) Start: large button "Telegram orqali kirish" (and its loading state).
b) Waiting for Telegram: steps "1. Telegram’da @fintrack_cwa_bot ochiladi.", "2. Start tugmasini bosing (yangi bo‘lsangiz — raqamni ulashing).", "3. Bot yuborgan 6 xonali kodni shu yerga kiriting."; outline button "Telegram’ni ochish"; a live status line with a spinner: "Telegram’dan javob kutilmoqda…" or "Raqamingizni ulashishingiz kutilmoqda…".
c) Code sent: success line "Kod Telegram’ga yuborildi"; 6-box OTP input (submits on the 6th digit, supports paste); button "Tasdiqlash"; countdown "Kod 2:41 amal qiladi"; text button "Kodni qayta yuborish" with a short cooldown look.
d) Wrong code: red OTP boxes and "Kod noto‘g‘ri. Yana 3 ta urinish qoldi".
e) Code expired: "Kod muddati tugadi" with the resend action.
f) Request cancelled from Telegram: "So‘rov Telegram’da rad etildi." with "Qaytadan boshlash". Request expired: "So‘rov muddati tugadi. Qaytadan boshlang."
g) Error banner: "Telegram orqali kirish vaqtincha ishlamayapti".

### 3. System screens
- 404: "Sahifa topilmadi", "Siz qidirayotgan sahifa mavjud emas yoki boshqa manzilga ko‘chirilgan.", button "Asosiy sahifaga qaytish".
- Error page: "Xatolik yuz berdi", a short message, buttons "Sahifani yangilash" and "Bosh sahifaga o‘tish".
- Mini App splash (shown while the app signs in inside Telegram): logo and a subtle progress indicator; 390 wide, both themes.
- Mini App gate screens (390 wide; icon, title, body, one button):
  • "Avval botda ro‘yxatdan o‘ting" / "Botga qaytib /start bosing va telefon raqamingizni ulashing. Shundan so‘ng ilovani qayta oching." / "Botga qaytish"
  • "Ilova sessiyasi tugadi" / "Xavfsizlik uchun ilova sessiyasi 24 soat amal qiladi. Ilovani botdagi “Ilova” tugmasi orqali qayta oching." / "Botga qaytish"
  • "Ilovani menyu tugmasi orqali oching" / "Botdagi “Ilova” tugmasi (xabar yozish maydoni yonida) yoki “🌐 FinTrack ilovasini ochish” tugmasidan foydalaning." / "Botga qaytish"
  • "Ulanib bo‘lmadi" / "Server bilan bog‘lanishda xatolik yuz berdi. Birozdan so‘ng qayta urinib ko‘ring." / "Qayta urinish"
```

---

## Prompt 2 — Qobiq, Bosh sahifa, bildirishnomalar, tez kiritish

```text
Round 2. Use the FinTrack design system. Design the app shell and the home screen at 1440 and 390 (light and dark for the dashboard), plus the Telegram Mini App variant at 390.

### 1. App shell
- Desktop: the grouped sidebar from round 0 with a clear active state. At the bottom, a user card: avatar initial, "Aziz Karimov", "@aziz_k", a mode chip "Qatʼiy rejim" (shield-alert, amber) or "Oddiy rejim" (shield-check, neutral), and a logout icon button "Chiqish".
- Header: page title (exactly one h1 per page — do not repeat a greeting in the header), global "+ Qo‘shish" button, notification bell with unread count (capped at "9+"), theme toggle.
- Tablet: collapsible icon rail.
- Mobile: compact top bar (page title, bell) and the bottom tab bar ("Bosh sahifa", "Tranzaksiyalar", centre "+", "Qarzlar", "Ko‘proq"). "Ko‘proq" opens a sheet with: Hisoblar, Byudjetlar, Takroriy to‘lovlar, Hisobotlar, Kategoriyalar va teglar, Sozlamalar, the theme switch, and "Chiqish".
- Mini App variant: no logout and no theme toggle (Telegram controls the theme); the bottom bar respects the safe area; back navigation uses Telegram's native Back button.

### 2. Quick add chooser ("+")
Desktop popover, mobile bottom sheet, four large options: "Chiqim" (expense colour), "Kirim" (income colour), "O‘tkazma" (neutral), "Qarz" (debt style). Each opens its form; the forms come in later rounds.

### 3. Home — "Bosh sahifa" (/app)
- Title "Bosh sahifa" with a greeting line "Xush kelibsiz, Aziz!".
- Period filter (segmented): "Bugun", "Shu hafta", "Shu oy" (default), "Shu yil", "Oraliq" (opens a date-range picker with "Qo‘llash"). Show the active range as text, e.g. "1–31-oktabr, 2026".
- Four KPI cards, each with the change versus the previous period ("↑ 12,5%"; green when the change is good, red when bad; "yangi" when the previous value was 0):
  "Umumiy balans" (all accounts, subtext "Barcha hisoblar jami"); "Kirim" (+, green); "Chiqim" (−, red); "Qarz saldosi" (money owed to me minus money I owe; subtext "1 ta muddati o‘tgan qarz" in red when something is overdue, otherwise "Berilgan va olingan qarzlar farqi").
- "Kirimga nisbatan xarajat": a bar with the value "65,8%" and a message by zone — up to 70% green "Ajoyib! Xarajatlaringiz meʼyorida."; 70–100% amber "Xarajatlaringiz daromadingizning 70% idan oshdi."; above 100% red "Bu davrda daromadingizdan 12% ko‘p sarfladingiz!".
- Charts (theme tokens; Uzbek tooltips with formatted money and dates):
  1. "Kirim va chiqim dinamikasi" — area or line chart with "Kirim" and "Chiqim"; buckets by day, week or month depending on the period.
  2. "Xarajatlar taqsimoti" — donut; centre "Jami chiqim" + total; legend with the top 6 categories and their share, then "+ yana 3 ta kategoriya".
  3. "Kategoriyalar bo‘yicha xarajat" — horizontal bars, top 8.
  4. "Balans dinamikasi" — area chart of the running total balance, with "Boshlang‘ich" and "Yakuniy" values in the header.
- "Byudjetlar" widget [NEW]: the three budgets with thin progress bars and status chips, link "Barchasi".
- "Oxirgi tranzaksiyalar": the last 5 rows (emoji tile, title, account · relative date, amount), link "Barchasi".
- "Qarzlar" widget: overdue alert "1 ta qarzning to‘lov muddati o‘tib ketgan!", tiles "Menga qarzdor" and "Men qarzdorman" with totals, and a "Yaqin muddatlar" list (Dilnoza Rahimova — "2 kun qoldi").
- States: a skeleton for every card and chart; an error inside a single widget with "Qayta urinish" (one failing widget must not blank the whole page); an empty home for a brand-new user with a first-steps checklist ("Hisob qo‘shing", "Birinchi chiqimni yozing", "Telegram botni sinab ko‘ring"); an empty chart state "Ushbu davrda maʼlumot yo‘q".
- Mobile: KPIs as a 2×2 grid or a horizontal swipe; charts full width; widgets stacked.

### 4. Notifications
- Bell dropdown on desktop / full-height sheet on mobile: header "Bildirishnomalar", pill "3 ta yangi", action "Barchasini o‘qilgan qilish"; items with a type icon, title, body and time ("14:05", "27-sen, 14:05"); distinct unread and read styles; footer link "Barchasini ko‘rish".
- Full page "/app/notifications" [NEW]: filter "Hammasi" / "O‘qilmagan"; list grouped by day ("Bugun", "Kecha", then dates); tapping an item opens the related budget, debt or recurring rule; each item can be deleted.
- Types (real titles): "Byudjet chegarasi ogohlantirishi" (amber), "Byudjet chegarasi oshib ketdi" (red), "Qarz muddati yaqinlashmoqda" (amber), "Qarz muddati o‘tdi" (red), "Hisob balansi manfiy" (red), "Takroriy to‘lov yozildi" (info), "Takroriy to‘lov bajarilmadi" (amber).
- States: loading; empty "Hozircha yangi bildirishnomalar yo‘q"; error "Bildirishnomalarni yuklab bo‘lmadi".
```

---

## Prompt 3 — Tranzaksiyalar

```text
Round 3. Use the FinTrack design system and app shell. Design the Transactions screen and its forms at 1440 and 390.

### Transaction types and how each row looks
"Kirim" (+, income colour), "Chiqim" (−, expense colour), "O‘tkazma (chiqim)" / "O‘tkazma (kirim)" (neutral; shows "Humo karta → Jamg‘arma"), "Qarz berildi", "Qarz olindi", "Qarz qaytarildi", "Qarz to‘landi" (debt style, with the person's name), "Tuzatish" (system entry, locked). Only "Kirim" and "Chiqim" are created, edited and deleted here; the others are managed from their own screens.

### "/app/transactions"
- Header: title "Tranzaksiyalar", subtitle "Kirim va chiqimlar ro‘yxati, hisoblararo o‘tkazmalar"; actions "Eksport" (menu "CSV formatida", "Excel (XLSX) formatida"; loading text "Yuklanmoqda..."), "O‘tkazma", "Yangi tranzaksiya".
- Totals for the current filter: "Filtr bo‘yicha kirim" (+) and "Filtr bo‘yicha chiqim" (−).
- Filters: search "Izoh bo‘yicha qidiruv..." (with a clear button); type ("Barcha turlar" + the 8 types); account ("Barcha hisoblar"); category tree ("Barcha kategoriyalar", parents with indented children); tag ("Barcha teglar") [NEW]; date range; amount range "Summa: dan — gacha" [NEW]; sort "Eng yangi", "Eng eski", "Eng katta summa", "Eng kichik summa" [NEW]. Active filters appear as removable chips with "Filtrlarni tozalash". On mobile the filters live in a "Filtrlar (3)" sheet and the search stays visible.
- List: on desktop a table — checkbox, "Sana", "Hisob", "Kategoriya / Tur", "Izoh" (with tag chips), "Summa", actions. Grouping rows by day with a day header and day total is welcome. On mobile, card rows (emoji tile, title, account · date, tags, amount) with an overflow menu for actions.
- Row actions by type: "Kirim"/"Chiqim" → "Tahrirlash" [NEW], "O‘chirish"; transfers → "O‘tkazmani bekor qilish" (confirm "O‘tkazma bekor qilinsinmi?" / "Ikkala hisobdagi yozuv ham o‘chiriladi va balanslar avvalgi holatiga qaytadi."); debt rows → "Qarzga o‘tish" (opens that debt); "Tuzatish" → lock icon with tooltip "Tizim yozuvi".
- Bulk selection (only "Kirim"/"Chiqim" rows can be selected): a bar "3 ta tranzaksiya tanlandi" with "O‘chirish".
- Delete: confirm "Tranzaksiya o‘chirilsinmi?" / "O‘chirilgan yozuv balans va hisobotlardan chiqariladi." After deleting, a toast "Tranzaksiya o‘chirildi" with an action "Qaytarish" (undo, about 6 seconds) [NEW].
- Pagination: 20 per page, "Jami 248 tadan 1–20 ko‘rsatilmoqda".
- States: skeleton rows; error with retry; empty with no data at all "Hali tranzaksiyalar yo‘q" + "Birinchi tranzaksiyani qo‘shish"; empty because of filters "Tranzaksiyalar topilmadi" / "Ushbu filtrlarga mos tranzaksiya mavjud emas." + "Filtrlarni tozalash".

### Transaction form (create and edit [NEW]) — modal on desktop, full-height sheet on mobile
Title "Yangi tranzaksiya" or "Tranzaksiyani tahrirlash".
Fields:
- Type toggle "Chiqim" / "Kirim".
- "Summa" — MoneyInput, large, autofocused; error "Summa 0 dan katta bo‘lishi kerak".
- "Hisob" — emoji, name and current balance; the default account is preselected.
- "Kategoriya" — searchable, grouped by parent, only categories of the chosen type.
- "Sana" — default today, quick chips "Bugun" and "Kecha"; future dates are not allowed.
- "Izoh (ixtiyoriy)" — placeholder "Masalan: Bozorlik, oylik...", max 500 characters.
- "Teglar" [NEW] — multi-select chips with inline "+ Yangi teg".
Buttons "Bekor qilish" and "Saqlash". When strict mode is on and the account lacks money, show an inline error: "Hisobda yetarli mablag‘ yo‘q (Qatʼiy rejim)".
Managed records cannot be edited. Instead show an info panel: for a transfer "Bu o‘tkazma. Uni bekor qilish mumkin, tahrirlash mumkin emas."; for debt rows "Bu yozuv qarzga bog‘langan. Uni Qarzlar sahifasida boshqaring." with the button "Qarzga o‘tish".

### Transfer form
Title "Hisoblararo o‘tkazma", description "Bir hisobingizdan boshqasiga pul o‘tkazish". Fields: "Qayerdan" (account with balance), a swap button, "Qayerga" (cannot be the source), "Summa", "Sana", "Izoh (ixtiyoriy)" with placeholder "Masalan: Kartani to‘ldirish". Summary line "Humo karta → Jamg‘arma · 1 000 000 so‘m". Error "Jo‘natuvchi va qabul qiluvchi hisob bir xil bo‘lishi mumkin emas". Buttons "Bekor qilish" and "O‘tkazish".
```

---

## Prompt 4 — Hisoblar, kategoriyalar va teglar

```text
Round 4. Use the FinTrack design system and app shell. Design at 1440 and 390.

### "/app/accounts" — Hisoblar
- Header: "Hisoblar", subtitle "Bank kartalari, naqd pul va jamg‘armalar"; actions "O‘tkazma" (only with 2+ accounts) and "Yangi hisob".
- Total banner: "Jami balans" 43 050 000 so‘m, "Faol hisoblar: 4 ta", "Valyuta: UZS (O‘zbek so‘mi)". A negative total uses the negative-balance style.
- Account cards (grid on desktop, list on mobile): emoji tile in the account colour, name, a star chip "Asosiy" on the default account, type ("Karta", "Naqd", "Bank", "Jamg‘arma"), "Joriy balans", "Tranzaksiyalar: 87 ta". Card menu: "Tahrirlash", "Asosiy qilish", "Arxivlash", "O‘chirish" [NEW] (only for an account with no transactions). Tapping a card opens Transactions filtered by that account.
- Reorder mode [NEW]: "Tartibni o‘zgartirish" → drag handles → "Saqlash".
- Archive view [NEW]: a tab or toggle "Arxiv (1)" listing archived accounts in a muted style with the action "Arxivdan chiqarish".
- Confirms and errors: archive "Hisob arxivlansinmi?" / "Arxivlangan hisob tarixda saqlanadi, ammo yangi amallar uchun ko‘rsatilmaydi."; delete "Hisob o‘chirilsinmi?" / "Bu hisobda hech qanday yozuv yo‘q, u butunlay o‘chiriladi."; blocked delete "Hisobda tranzaksiyalar bor. O‘chirish o‘rniga arxivlang" with the button "Arxivlash"; last active account "Kamida bitta faol hisob qolishi kerak".
- Form "Yangi hisob" / "Hisobni tahrirlash": "Hisob nomi" (required, max 50, placeholder "Masalan: Asosiy karta"); "Hisob turi" ("Bank kartasi", "Naqd pul", "Bank hisob raqami", "Jamg‘arma / Depozit"); "Boshlang‘ich balans" (create only — on edit show read-only "Valyuta: UZS" instead); "Belgi" (emoji grid); "Rang" (8 swatches); "Asosiy hisob sifatida belgilash" (switch). Duplicate name error "Bunday nomli hisob allaqachon mavjud".
- States: skeleton cards; error "Hisoblarni yuklab bo‘lmadi"; empty "Hisoblar mavjud emas" / "Birinchi kartangiz yoki naqd pul hamyoningizni qo‘shing." + "Yangi hisob ochish".

### "/app/categories" — Kategoriyalar va teglar
- Tabs: "Chiqimlar (8)", "Kirimlar (2)", "Teglar (3)" [NEW].
- Category tree, two levels at most: a parent row with an emoji tile in its colour, the name, a chip "Standart" for built-in categories, and "1 ta subkategoriya"; children indented with their own emoji and colour. Actions: "+ Subkategoriya", "Tahrirlash" [NEW], "O‘chirish" (hidden for "Standart"). Drag to reorder [NEW].
- Delete confirm: "“Transport” kategoriyasi o‘chirilsinmi?" / "Uning subkategoriyalari ham o‘chiriladi. Tranzaksiyalar saqlanadi, lekin kategoriyasiz qoladi."
- Category form (create and edit [NEW]): type toggle "Chiqim kategoriyasi" / "Kirim kategoriyasi" (locked when editing); "Kategoriya nomi" (max 50); "Ota kategoriya (ixtiyoriy)" ("— Asosiy —" plus top-level categories of the same type; a category that has children cannot be moved under another — hint "Subkategoriyasi bor kategoriyani boshqasiga ko‘chirib bo‘lmaydi"); "Belgi" (emoji grid); "Rang" (9 swatches). Errors "Bunday nomli kategoriya allaqachon mavjud" and "Kategoriyalar faqat ikki darajali bo‘lishi mumkin".
- Tags tab [NEW]: tag chips with a colour dot, name and usage ("12 ta tranzaksiya"); create and edit inline (name max 30 characters, colour); delete confirm "“sayohat” tegi o‘chirilsinmi?" / "Teg tranzaksiyalardan olib tashlanadi, tranzaksiyalarning o‘zi qoladi."; tapping a tag opens Transactions filtered by it.
- States for each tab: skeleton, error, empty ("Kategoriyalar mavjud emas"; "Teglar yo‘q — tranzaksiyalarni guruhlash uchun teg yarating").
```

---

## Prompt 5 — Qarzlar, byudjetlar, takroriy to'lovlar

```text
Round 5. Use the FinTrack design system and app shell. Design at 1440 and 390.

### "/app/debts" — Qarzlar
Debts are separate from expenses: lending moves money out of an account, but it is not spending.
- Header: "Qarzlar", subtitle "Berilgan va olingan qarzlar, qisman to‘lovlar va muddatlar"; action "Yangi qarz".
- Summary: two large selectable tabs — "Menga qarzdor" (money I lent: 2 000 000 so‘m, "Kutilayotgan qaytuvlar") and "Men qarzdorman" (money I borrowed: 900 000 so‘m left, "To‘lanishi kerak") — plus "Saldo: +1 100 000 so‘m" and "Muddati o‘tgan: 1 ta".
- Status filter: "Barchasi", "Faol", "Qisman to‘langan", "To‘langan", "Muddati o‘tgan".
- Debt card: person's name; phone (tap to call on mobile); status chip ("Faol", "Qisman to‘langan", "To‘langan"); original amount; "To‘langan: 600 000 (40%)"; "Qoldiq: 900 000"; progress bar; due date "Muddat: 3-oktabr, 2026" or "Muddatsiz"; chips "Muddati o‘tgan!" (red) or "2 kun qoldi" (amber, 3 days or fewer); note. Actions: "To‘lov kiritish" and "To‘liq yopish" (hidden once paid); menu "Tahrirlash" [NEW] and "O‘chirish".
- Payment history (expandable, or a detail sheet on mobile): rows with date, account, note and amount. Each payment can be deleted [NEW] with the confirm "To‘lov o‘chirilsinmi?" / "Qoldiq va hisob balansi qayta hisoblanadi."
- When opened from a transaction (/app/debts?debt=…), the matching card is highlighted and its history is expanded.
- Delete debt confirm: "Qarz o‘chirilsinmi?" / "Unga bog‘liq barcha yozuvlar ham bekor qilinadi va balans tiklanadi."
- Forms:
  • "Yangi qarz": direction toggle "Men berdim" / "Men oldim"; "Shaxs ismi" (required, max 100, placeholder "Masalan: Jasur Karimov"); "Telefon raqami" (optional, "+998 90 123 45 67"); "Hisob"; "Summa"; "Qaytarish muddati" (optional date); "Izoh". Hint: "Hisob balansi darhol o‘zgaradi, lekin bu xarajat hisoblanmaydi."
  • "Qarzni tahrirlash" [NEW]: name, phone, due date and note only; amount and account are fixed — say why ("Summa va hisob o‘zgarmaydi: ular yozuvlarga bog‘langan").
  • "To‘lov kiritish": shows "Joriy qoldiq: 900 000 so‘m"; fields "Hisob", "To‘lov summasi" (quick chip "Hammasi"), "Sana", "Izoh". Error "To‘lov summasi qoldiq qarzdan oshib ketdi".
  • "To‘liq yopish": shows the remaining amount; fields "Hisob", "Sana", "Izoh" (default "Qarz to‘liq yopildi"); button "Yopishni tasdiqlash".
- States: skeleton; error "Qarzlarni yuklashda xatolik yuz berdi"; empty "Hozircha qarzlar yo‘q" + "Yangi qarz qo‘shish"; empty because of the filter.

### "/app/budgets" — Byudjetlar
- Header: "Byudjetlar", month switcher "‹ Oktabr 2026 ›", action "Byudjet belgilash".
- Summary: "Jami limit" 3 800 000 so‘m, "Sarflangan" 2 710 000 so‘m ("Limitdan 71% sarflandi"), "Qoldiq" 1 090 000 so‘m.
- Budget card: emoji and category; "Limit: 800 000 so‘m"; status chip "Meʼyorida" (under 80%, green), "80% dan oshdi" (80–100%, amber) or "Oshib ketdi" (over 100%, red); "Sarflangan 690 000 · 86%"; progress bar; footer "Qoldiq: 110 000 so‘m" or "Limitdan 120 000 so‘m ko‘p sarflandi"; note "Subkategoriyalar ham hisobga olinadi" when the category has children. Actions "Tahrirlash" and "O‘chirish".
- Form: "Xarajat kategoriyasi" (top-level expense categories; read-only when editing), "Oylik limit". The description names the month in words ("Oktabr 2026 uchun"). Duplicate error "Bu oy uchun ushbu kategoriyada byudjet allaqachon bor".
- States: skeleton; error; empty "Oktabr 2026 uchun byudjet yo‘q" + "Byudjet belgilash".

### "/app/recurring" — Takroriy to‘lovlar
- Header: "Takroriy to‘lovlar", subtitle "Oylik, ijara va obunalar o‘z vaqtida avtomatik yoziladi"; action "Yangi qoida".
- Tabs "Faol" / "To‘xtatilgan".
- Rule card: emoji or category, title, schedule text ("Har oy, 5-kuni", "Har hafta, juma", "Har kuni", "Har yili, 15-avgust", "Har oy, 31-kuni (qisqa oylarda oxirgi kuni)"), signed amount, account, "Keyingi: 5-noyabr, 2026", optional "31-dekabr, 2026 gacha", note. Actions: "Hozir bajarish" (confirm "Bugungi to‘lov hozir yozilsinmi?"), "To‘xtatish" / "Davom ettirish", "Tahrirlash", "O‘chirish" (confirm "Oldin yozilgan to‘lovlar tarixda qoladi, yangilari yozilmaydi.").
- Create form: type toggle; "Summa"; "Hisob"; "Kategoriya" (optional); "Takrorlanish" ("Har kuni", "Har hafta", "Har oy", "Har yili"); day picker ("Hafta kuni" Dushanba…Yakshanba, or "Oy kuni" 1–31); "Boshlanish"; "Tugash (ixtiyoriy)"; "Izoh". Help text: "O‘tgan sanalar uchun to‘lov yozilmaydi. Birinchi to‘lov kuni bugun bo‘lsa, u darhol yoziladi." A live preview line: "Keyingi to‘lov: 5-noyabr, 2026".
- Edit form: only "Summa", the day, "Tugash" and "Izoh" are editable; the other fields are shown read-only with a hint.
- States: skeleton; error; empty active tab "Faol takroriy to‘lovlar yo‘q" / "Oylik maosh, ijara yoki obunani bir marta kiriting — keyin u o‘zi yoziladi." + CTA; empty paused tab "To‘xtatilgan to‘lovlar yo‘q".
```

---

## Prompt 6 — Hisobotlar, sozlamalar

```text
Round 6. Use the FinTrack design system and app shell. Design at 1440 and 390.

### "/app/reports" — Hisobotlar
- Header: "Hisobotlar", subtitle "Davrlarni solishtirish, kategoriyalar bo‘yicha o‘zgarish va eksport"; action "Eksport" (CSV or Excel for the selected period).
- Period picker: "Shu oy", "O‘tgan oy", "Shu yil", "Oraliq" (two dates; errors "Ikkala sanani ham tanlang" and "Tugash sanasi boshlanishdan oldin bo‘lishi mumkin emas"). Caption: "1–30-sentabr, 2026 va oldingi davr 1–31-avgust, 2026".
- Comparison cards "Kirim", "Chiqim", "Sof natija": current value, "Oldin: …", and a change badge ("↑ 12,5%", "yangi" when the previous value was 0, "o‘zgarmadi"). Green when the change is good (income up, expense down, net up), red otherwise.
- Comparison chart [NEW]: current vs previous period for income and expense (grouped bars or two lines).
- "Xarajatlar kategoriyalar bo‘yicha": rows with emoji, name, change badge, and two thin bars "Hozir" and "Oldin" with amounts, sorted by the current amount.
- "Kirimlar kategoriyalar bo‘yicha" [NEW]: the same pattern for income.
- States: skeleton; error; empty "Bu davrlarda yozuvlar yo‘q" / "Boshqa davrni tanlang yoki kirim-chiqimlaringizni yozib boring."

### "/app/settings" — Sozlamalar (sections as cards, max width about 760px)
1. "Profil": "Ism" (2–100 characters); "Vaqt zonasi" (default "Toshkent (UTC+5)"; also Samarqand, Olmaota, Moskva, Istanbul, Dubay, Seul, London, Nyu-York); hint "“Bugun” shu zona bo‘yicha hisoblanadi."; "Saqlash" enabled only after a change.
2. "Moliyaviy qoidalar va bildirishnomalar" (switches save instantly with the toast "Sozlamalar saqlandi"):
   • "Qatʼiy rejim" — "Yoqilganda balansingizdan ortiq xarajat yozib bo‘lmaydi. O‘chirilganda balans manfiyga tushishi mumkin va qizil ko‘rsatiladi."
   • "Telegram bildirishnomalari" — "Byudjet, qarz muddati va takroriy to‘lovlar haqidagi ogohlantirishlar botga ham keladi."
   • "Kunlik xulosa" — "Har kuni soat 21:00 da bugungi kirim-chiqim xulosasi Telegram’ga yuboriladi."
3. "Ko‘rinish" [NEW]: theme "Yorug‘" / "Qorong‘i" / "Tizim" as a segmented control with small previews. Hidden in the Mini App (Telegram decides the theme).
4. "Telegram": linked state with "@aziz_k", "+998 90 *** ** 67", chip "Ulangan" and the text "Kirish kodlari va bildirishnomalar shu hisobga keladi."; not-linked state with the button "Telegram’ni ulash" and a waiting hint.
5. "Faol sessiyalar": rows with a device icon, "Chrome, Windows" or "Telegram ilovasi", chip "Shu qurilma" on the current one, "IP 84.54.** · oxirgi faollik 1-oktabr, 14:05", and the action "Yakunlash"; button "Barcha qurilmalardan chiqish" (with a confirm).
6. "Akkauntni o‘chirish" (danger zone): "Barcha hisoblar, tranzaksiyalar, qarzlar va byudjetlar butunlay o‘chiriladi. Bu amalni qaytarib bo‘lmaydi."; input "Tasdiqlash uchun “O‘CHIRISH” deb yozing"; destructive button "Akkauntni butunlay o‘chirish", enabled only on an exact match.
On mobile add a "Chiqish" row at the bottom (hidden in the Mini App).
States: skeletons for the profile and sessions; an error state for sessions.
```

---

## Prompt 7 — Yakuniy izchillik tekshiruvi

```text
Round 7 (final). Review every screen designed so far against the round-0 rules and fix inconsistencies:
- every screen has 390 and 1440 frames, and there is a dark version of at least: landing hero, login, home, transactions, transaction form;
- Telegram Mini App frames (390, safe areas, Telegram light and dark) for: splash, home, quick add, transaction form, debts;
- one h1 per page, consistent page headers, consistent amount colours and signs, no raw ISO dates, all four data states present;
- finish with a component inventory and a token sheet (names and light/dark values) that a developer can map one-to-one to Tailwind CSS variables.
```

# 01 — Mahsulot talablari (PRD)

## Maqsad

**FinTrack** — ko'p foydalanuvchili shaxsiy moliya platformasi. Har bir foydalanuvchi
ro'yxatdan o'tadi, o'zining izolyatsiyalangan dashboardiga ega bo'ladi va kirim/chiqimlarini,
hisoblarini, byudjetlarini hamda qarzlarini boshqaradi.

Yechiladigan muammo: odam oy oxirida "pulim qayerga ketdi?" degan savolga javob bera olmaydi;
kimga qancha qarz berilgani esdan chiqadi; qaysi kategoriya byudjetni yeb qo'yayotgani ko'rinmaydi.

## Foydalanuvchi rollari

Bitta rol — `USER`. Admin panel bu bosqichda yo'q. Har bir foydalanuvchi **faqat** o'z
ma'lumotini ko'radi va o'zgartiradi.

## Funksional modullar

### 1. Autentifikatsiya
Ro'yxatdan o'tish, kirish, chiqish, barcha qurilmalardan chiqish, joriy foydalanuvchi,
access/refresh token (rotatsiya bilan), parolni tiklash, faol sessiyalar ro'yxati va
sessiyani bekor qilish.

### 2. Hisoblar (Accounts)
Naqd pul, plastik karta, bank hisobi, jamg'arma. Har birining boshlang'ich qoldig'i,
ikonkasi, rangi bor. Hisoblar orasida **pul o'tkazish** (transfer) — bitta amal, ikkita
ledger yozuvi, umumiy balans o'zgarmaydi. Hisobni arxivlash (o'chirish emas).

### 3. Kategoriyalar
Tizim tomonidan yaratilgan 10 ta standart kategoriya + foydalanuvchi o'zinikini qo'shadi.
Ierarxiya: kategoriya ichida subkategoriya (Transport → Taksi, Yoqilg'i). Har birida emoji
va rang. Kategoriya o'chirilganda tranzaksiyalar saqlanadi (`categoryId = null`).

### 4. Teglar
Kategoriyadan mustaqil ko'p-ko'pga belgilar ("sayohat", "biznes"). Filtrda ishlatiladi.

### 5. Tranzaksiyalar (ledger)
To'qqiz turdagi yozuv (`docs/03-DATA-MODEL.md`). CRUD, ommaviy o'chirish, sana oralig'i /
tur / kategoriya / hisob / teg / summa oralig'i / matn bo'yicha filtr, saralash, sahifalash.
Soft delete — o'chirilgan yozuv tiklanishi mumkin.

### 6. Balans va qat'iy rejim
Balans hech qachon saqlanmaydi — ledgerdan hisoblanadi va Redisda keshlanadi.
`strictMode: false` → balans manfiyga tushishi mumkin, UI qizil ogohlantiradi.
`strictMode: true` → balansdan ortiq chiqim `422 INSUFFICIENT_BALANCE` bilan rad etiladi.

### 7. Qarzlar
Kimga berdim / kimdan oldim, ism, telefon, summa, qaytarish muddati, izoh.
**Qisman to'lov** qo'llab-quvvatlanadi: har to'lov `DebtPayment` + ledger yozuvi.
Qoldiq nolga yetganda status avtomatik `PAID`. Muddati o'tgani o'qish paytida hisoblanadi.
Qarz **hech qachon xarajat statistikasiga kirmaydi**.

### 8. Byudjetlar
Kategoriya + oy uchun limit. Sarflangan foiz 80% va 100% chegarasidan o'tganda bildirishnoma
(oyiga bir marta, takrorlanmaydi). Byudjet tranzaksiyani bloklamaydi — faqat `strictMode` bloklaydi.

### 9. Takrorlanuvchi to'lovlar
Ijara, internet kabi qoidalar (kunlik/haftalik/oylik/yillik). BullMQ kunlik job ularni
haqiqiy tranzaksiyaga aylantiradi. Idempotent — retry dublikat yaratmaydi.

### 10. Statistika va grafiklar
- KPI kartalar: davr kirimi, davr chiqimi, joriy balans, qarz saldosi
- Vaqt bo'yicha chiziqli grafik (kun / hafta / oy / yil / belgilangan oraliq)
- Kategoriya bo'yicha doiraviy va ustunli diagramma
- Balans dinamikasi (area chart)
- Byudjet progress barlari
- Barcha agregatsiya SQL `GROUP BY` orqali backendda

### 11. Bildirishnomalar
Ilova ichida: byudjet ogohlantirishi, qarz muddati yaqinlashgani, muddati o'tgani,
manfiy balans, takrorlanuvchi tranzaksiya yaratilgani. O'qilgan deb belgilash.

### 12. Eksport
Tranzaksiyalarni CSV va XLSX ko'rinishida yuklab olish (filtrlar bilan).

### 13. Sozlamalar
Ism, avatar, parol, til (uz/ru/en), mavzu (yorug'/qorong'i), qat'iy rejim, bazaviy valyuta,
akkauntni o'chirish.

## Funksional bo'lmagan talablar

| Talab | Qiymat |
|---|---|
| Tranzaksiyalar ro'yxati (p95) | < 300 ms, 10 000 yozuvda |
| Statistika endpointi (p95) | < 500 ms, 50 000 yozuvda |
| Balans hisobi | Redis kesh, yozuvda invalidatsiya |
| Mobil | 375px dan boshlab to'liq ishlaydi |
| Til | UI o'zbekcha (ru/en tayyor), kod inglizcha |
| Xavfsizlik | `docs`dagi barcha ownership testlari yashil |
| Test | Biznes mantiq 80%+ qamrov |

## Doirasidan tashqarida (hozircha)

Bank/plastik integratsiyasi, SMS/push, jamoaviy (oilaviy) hisoblar, admin panel,
investitsiya portfeli, kredit kalkulyatori, OCR chek skaneri.

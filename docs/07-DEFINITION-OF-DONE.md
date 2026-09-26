# 07 — "Tayyor" degani nima?

Har bir vazifa uchun quyidagilarning **hammasi** bajarilishi shart. Bittasi bajarilmagan bo'lsa,
vazifa tayyor emas — "asosan tayyor" degan holat yo'q.

## Kod
- [ ] TypeScript `strict`, `any` yo'q, `@ts-ignore` yo'q
- [ ] `pnpm lint` va `pnpm typecheck` yashil
- [ ] Fayllar ~300 satrdan qisqa
- [ ] Controllerda biznes mantiq yo'q, repositorydan tashqarida Prisma chaqiruvi yo'q
- [ ] Server ma'lumoti Zustandda emas

## Xavfsizlik
- [ ] Har bir `where` da `userId` bor
- [ ] Boshqa foydalanuvchining yozuviga 404 qaytadi (403 emas)
- [ ] Body/query dan `userId` o'qilmaydi
- [ ] Yangi yozuv endpointi `.strict()` Zod sxema bilan validatsiya qilinadi
- [ ] Hech qanday secret kodda yoki logda yo'q

## Pul
- [ ] Summalar `BigInt` tiyinda, JSONda string
- [ ] `parseFloat`/`Number()` bilan pul arifmetikasi yo'q
- [ ] Balans ledgerdan hisoblanadi, yozuvda kesh invalidatsiya qilinadi
- [ ] Ko'p yozuvli pul amali `$transaction` ichida
- [ ] Qarzlar kirim/chiqim statistikasiga kirmaydi

## Test
- [ ] Yangi biznes qoidasi uchun unit test bor
- [ ] Yangi resurs uchun ownership e2e testi bor
- [ ] Xato yo'li (failure path) ham test qilingan, faqat happy path emas
- [ ] `.skip` / `.only` qolmagan
- [ ] `pnpm test` va `pnpm test:e2e` yashil

## UI (frontend vazifalari uchun)
- [ ] Loading skeleton, error + qayta urinish, empty + CTA, success — to'rttasi ham bor
- [ ] 375px, 768px, 1440px da tekshirilgan
- [ ] Dark mode ishlaydi
- [ ] Klaviatura bilan yurish mumkin, focus ko'rinadi
- [ ] Pul `formatMoney` orqali, matnlar o'zbekcha

## Hujjat
- [ ] `docs/04-API-CONTRACT.md` haqiqiy javob shakliga mos
- [ ] Swagger `/api/docs` da yangi route to'g'ri ko'rinadi
- [ ] Sxema o'zgargan bo'lsa `docs/03-DATA-MODEL.md` yangilangan
- [ ] `.env.example` yangi o'zgaruvchini o'z ichiga oladi

## Hisobot
- [ ] Nima qilindi / qanday tekshirildi / nima qilinmadi / keyingi qadam — yozilgan
- [ ] Tekshirilmagan narsa "tekshirilmadi" deb aytilgan, "ishlaydi" deb emas

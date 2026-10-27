/**
 * The bot's Uzbek copy; ru.ts has the same shape. HTML parse mode: whatever a user typed comes in
 * already escaped. Amounts and dates come in formatted, so the texts never format numbers.
 */
export const uz = {
  /** The reply keyboard. The bot answers the buttons of both languages (see menuLabels). */
  menu: {
    expense: '➖ Chiqim',
    income: '➕ Kirim',
    balance: '💰 Balans',
    recent: '📋 Oxirgi amallar',
    report: '📊 Hisobot',
    budgets: '🎯 Byudjet',
    debts: '🤝 Qarzlar',
    settings: '⚙️ Sozlamalar',
    app: '🌐 Ilova',
  },
  /** The command menu next to the input field, and the Mini App button there. */
  commands: {
    start: 'Boshlash / kirish',
    menu: 'Menyu',
    balans: 'Balans',
  },
  menuButton: 'Ilova',
  /** The bot's profile: under its name (≤120) and on the empty chat and t.me page (≤512). */
  profile: {
    short: (host: string) => `FinTrack — xarajat, daromad va qarzlar hisobi. Sayt va ilova: ${host}`,
    long: (site: string) =>
      'Xarajat va daromadni shu yerga bir jumla bilan yozing: «50000 taksi», «+8 500 000 oylik». ' +
      'FinTrack ularni kategoriyalarga ajratadi, byudjet va qarzlarni kuzatib boradi.\n\n' +
      `Sayt va ilova: ${site}`,
  },
  common: {
    menuIntro:
      'Xarajat yoki kirimni shunchaki yozing, masalan:\n' +
      '• <code>50000 taksi</code>\n• <code>45k tushlik</code>\n• <code>+8 500 000 oylik</code>\n• <code>kecha 1,2 mln ijara</code>\n\n' +
      'Yoki pastdagi menyudan foydalaning 👇\n' +
      '<i>Menyuni yashirish yoki qayta ochish uchun yozish maydoni yonidagi tugmalar belgisini bosing.</i>',
    notRegistered: 'Avval ro‘yxatdan o‘ting: /start bosing va raqamingizni ulashing.',
    askEntry: (type: 'INCOME' | 'EXPENSE'): string =>
      type === 'INCOME'
        ? 'Kirim summasi va izohini yozing, masalan: <code>8 500 000 oylik</code>'
        : 'Chiqim summasi va izohini yozing, masalan: <code>50000 taksi</code>',
    notUnderstood:
      'Tushunmadim 🤔 Summani raqam bilan yozing, masalan: <code>50000 taksi</code> yoki <code>+2 mln oylik</code>.',
    draftExpired: 'Bu qoralama eskirgan. Qaytadan yozing.',
    genericError: 'Xatolik yuz berdi. Birozdan so‘ng qayta urinib ko‘ring.',
    today: 'bugun',
    yesterday: 'kecha',
    noAccount: 'hisob tanlanmagan',
    /** Uncategorised spending in a report: the stats leave its name to the reader. */
    otherCategory: 'Boshqa',
    openApp: '🌐 FinTrack ilovasini ochish',
    appOnlyOnSite: 'Ilova hozircha faqat saytda ochiladi.',
    appHint: 'Hisoblar, grafiklar va hisobotlar — to‘liq ilovada 👇',
  },
  buttons: {
    save: '✅ Saqlash',
    category: '📁 Kategoriya',
    account: '💳 Hisob',
    toExpense: '🔁 Chiqimga',
    toIncome: '🔁 Kirimga',
    cancel: '❌ Bekor',
    back: '⬅️ Orqaga',
    undo: '↩️ Bekor qilish',
    confirm: '✅ Tasdiqlash',
  },
  draft: {
    income: '➕ <b>Kirim</b>',
    expense: '➖ <b>Chiqim</b>',
    noCategory: '<i>kategoriya tanlanmagan</i>',
    fromVoice: '🎙 Ovozdan tanildi — tekshirib, saqlang.',
    check: 'To‘g‘rimi? Saqlash uchun tugmani bosing.',
  },
  entry: {
    cancelledToast: 'Bekor qilindi',
    cancelled: '❌ Bekor qilindi.',
    undone: '↩️ Yozuv bekor qilindi.',
    pickCategory: 'Avval kategoriyani tanlang',
    savedToast: 'Saqlandi ✅',
    saved: (entry: string) => `✅ Saqlandi: ${entry}`,
    accountBalance: (account: string, balance: string) => `${account} balansi: <b>${balance}</b>`,
    budgetAlert: (percent: number, spent: string, limit: string) => `⚠️ Byudjet ${percent}% ishlatildi (${spent} / ${limit})`,
  },
  reports: {
    period: { today: 'Bugun', week: 'Shu hafta', month: 'Shu oy' },
    periodButton: { today: 'Bugun', week: 'Hafta', month: 'Oy' },
    balanceTitle: '💰 <b>Balans</b>',
    archived: 'arxivda',
    total: 'Jami',
    recentTitle: '📋 <b>Oxirgi amallar</b>',
    recentEmpty: '📋 Hali hech qanday yozuv yo‘q. Boshlash uchun yozing: <code>50000 taksi</code>',
    digestTitle: '🌙 Kunlik xulosa',
    digestEmpty: 'Bugun hech narsa yozilmadi. Xarajatlaringizni shu yerga yozishni unutmang 🙂',
    budgetsEmpty: '🎯 Bu oy uchun byudjet belgilanmagan. Uni ilovadagi “Byudjetlar” bo‘limida qo‘shishingiz mumkin.',
    budgetsTitle: (month: string) => `🎯 <b>Byudjet (${month})</b>`,
    income: 'Kirim',
    expense: 'Chiqim',
    net: 'Sof',
    topExpenses: 'Eng ko‘p xarajat',
    totalBalance: 'Umumiy balans',
  },
  debts: {
    owesYou: (name: string) => `👤 ${name} sizga qarzdor`,
    youOwe: (name: string) => `👤 Siz ${name}ga qarzdorsiz`,
    overdue: (days: number) => `🔴 muddati ${days} kun o‘tgan`,
    due: (date: string) => `muddat ${date}`,
    remaining: 'Qoldiq',
    none: '🤝 Ochiq qarzlar yo‘q. Yangi qarzni ilovadagi “Qarzlar” bo‘limida qo‘shishingiz mumkin.',
    title: '🤝 <b>Qarzlar</b>',
    owedToMe: 'Sizga qarzdorlar',
    iOwe: 'Sizning qarzingiz',
    payButton: (name: string) => `💵 ${name}: to‘lov`,
    settleButton: '✅ To‘liq yopish',
    askAmount: (name: string, remaining: string) =>
      `💵 ${name} bo‘yicha qancha to‘landi? Summani yozing (qoldiq: ${remaining}).`,
    stale: 'Bu so‘rov eskirgan',
    notFound: 'Qarz topilmadi.',
    amountHint: 'Summani raqam bilan yozing, masalan: <code>200000</code> yoki <code>200 ming</code>',
    noAccount: 'Avval faol hisob yarating.',
    settleTitle: '✅ <b>Qarzni to‘liq yopish</b>',
    paymentTitle: '💵 <b>Qarz to‘lovi</b>',
    amountLine: (amount: string, remaining: string) => `Summa: <b>${amount}</b> (qoldiq ${remaining})`,
    recordedToast: 'Yozildi ✅',
    settled: '🎉 Qarz to‘liq yopildi!',
    paid: (amount: string) => `✅ To‘lov yozildi: <b>${amount}</b>`,
  },
  voice: {
    disabled: 'Ovozli xabarlar hozircha ishlamaydi. Summani matn bilan yozing, masalan: <code>50000 taksi</code>',
    tooLong: (seconds: number) => `Ovozli xabar ${seconds} soniyadan oshmasin. Qisqaroq qilib qayta yuboring.`,
    tooLarge: 'Fayl juda katta. Qisqa ovozli xabar yuboring.',
    downloadFailed: 'Ovozli xabarni yuklab bo‘lmadi. Birozdan so‘ng qayta urinib ko‘ring.',
    limit: 'Bugungi ovozli va AI so‘rovlar limiti tugadi. Ertaga urinib ko‘ring yoki matn bilan yozing, masalan: <code>50000 taksi</code>',
    unavailable: 'Hozir xabarni tahlil qilib bo‘lmadi 😕 Summani matn bilan yozing, masalan: <code>50000 taksi</code>',
    heard: (transcript: string) => `🎙 Eshitdim: «${transcript}»`,
    silence: '🎙 Ovozda gap eshitilmadi.',
    noAmount: 'Summani topa olmadim. Masalan, “taksiga yigirma ming” deb ayting.',
    several: (count: number) => `${count} ta yozuv topildi — har birini tekshirib, saqlang 👇`,
    debtHint: 'Qarz berish yoki olish xarajat emas: uni ilovadagi “Qarzlar” bo‘limida qo‘shing.',
  },
  settings: {
    text:
      '⚙️ <b>Sozlamalar</b>\n\n' +
      '<b>Qatʼiy rejim</b> — balansdan ortiq xarajat yozishga ruxsat bermaydi.\n' +
      '<b>Bildirishnomalar</b> — byudjet, qarz va takroriy to‘lov ogohlantirishlari.\n' +
      '<b>Eslatmalar</b> — har kuni 7:00 da; kun bo‘yi FinTrack’ga kirmasangiz, 22:00 da yana bir bor.\n' +
      '<b>Kunlik xulosa</b> — har kuni kechqurun bugungi kirim-chiqim.\n' +
      '<b>Oylik hisobot</b> — oyning oxirgi kuni 21:00 da: oy yakuni matn va ovozli xabar bo‘lib.\n' +
      '<b>Til</b> — bot, sayt va ilova shu tilda gapiradi.',
    strict: 'Qatʼiy rejim',
    notify: 'Bildirishnomalar',
    reminders: 'Eslatmalar (7:00 / 22:00)',
    digest: 'Kunlik xulosa (21:00)',
    monthly: 'Oylik hisobot',
    logoutAll: '🚪 Barcha qurilmalardan chiqish',
    savedToast: 'Saqlandi',
    loggedOutAll: 'Barcha qurilmalardagi sessiyalar yakunlandi',
    remindersOff: 'Eslatmalar o‘chirildi. Qayta yoqish: ⚙️ Sozlamalar',
    /** Sent with the new reply keyboard: Telegram changes it only with a message. */
    languageChanged: '🌐 Til: o‘zbekcha. Menyu ham yangilandi 👇',
  },
  reminders: {
    expense: '➖ Xarajat yozish',
    income: '➕ Kirim yozish',
    off: '🔕 Eslatmalarni o‘chirish',
    /** In place of a name that is empty. */
    friend: 'do‘st',
  },
  monthly: {
    voiceCaption: '🎧 Hisobotni tinglang',
  },
};

export const settings = {
  title: 'Sozlamalar',
  subtitle: 'Profil, qoidalar, ko‘rinish va xavfsizlik',
  profile: {
    title: 'Profil',
    name: 'Ism',
    nameLength: 'Ism 2 dan 100 belgigacha bo‘lishi kerak',
    timezone: 'Vaqt zonasi',
    timezoneHint: '“Bugun” shu zona bo‘yicha hisoblanadi.',
    saved: 'Profil saqlandi',
    settingsSaved: 'Sozlamalar saqlandi',
  },
  zones: {
    tashkent: 'Toshkent',
    samarkand: 'Samarqand',
    almaty: 'Olmaota',
    moscow: 'Moskva',
    istanbul: 'Istanbul',
    dubai: 'Dubay',
    seoul: 'Seul',
    london: 'London',
    newYork: 'Nyu-York',
  },
  prefs: {
    title: 'Moliyaviy qoidalar va bildirishnomalar',
    strictModeText:
      'Yoqilganda balansingizdan ortiq xarajat yozib bo‘lmaydi. O‘chirilganda balans manfiyga tushishi mumkin va qizil ko‘rsatiladi.',
    notifyTelegram: 'Telegram bildirishnomalari',
    notifyTelegramText: 'Byudjet, qarz muddati va takroriy to‘lovlar haqidagi ogohlantirishlar botga ham keladi.',
    dailyReminders: 'Kunlik eslatmalar',
    dailyRemindersText: 'Har kuni soat 7:00 da yozib borishni eslatamiz. Kun bo‘yi FinTrack’ga kirmasangiz, 22:00 da yana bir bor.',
    dailyDigest: 'Kunlik xulosa',
    dailyDigestText: 'Har kuni soat 21:00 da bugungi kirim-chiqim xulosasi Telegram’ga yuboriladi.',
    monthlyReport: 'Oylik hisobot',
    monthlyReportText:
      'Oyning oxirgi kuni soat 21:00 da oy yakuni Telegram’ga keladi: matn va uning ostida ovozli xabar. O‘sha kuni kunlik xulosa o‘rniga.',
  },
  appearance: {
    title: 'Ko‘rinish',
    description: 'Mavzu shu qurilmada saqlanadi',
    system: 'Tizim',
  },
  telegram: {
    account: 'Telegram hisobi',
    linked: 'Ulangan',
    linkedText: 'Kirish kodlari va bildirishnomalar shu hisobga keladi.',
    notLinked: 'Telegram ulanmagan',
    notLinkedText: 'Bildirishnomalar va kirish kodlarini olish uchun hisobingizni ulang.',
    link: 'Telegram’ni ulash',
    waiting: 'Telegram’da @{bot} ochildi — “Start” tugmasini bosing…',
  },
  sessions: {
    title: 'Faol sessiyalar',
    description: 'FinTrack ochiq bo‘lgan qurilmalar',
    unknownDevice: 'Nomaʼlum qurilma',
    telegramApp: 'Telegram ilovasi',
    browser: 'Brauzer',
    unknownIp: 'IP nomaʼlum',
    activeNow: 'hozir faol',
    lastActive: 'oxirgi faollik {date}',
    thisDevice: 'Shu qurilma',
    end: 'Yakunlash',
    loadFailed: 'Sessiyalarni yuklab bo‘lmadi',
    endAll: 'Barcha qurilmalardan chiqish',
    endAllTitle: 'Barcha qurilmalardan chiqilsinmi?',
    endAllMiniApp: 'Boshqa qurilmalardagi sessiyalar yakunlanadi. Shu ilovada kirgan holatda qolasiz.',
    endAllWeb: 'Barcha qurilmalardagi sessiyalar, shu jumladan bu qurilmadagi ham yakunlanadi. Keyin Telegram orqali qayta kirasiz.',
    ended: 'Sessiya yakunlandi',
    othersEnded: 'Boshqa qurilmalardagi sessiyalar yakunlandi',
  },
  danger: {
    title: 'Akkauntni o‘chirish',
    text: 'Barcha hisoblar, tranzaksiyalar, qarzlar va byudjetlar butunlay o‘chiriladi. Bu amalni qaytarib bo‘lmaydi.',
    confirmTitle: 'Akkaunt butunlay o‘chirilsinmi?',
    confirmLabel: 'Butunlay o‘chirish',
    typeToConfirm: 'Tasdiqlash uchun “{word}” deb yozing',
    button: 'Akkauntni butunlay o‘chirish',
  },
};

export const miniApp = {
  signingIn: 'Kirilmoqda',
  backToBot: 'Botga qaytish',
  gate: {
    unregistered: {
      title: 'Avval botda ro‘yxatdan o‘ting',
      body: 'Botga qaytib /start bosing va telefon raqamingizni ulashing. Shundan so‘ng ilovani qayta oching.',
    },
    banned: {
      title: 'Hisobingiz bloklangan',
      body: 'FinTrack hisobingiz bloklangan, shuning uchun ilova, sayt va bot orqali kirib bo‘lmaydi.',
    },
    expired: {
      title: 'Ilova sessiyasi tugadi',
      body: 'Xavfsizlik uchun ilova sessiyasi 24 soat amal qiladi. Ilovani botdagi “Ilova” tugmasi orqali qayta oching.',
    },
    noInitData: {
      title: 'Ilovani menyu tugmasi orqali oching',
      body: 'Botdagi “Ilova” tugmasi (xabar yozish maydoni yonida) yoki “🌐 FinTrack ilovasini ochish” tugmasidan foydalaning.',
    },
    error: {
      title: 'Ulanib bo‘lmadi',
      body: 'Server bilan bog‘lanishda xatolik yuz berdi. Birozdan so‘ng qayta urinib ko‘ring.',
    },
  },
};

export const pages = {
  error: {
    title: 'Xatolik yuz berdi',
    text: 'Sahifani ko‘rsatishda kutilmagan muammo chiqdi. Maʼlumotlaringiz saqlanib qolgan — sahifani yangilab ko‘ring.',
    reload: 'Sahifani yangilash',
    home: 'Bosh sahifaga o‘tish',
  },
  notFound: {
    title: 'Sahifa topilmadi',
    text: 'Siz qidirayotgan sahifa mavjud emas yoki boshqa manzilga ko‘chirilgan.',
    home: 'Asosiy sahifaga qaytish',
  },
};

/**
 * Card notifications laid out exactly as the official bots send them (emoji, spacing, trailing
 * spaces, separators: that is what the parser reads). Every figure, time, card number, bank and
 * address is made up; only public merchant names are kept, because the classifier reads them.
 */
export const UZCARD = {
  purchase:
    '🔴 Pokupka\n➖ 18 450.00 UZS\n💳 ***1111\n📍 ANGLESEY FOOD, TASHKENT, CHILANZARSKIY RAYON UL NAVOIY \n🕓 31.10.26 21:14\n💵 352 418.40 UZS',
  transport:
    '🔴 Pokupka\n➖ 3 000.00 UZS\n💳 ***1111\n📍 OOO ATTO TOLOV, M CHORSU, GP M CHORSU UL CHORSU DOM 1 \n🕓 01.11.26 09:40\n💵 349 418.40 UZS',
  ecom: '🔴 E-Com oplata\n➖ 12 800.00 UZS\n💳 ***2222\n📍 OOO WB TAXI, UZ\n🕓 02.11.26 08:15\n💵 7 250.16 UZS',
  p2pOut: '🔴 Platezh\n➖ 40 440.00 UZS\n💳 ***1111\n📍 CLICK P2P U2HEW, UZ\n🕓 31.10.26 20:51\n💵 370 868.40 UZS',
  toVisa: '🔴 Platezh\n➖ 120 000.00 UZS\n💳 ***1111\n📍 UZCARD TO VISA, UZ\n🕓 03.11.26 09:15\n💵 229 418.40 UZS',
  toHumo: '🔴 Platezh\n➖ 45 000.00 UZS\n💳 ***1111\n📍 UB P2P UZCARD2HUMO, UZ\n🕓 04.11.26 17:36\n💵 184 418.40 UZS',
  transferIn: '🟢 Perevod na kartu\n➕ 75 000.00 UZS\n💳 ***1111\n📍 CLICK P2P H2UEW, UZ\n🕓 02.11.26 11:48\n💵 520 918.40 UZS',
  topUp: '🟢 Popolnenie scheta\n➕ 1 742 305.50 UZS\n💳 ***2222\n📍 BO GATE, UZ\n🕓 05.11.26 13:20\n💵 1 749 555.66 UZS',
  refund: '🟢 OTMENA E-Com oplata\n➕ 96 500.00 UZS\n💳 ***1111\n📍 OOO UZUM, UZ\n🕓 02.11.26 11:41\n💵 445 918.40 UZS',
  declined: 'NEDOSTATOCHNO SREDSTV 5614***2222 04.11.26 19:05  POS purchase 0.00 UZS',
  totalBalance:
    "💳 Umumiy balans:\n   💰 412 760.90 so'm\n\n\n💳 Karta: 860012******1111\n🏦 Bank: TEST BANK\n👤 TEST USER\n 💸 355 918.40 so'm",
  welcome: '🇺🇿 "CardXabar"ga xush kelibsiz!\n\n"CardXabar" dan foydalanish bo\'yicha qisqacha ko\'rsatma\n👉 Batafsil bu yerda',
} as const;

export const HUMO = {
  payment: "💸 To'lov\n➖ 1.700,00 UZS\n📍 TRANSPORT TOLOV>M U\n💳 HUMOCARD *3333\n🕓 08:00 19.02.2026\n💰 995,94 UZS",
  topUp: "🎉 To'ldirish\n➕ 1.100,00 UZS\n📍 CLICK P2P>TOSHKENT S\n💳 HUMOCARD *3333\n🕓 15:49 19.02.2026\n💰 2.095,94 UZS",
} as const;

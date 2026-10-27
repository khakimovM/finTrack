/** Picks the most likely category for a free-text note; the user always confirms or changes it. */

export interface GuessableCategory {
  id: string;
  name: string;
  type: 'INCOME' | 'EXPENSE';
}

/**
 * Keyword stems → one of the default categories (see user-defaults.ts), by its Uzbek and its
 * Russian name: an account keeps the names it was created with, whatever language it writes in.
 */
const KEYWORDS: Array<{ names: string[]; stems: string[] }> = [
  {
    names: ['Oziq-ovqat', 'Продукты'],
    stems: [
      'ovqat', 'non', "go'sht", 'gosht', 'bozor', 'market', 'magazin', 'supermarket', 'makro', 'korzinka',
      'tushlik', 'nonushta', 'kechki', 'kafe', 'restoran', 'choy', 'kofe', 'lavash', 'osh', 'somsa',
      'shashlik', 'meva', 'sabzavot', 'sut', 'yogurt', 'pishloq', 'fastfood', 'burger', 'pitsa', 'pizza',
      'продукт', 'еда', 'еды', 'хлеб', 'мясо', 'базар', 'рынок', 'магазин', 'супермаркет', 'макро', 'корзинк',
      'обед', 'завтрак', 'ужин', 'кафе', 'ресторан', 'кофе', 'лаваш', 'плов', 'самс', 'шашлык',
      'фрукт', 'овощ', 'молок', 'сыр', 'бургер', 'пицц', 'фастфуд',
    ],
  },
  {
    names: ['Transport', 'Транспорт'],
    stems: [
      'taksi', 'taxi', 'yandex', 'metro', 'avtobus', 'benzin', "yoqilg'i", 'yoqilgi', 'propan', 'metan',
      'gaz quy', 'parkovka', 'moyka', 'avtomobil', 'mashina', 'shina', 'poyezd', 'samolyot', 'avia',
      'такси', 'яндекс', 'метро', 'автобус', 'бензин', 'топлив', 'пропан', 'метан', 'заправк',
      'парковк', 'мойк', 'машин', 'шиномонтаж', 'поезд', 'самолёт', 'самолет', 'авиа',
    ],
  },
  {
    names: ['Uy-joy', 'Жильё', 'Жилье'],
    stems: ['ijara', 'kvartira', 'arenda', 'remont', "ta'mir", 'mebel', 'uy ', 'аренд', 'квартир', 'ремонт', 'мебел'],
  },
  {
    names: ['Kommunal', 'Коммунальные услуги'],
    stems: [
      'svet', 'elektr', 'gaz', 'suv', 'kommunal', 'internet', 'telefon', 'uzmobile', 'beeline', 'ucell', 'mobiuz', 'isitish',
      'свет', 'электр', 'газ ', 'вода', 'воду', 'коммунал', 'интернет', 'телефон', 'связь', 'отоплен',
    ],
  },
  {
    names: ['Kiyim', 'Одежда'],
    stems: [
      'kiyim', 'poyabzal', 'krossovka', "ko'ylak", 'koylak', 'shim', 'kurtka', 'futbolka',
      'одежд', 'обувь', 'кроссовк', 'рубашк', 'брюки', 'джинс', 'куртк', 'футболк', 'платье',
    ],
  },
  {
    names: ["Sog'liq", 'Здоровье'],
    stems: [
      'dori', 'apteka', 'dorixona', 'shifokor', 'klinika', 'stomatolog', 'tish', 'analiz', 'shifoxona',
      'лекарств', 'аптек', 'врач', 'клиник', 'стоматолог', 'зуб', 'анализ', 'больниц',
    ],
  },
  {
    names: ["Ko'ngilochar", 'Развлечения'],
    stems: [
      'kino', "o'yin", 'oyin', 'konsert', 'dam olish', 'sayohat', 'obuna', 'netflix', 'spotify', 'playstation',
      'кино', 'игр', 'концерт', 'отдых', 'путешеств', 'подписк',
    ],
  },
  {
    names: ["Ta'lim", 'Образование'],
    stems: [
      'kurs', 'kitob', "o'qish", 'oqish', 'kontrakt', 'repetitor', 'universitet', 'maktab', 'ielts',
      'курс', 'книг', 'учёб', 'учеб', 'контракт', 'репетитор', 'университет', 'школ',
    ],
  },
  { names: ['Oylik', 'Зарплата'], stems: ['oylik', 'maosh', 'zarplata', 'avans', 'зарплат', 'зп', 'аванс', 'оклад'] },
  {
    names: ["Qo'shimcha daromad", 'Доп. доход'],
    stems: [
      'bonus', 'freelance', 'frilans', "qo'shimcha", 'sotdim', 'foyda', 'dividend',
      'премия', 'премию', 'бонус', 'фриланс', 'подработк', 'продал', 'дивиденд', 'кэшбэк', 'кешбэк',
    ],
  },
];

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function guessCategory<T extends GuessableCategory>(
  note: string,
  type: 'INCOME' | 'EXPENSE',
  categories: T[],
): T | null {
  const text = ` ${normalizeText(note)} `;
  const candidates = categories.filter((c) => c.type === type);
  if (!text.trim() || candidates.length === 0) return null;

  // 1. The user's own category name appears in the note ("Taksi" subcategory beats "Transport").
  const byName = candidates
    .filter((c) => normalizeText(c.name).length >= 3 && text.includes(normalizeText(c.name)))
    .sort((a, b) => b.name.length - a.name.length);
  if (byName.length > 0) return byName[0];

  // 2. A known keyword maps to one of the default categories the user still has.
  for (const { names, stems } of KEYWORDS) {
    if (stems.some((stem) => text.includes(` ${stem}`))) {
      const match = candidates.find((c) => names.some((name) => normalizeText(c.name) === normalizeText(name)));
      if (match) return match;
    }
  }
  return null;
}

/** Picks the most likely category for a free-text note; the user always confirms or changes it. */

export interface GuessableCategory {
  id: string;
  name: string;
  type: 'INCOME' | 'EXPENSE';
}

/** Keyword stems → name of one of the default categories (see user-defaults.ts). */
const KEYWORDS: Record<string, string[]> = {
  'Oziq-ovqat': [
    'ovqat', 'non', "go'sht", 'gosht', 'bozor', 'market', 'magazin', 'supermarket', 'makro', 'korzinka',
    'tushlik', 'nonushta', 'kechki', 'kafe', 'restoran', 'choy', 'kofe', 'lavash', 'osh', 'somsa',
    'shashlik', 'meva', 'sabzavot', 'sut', 'yogurt', 'pishloq', 'fastfood', 'burger', 'pitsa', 'pizza',
  ],
  Transport: [
    'taksi', 'taxi', 'yandex', 'metro', 'avtobus', 'benzin', "yoqilg'i", 'yoqilgi', 'propan', 'metan',
    'gaz quy', 'parkovka', 'moyka', 'avtomobil', 'mashina', 'shina', 'poyezd', 'samolyot', 'avia',
  ],
  'Uy-joy': ['ijara', 'kvartira', 'arenda', 'remont', "ta'mir", 'mebel', 'uy '],
  Kommunal: ['svet', 'elektr', 'gaz', 'suv', 'kommunal', 'internet', 'telefon', 'uzmobile', 'beeline', 'ucell', 'mobiuz', 'isitish'],
  Kiyim: ['kiyim', 'poyabzal', 'krossovka', "ko'ylak", 'koylak', 'shim', 'kurtka', 'futbolka'],
  "Sog'liq": ['dori', 'apteka', 'dorixona', 'shifokor', 'klinika', 'stomatolog', 'tish', 'analiz', 'shifoxona'],
  "Ko'ngilochar": ['kino', "o'yin", 'oyin', 'konsert', 'dam olish', 'sayohat', 'obuna', 'netflix', 'spotify', 'playstation'],
  "Ta'lim": ['kurs', 'kitob', "o'qish", 'oqish', 'kontrakt', 'repetitor', 'universitet', 'maktab', 'ielts'],
  Oylik: ['oylik', 'maosh', 'zarplata', 'avans'],
  "Qo'shimcha daromad": ['bonus', 'freelance', 'frilans', "qo'shimcha", 'sotdim', 'foyda', 'dividend'],
};

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
  for (const [categoryName, stems] of Object.entries(KEYWORDS)) {
    if (stems.some((stem) => text.includes(` ${stem}`))) {
      const match = candidates.find((c) => normalizeText(c.name) === normalizeText(categoryName));
      if (match) return match;
    }
  }
  return null;
}

import { guessCategory } from '../parsing/category-guesser';

const categories = [
  { id: 'food', name: 'Oziq-ovqat', type: 'EXPENSE' as const },
  { id: 'transport', name: 'Transport', type: 'EXPENSE' as const },
  { id: 'taxi', name: 'Taksi', type: 'EXPENSE' as const },
  { id: 'health', name: 'Sog‘liq', type: 'EXPENSE' as const },
  { id: 'salary', name: 'Oylik', type: 'INCOME' as const },
];

describe('guessCategory', () => {
  it.each([
    ['yandex taksi', 'EXPENSE', 'taxi'],
    ['benzin quydim', 'EXPENSE', 'transport'],
    ['bozordan go‘sht', 'EXPENSE', 'food'],
    ['dorixona', 'EXPENSE', 'health'],
    ['sentabr oyligi maosh', 'INCOME', 'salary'],
  ] as const)('%s → %s', (note, type, expected) => {
    expect(guessCategory(note, type, categories)?.id).toBe(expected);
  });

  it('never returns a category of the other type', () => {
    expect(guessCategory('oylik', 'EXPENSE', categories)).toBeNull();
  });

  it('returns null when nothing matches', () => {
    expect(guessCategory('allaqanday narsa', 'EXPENSE', categories)).toBeNull();
    expect(guessCategory('', 'EXPENSE', categories)).toBeNull();
  });
});

describe('guessCategory in Russian', () => {
  const russian = [
    { id: 'food', name: 'Продукты', type: 'EXPENSE' as const },
    { id: 'transport', name: 'Транспорт', type: 'EXPENSE' as const },
    { id: 'housing', name: 'Жильё', type: 'EXPENSE' as const },
    { id: 'salary', name: 'Зарплата', type: 'INCOME' as const },
  ];

  it.each([
    ['обед', 'EXPENSE', 'food'],
    ['корзинка', 'EXPENSE', 'food'],
    ['такси до работы', 'EXPENSE', 'transport'],
    ['аренда', 'EXPENSE', 'housing'],
    ['зарплата за октябрь', 'INCOME', 'salary'],
  ] as const)('%s → %s', (note, type, expected) => {
    expect(guessCategory(note, type, russian)?.id).toBe(expected);
  });

  it('finds the Uzbek-named category for Russian words, and the other way round', () => {
    expect(guessCategory('такси', 'EXPENSE', categories)?.id).toBe('transport');
    expect(guessCategory('taksi', 'EXPENSE', russian)?.id).toBe('transport');
  });
});

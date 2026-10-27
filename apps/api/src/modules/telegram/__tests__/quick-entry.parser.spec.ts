import { parseQuickEntry } from '../parsing/quick-entry.parser';

const SOM = 100n;

describe('parseQuickEntry', () => {
  it.each([
    ['50000 taksi', 50_000n * SOM, 'taksi'],
    ['taksi 50000', 50_000n * SOM, 'taksi'],
    ['50 000 taksi', 50_000n * SOM, 'taksi'],
    ['50.000 non', 50_000n * SOM, 'non'],
    ['50k tushlik', 50_000n * SOM, 'tushlik'],
    ['taksiga 20 ming', 20_000n * SOM, 'taksiga'],
    ['1,5 mln ijara', 1_500_000n * SOM, 'ijara'],
    ['2.5k kofe', 2_500n * SOM, 'kofe'],
    ['12500,50 dorixona', 1_250_050n, 'dorixona'],
    ['300 000 so‘m kommunal', 300_000n * SOM, 'kommunal'],
    ['45000', 45_000n * SOM, ''],
  ])('%s', (input, amount, note) => {
    const parsed = parseQuickEntry(input);
    expect(parsed).not.toBeNull();
    expect(parsed?.amount).toBe(amount);
    expect(parsed?.note).toBe(note);
  });

  it('accepts the no-break spaces phones insert when pasting formatted numbers', () => {
    const nbsp = String.fromCharCode(0xa0);
    const narrow = String.fromCharCode(0x202f);
    expect(parseQuickEntry(`1${nbsp}250${nbsp}000 ijara`)?.amount).toBe(1_250_000n * SOM);
    expect(parseQuickEntry(`75${narrow}000 kiyim`)?.amount).toBe(75_000n * SOM);
  });

  it('defaults to an expense', () => {
    expect(parseQuickEntry('50000 taksi')).toMatchObject({ type: 'EXPENSE', typeExplicit: false });
  });

  it.each(['+8 500 000 oylik', '8 500 000 oylik keldi', 'maosh 8.5 mln'])('recognises income: %s', (input) => {
    expect(parseQuickEntry(input)).toMatchObject({ type: 'INCOME', typeExplicit: true });
  });

  it('keeps "-" as an explicit expense', () => {
    expect(parseQuickEntry('-20000 oylik obuna')).toMatchObject({ type: 'EXPENSE', typeExplicit: true });
  });

  it('understands "kecha" (yesterday)', () => {
    expect(parseQuickEntry('kecha 45k tushlik')).toMatchObject({ daysAgo: 1, note: 'tushlik', amount: 45_000n * SOM });
  });

  it.each(['salom', 'balans qancha?', '', '0 taksi', '9'.repeat(20) + ' taksi'])('rejects %p', (input) => {
    expect(parseQuickEntry(input)).toBeNull();
  });
});

describe('parseQuickEntry in Russian', () => {
  it.each([
    ['45к обед', 45_000n * SOM, 'обед', 0],
    ['50000 такси', 50_000n * SOM, 'такси', 0],
    ['20 тыс такси', 20_000n * SOM, 'такси', 0],
    ['20 тыс. такси', 20_000n * SOM, 'такси', 0],
    ['на обед 45 тысяч', 45_000n * SOM, 'на обед', 0],
    ['3 тыщи кофе', 3_000n * SOM, 'кофе', 0],
    ['вчера 1,2 млн аренда', 1_200_000n * SOM, 'аренда', 1],
    ['2 миллиона машина', 2_000_000n * SOM, 'машина', 0],
    ['позавчера 30000 обед', 30_000n * SOM, 'обед', 2],
    ['сегодня 15000 сумов кофе', 15_000n * SOM, 'кофе', 0],
  ] as const)('%s', (input, amount, note, daysAgo) => {
    const parsed = parseQuickEntry(input);
    expect(parsed?.amount).toBe(amount);
    expect(parsed?.note).toBe(note);
    expect(parsed?.daysAgo).toBe(daysAgo);
  });

  it('takes a lone "к" for the preposition, not for thousands', () => {
    expect(parseQuickEntry('500 к чаю')?.amount).toBe(500n * SOM);
    expect(parseQuickEntry('500 к чаю')?.note).toBe('к чаю');
  });

  it('tells income by Russian words and the plus sign', () => {
    expect(parseQuickEntry('+8 500 000 зарплата')).toMatchObject({ type: 'INCOME', typeExplicit: true });
    expect(parseQuickEntry('2 млн зарплату получил')).toMatchObject({ type: 'INCOME', amount: 2_000_000n * SOM });
    expect(parseQuickEntry('500к премия')?.type).toBe('INCOME');
    expect(parseQuickEntry('100000 потратил на подарок')).toMatchObject({ type: 'EXPENSE', typeExplicit: true });
    expect(parseQuickEntry('100000 подарок')).toMatchObject({ type: 'EXPENSE', typeExplicit: false });
  });
});

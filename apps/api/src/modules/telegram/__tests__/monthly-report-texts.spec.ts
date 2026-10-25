import { MonthlyReportData, monthlyReportScript, monthlyReportText, spokenSom } from '../outbox/monthly-report-texts';

const october = (over: Partial<MonthlyReportData> = {}): MonthlyReportData => ({
  from: new Date('2026-10-01T00:00:00.000Z'),
  to: new Date('2026-10-31T00:00:00.000Z'),
  name: 'Aziz Khakimov',
  income: 125_000_000n,
  expense: 84_350_000n,
  entries: 42,
  previous: { expense: 95_000_000n, changePercent: -11.2 },
  top: [
    { icon: '🍞', name: 'Oziq-ovqat', amount: 40_000_000n, percent: 47 },
    { icon: '🚕', name: 'Transport', amount: 20_000_000n, percent: 24 },
    { icon: '🏠', name: 'Uy & ro‘zg‘or', amount: 10_000_000n, percent: 12 },
    { icon: '☕', name: 'Kafe', amount: 5_000_000n, percent: 6 },
  ],
  budgets: { total: 3, exceeded: [{ icon: '🚕', name: 'Transport', percent: 112 }] },
  debts: { owedToMe: 50_000_000n, iOwe: 0n },
  totalBalance: 320_000_000n,
  ...over,
});

const empty = october({
  income: 0n,
  expense: 0n,
  entries: 0,
  previous: null,
  top: [],
  budgets: { total: 0, exceeded: [] },
  debts: { owedToMe: 0n, iOwe: 0n },
  totalBalance: -1_500_000n,
});

describe('monthlyReportText', () => {
  it('reads like the app: totals, the change, top categories, budgets, debts and the balance', () => {
    const text = monthlyReportText(october());
    expect(text.split('\n').slice(0, 7)).toEqual([
      '📅 <b>Oktabr oyi hisoboti</b>',
      '1–31-oktabr · 42 ta yozuv',
      '',
      '⬆️ Kirim: <b>1 250 000 so‘m</b>',
      '⬇️ Chiqim: <b>843 500 so‘m</b>',
      '💵 Sof: <b>406 500 so‘m</b>',
      '📉 Chiqim sentabrdagidan 11% kam',
    ]);
    expect(text).toContain('🍞 Oziq-ovqat — 400 000 so‘m (47%)\n▓▓▓▓▓░░░░░');
    expect(text).toContain('🏠 Uy &amp; ro‘zg‘or');
    expect(text).toContain('🎯 Byudjetlar: 3 tadan 2 tasi chegarada\n🔴 🚕 Transport — 112%');
    expect(text).toContain('🤝 Sizga qaytarilishi kerak: <b>500 000 so‘m</b>');
    expect(text).not.toContain('Siz qaytarishingiz kerak');
    expect(text).toContain('💰 Umumiy balans: <b>3 200 000 so‘m</b>');
    expect(text.endsWith('✨ Noyabrda ham har bir xarajatni yozib boring!')).toBe(true);
  });

  it('leaves out what a quiet month does not have, and shows a negative balance as such', () => {
    const text = monthlyReportText(empty);
    expect(text).toContain('1–31-oktabr · 0 ta yozuv');
    expect(text).not.toMatch(/Eng ko‘p xarajat|Byudjetlar|🤝|📈|📉/);
    expect(text).toContain('💰 Umumiy balans: <b>−15 000 so‘m</b>');
  });

  it('turns over the year: December compares with November and looks ahead to January', () => {
    const text = monthlyReportText(
      october({
        from: new Date('2026-12-01T00:00:00.000Z'),
        to: new Date('2026-12-31T00:00:00.000Z'),
        previous: { expense: 1n, changePercent: 25 },
      }),
    );
    expect(text).toContain('📅 <b>Dekabr oyi hisoboti</b>');
    expect(text).toContain('📈 Chiqim noyabrdagidan 25% ko‘p');
    expect(text).toContain('✨ Yanvarda ham');
  });
});

describe('monthlyReportScript', () => {
  it('says the same in plain sentences, numbers in words, the top three only', () => {
    expect(monthlyReportScript(october())).toBe(
      [
        'Salom, Aziz! Oktabr oyi hisobotingiz tayyor.',
        'Bu oy qirq ikkita yozuv qildingiz.',
        'Kirim: bir million ikki yuz ellik ming so‘m. Chiqim: sakkiz yuz qirq to‘rt ming so‘m.',
        'Oy davomida to‘rt yuz olti ming so‘m ortib qoldi.',
        'Chiqim sentabrdagidan o‘n bir foiz kam.',
        'Eng katta xarajat — Oziq-ovqat: to‘rt yuz ming so‘m.',
        'Undan keyin: Transport — ikki yuz ming so‘m, Uy & ro‘zg‘or — yuz ming so‘m.',
        'Byudjetlardan bittasi oshib ketdi: Transport.',
        'Umumiy balansingiz: uch million ikki yuz ming so‘m.',
        'Noyabrda ham har bir xarajatni yozib boring. Omad!',
      ].join(' '),
    );
  });

  it('keeps a quiet month short and says a negative balance out loud', () => {
    expect(monthlyReportScript(empty)).toBe(
      'Salom, Aziz! Oktabr oyi hisobotingiz tayyor. Bu oy hali yozuv qilmadingiz. ' +
        'Umumiy balansingiz manfiy: minus o‘n besh ming so‘m. Noyabrda ham har bir xarajatni yozib boring. Omad!',
    );
  });

  it('counts one as "bitta", says an overspent month and a month like the last one', () => {
    const script = monthlyReportScript(
      october({
        name: '  ',
        entries: 21,
        income: 10_000_000n,
        expense: 30_000_000n,
        previous: { expense: 30_000_000n, changePercent: 0.3 },
        budgets: { total: 2, exceeded: [] },
      }),
    );
    expect(script).toContain('Salom, do‘st!');
    expect(script).toContain('Bu oy yigirma bitta yozuv qildingiz.');
    expect(script).toContain('Chiqim kirimdan ikki yuz ming so‘m ko‘p bo‘ldi.');
    expect(script).toContain('Chiqim sentabrdagidek bo‘ldi.');
    expect(script).toContain('Barcha byudjetlar chegarada qoldi.');
  });
});

describe('spokenSom', () => {
  it('rounds to the thousand from ten thousand up and drops the tiyin', () => {
    expect(spokenSom(950_00n)).toBe('to‘qqiz yuz ellik so‘m');
    expect(spokenSom(9_999_99n)).toBe('to‘qqiz ming to‘qqiz yuz to‘qson to‘qqiz so‘m');
    expect(spokenSom(12_499_00n)).toBe('o‘n ikki ming so‘m');
    expect(spokenSom(-12_500_00n)).toBe('o‘n uch ming so‘m');
  });
});

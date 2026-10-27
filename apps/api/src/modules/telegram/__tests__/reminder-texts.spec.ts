import { reminderKeyboard, reminderText } from '../outbox/reminder-texts';

// 2026-10-19 is a Monday.
const WEEK = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'];

describe('reminder texts', () => {
  it('has a different text for every day of the week, morning and evening apart', () => {
    const mornings = WEEK.map((day) => reminderText('morning', day, 'Aziz', 'uz'));
    const evenings = WEEK.map((day) => reminderText('evening', day, 'Aziz', 'uz'));

    expect(new Set(mornings).size).toBe(7);
    expect(new Set(evenings).size).toBe(7);
    expect(mornings.some((text) => evenings.includes(text))).toBe(false);
    expect(mornings.every((text) => text.includes('Xayrli tong'))).toBe(true);
  });

  it('follows the weekday, so the same day next week reads the same', () => {
    expect(reminderText('morning', '2026-10-19', 'Aziz', 'uz')).toContain('Yangi hafta');
    expect(reminderText('morning', '2026-10-23', 'Aziz', 'uz')).toContain('Juma');
    expect(reminderText('morning', '2026-10-26', 'Aziz', 'uz')).toBe(reminderText('morning', '2026-10-19', 'Aziz', 'uz'));
    expect(reminderText('evening', '2026-11-01', 'Aziz', 'uz')).toBe(reminderText('evening', '2026-10-25', 'Aziz', 'uz'));
  });

  it('greets by the first name, escaped for HTML, and copes with an empty one', () => {
    expect(reminderText('morning', '2026-10-20', '  Aziz   Khakimov ', 'uz')).toContain('Xayrli tong, Aziz!');
    expect(reminderText('evening', '2026-10-20', '<b>Ali</b> Valiyev', 'uz')).toContain('&lt;b&gt;Ali&lt;/b&gt;');
    expect(reminderText('evening', '2026-10-20', ' ', 'uz')).toContain('do‘st');
    expect(reminderText('morning', '2026-10-20', 'Aziz', 'uz')).not.toContain('{name}');
  });

  it('offers recording right away, and switching off until it is used', () => {
    const data = (withOff?: boolean) =>
      reminderKeyboard('uz', withOff).inline_keyboard.flat().map((b) => ('callback_data' in b ? b.callback_data : undefined));

    expect(data()).toEqual(['rem:expense', 'rem:income', 'rem:off']);
    expect(data(false)).toEqual(['rem:expense', 'rem:income']);
  });
});

describe('reminder texts in Russian', () => {
  it('has its own seven mornings and seven evenings, greeting by name', () => {
    const mornings = WEEK.map((day) => reminderText('morning', day, 'Aziz Khakimov', 'ru'));
    const evenings = WEEK.map((day) => reminderText('evening', day, 'Aziz', 'ru'));

    expect(new Set(mornings).size).toBe(7);
    expect(new Set(evenings).size).toBe(7);
    expect(mornings.every((text) => text.includes('Доброе утро, Aziz!'))).toBe(true);
    expect(evenings.every((text) => text.includes('Aziz') && !text.includes('{name}'))).toBe(true);
    expect(reminderText('morning', '2026-10-19', 'Aziz', 'ru')).toContain('новая неделя');
  });

  it('calls a nameless person a friend, in Russian', () => {
    expect(reminderText('evening', '2026-10-20', ' ', 'ru')).toContain('друг');
  });

  it('labels the buttons in Russian and keeps the same callbacks', () => {
    const buttons = reminderKeyboard('ru').inline_keyboard.flat();
    expect(buttons.map((b) => ('callback_data' in b ? b.callback_data : undefined))).toEqual(['rem:expense', 'rem:income', 'rem:off']);
    expect(buttons.every((b) => /[А-Яа-яЁё]/.test(b.text))).toBe(true);
  });
});

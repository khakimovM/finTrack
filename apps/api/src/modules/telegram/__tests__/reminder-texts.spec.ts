import { reminderKeyboard, reminderText } from '../outbox/reminder-texts';

// 2026-10-19 is a Monday.
const WEEK = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'];

describe('reminder texts', () => {
  it('has a different text for every day of the week, morning and evening apart', () => {
    const mornings = WEEK.map((day) => reminderText('morning', day, 'Aziz'));
    const evenings = WEEK.map((day) => reminderText('evening', day, 'Aziz'));

    expect(new Set(mornings).size).toBe(7);
    expect(new Set(evenings).size).toBe(7);
    expect(mornings.some((text) => evenings.includes(text))).toBe(false);
    expect(mornings.every((text) => text.includes('Xayrli tong'))).toBe(true);
  });

  it('follows the weekday, so the same day next week reads the same', () => {
    expect(reminderText('morning', '2026-10-19', 'Aziz')).toContain('Yangi hafta');
    expect(reminderText('morning', '2026-10-23', 'Aziz')).toContain('Juma');
    expect(reminderText('morning', '2026-10-26', 'Aziz')).toBe(reminderText('morning', '2026-10-19', 'Aziz'));
    expect(reminderText('evening', '2026-11-01', 'Aziz')).toBe(reminderText('evening', '2026-10-25', 'Aziz'));
  });

  it('greets by the first name, escaped for HTML, and copes with an empty one', () => {
    expect(reminderText('morning', '2026-10-20', '  Aziz   Khakimov ')).toContain('Xayrli tong, Aziz!');
    expect(reminderText('evening', '2026-10-20', '<b>Ali</b> Valiyev')).toContain('&lt;b&gt;Ali&lt;/b&gt;');
    expect(reminderText('evening', '2026-10-20', ' ')).toContain('do‘st');
    expect(reminderText('morning', '2026-10-20', 'Aziz')).not.toContain('{name}');
  });

  it('offers recording right away, and switching off until it is used', () => {
    const data = (withOff?: boolean) =>
      reminderKeyboard(withOff).inline_keyboard.flat().map((b) => ('callback_data' in b ? b.callback_data : undefined));

    expect(data()).toEqual(['rem:expense', 'rem:income', 'rem:off']);
    expect(data(false)).toEqual(['rem:expense', 'rem:income']);
  });
});

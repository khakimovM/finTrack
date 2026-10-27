import { adminPanelUrl, dayLabel, mainMenu, miniAppUrl, money, openAdminKeyboard, openAppKeyboard, periodLabel } from '../bot-ui';
import { BOT_TEXTS, menuLabels } from '../i18n';

describe('Mini App entry points in the bot', () => {
  it('opens the app only over HTTPS, always on /app', () => {
    expect(miniAppUrl('https://fintrack.uz')).toBe('https://fintrack.uz/app');
    expect(miniAppUrl('https://fintrack.uz/')).toBe('https://fintrack.uz/app');
    expect(miniAppUrl('http://localhost:5173')).toBeUndefined();
    expect(miniAppUrl(undefined)).toBeUndefined();
  });

  it('opens the admin panel the same way, on /admin, from an inline (signed) button', () => {
    expect(adminPanelUrl('https://myfintrack.uz/')).toBe('https://myfintrack.uz/admin');
    expect(adminPanelUrl('http://localhost:5173')).toBeUndefined();
    expect(openAdminKeyboard('https://myfintrack.uz/admin').inline_keyboard.flat()).toEqual([
      expect.objectContaining({ web_app: { url: 'https://myfintrack.uz/admin' } }),
    ]);
  });

  it('never puts a web_app button on the reply keyboard (Telegram would not sign that launch)', () => {
    const keyboard = mainMenu('uz', 'https://fintrack.uz').keyboard.flat();
    expect(keyboard.some((button) => typeof button === 'object' && 'web_app' in button)).toBe(false);
    expect(keyboard.some((button) => typeof button === 'object' && button.text === BOT_TEXTS.uz.menu.app)).toBe(true);
  });

  it('hides the app button when there is no HTTPS address', () => {
    const keyboard = mainMenu('uz', 'http://localhost:5173').keyboard.flat();
    expect(keyboard.some((button) => typeof button === 'object' && button.text === BOT_TEXTS.uz.menu.app)).toBe(false);
  });

  it('opens the app from an inline button, which Telegram signs', () => {
    expect(openAppKeyboard('uz', 'https://fintrack.uz/app').inline_keyboard[0][0]).toMatchObject({
      web_app: { url: 'https://fintrack.uz/app' },
    });
  });
});

describe('the main menu keyboard', () => {
  it('can be put away and brought back from the chat, and stays up until the person does that', () => {
    const menu = mainMenu('uz', 'https://fintrack.uz');
    expect(menu.is_persistent ?? false).toBe(false);
    expect(menu.one_time_keyboard ?? false).toBe(false);
    expect(menu.resize_keyboard).toBe(true);
  });

  it('tells how to put it away', () => {
    expect(BOT_TEXTS.uz.common.menuIntro).toContain('yashirish');
    expect(BOT_TEXTS.ru.common.menuIntro).toContain('скрыть');
  });

  it('is written in the account language, and a button in either language is heard', () => {
    const russian = mainMenu('ru', 'https://fintrack.uz').keyboard.flat();
    const labels = russian.map((button) => (typeof button === 'string' ? button : button.text));
    expect(labels).toEqual(expect.arrayContaining(['➖ Расход', '➕ Доход', '⚙️ Настройки', '🌐 Приложение']));
    expect(menuLabels('settings')).toEqual([BOT_TEXTS.uz.menu.settings, '⚙️ Настройки']);
  });

  it('has a different label for every button, in each language', () => {
    for (const texts of Object.values(BOT_TEXTS)) {
      const labels = Object.values(texts.menu);
      expect(new Set(labels).size).toBe(labels.length);
    }
  });
});

describe('report dates', () => {
  it('reads as the app writes them, never as raw ISO dates', () => {
    expect(periodLabel('2026-10-01', '2026-10-22', 'uz')).toBe('1–22-oktabr');
    expect(periodLabel('2026-09-28', '2026-10-04', 'uz')).toBe('28-sentabr – 4-oktabr');
    expect(periodLabel('2026-12-28', '2027-01-03', 'uz')).toBe('28-dekabr, 2026 – 3-yanvar, 2027');
    expect(periodLabel('2026-10-22', '2026-10-22', 'uz')).toBe('22-oktabr');
  });

  it('reads in Russian with the month in the genitive', () => {
    expect(periodLabel('2026-10-01', '2026-10-22', 'ru')).toBe('1–22 октября');
    expect(periodLabel('2026-09-28', '2026-10-04', 'ru')).toBe('28 сентября – 4 октября');
    expect(periodLabel('2026-12-28', '2027-01-03', 'ru')).toBe('28 декабря 2026 – 3 января 2027');
    expect(periodLabel('2026-10-22', '2026-10-22', 'ru')).toBe('22 октября');
  });

  it('names today and yesterday in the account language', () => {
    expect(dayLabel('2026-10-27', '2026-10-27', 'uz')).toBe('27.10.2026 (bugun)');
    expect(dayLabel('2026-10-26', '2026-10-27', 'ru')).toBe('26.10.2026 (вчера)');
    expect(dayLabel('2026-10-20', '2026-10-27', 'ru')).toBe('20.10.2026');
  });
});

describe('money in the bot', () => {
  it('writes the currency word of the account language', () => {
    expect(money(4_500_000n, 'uz')).toContain('so‘m');
    expect(money(4_500_000n, 'ru')).toContain('сум');
  });
});

import { MENU, mainMenu, miniAppUrl, openAppKeyboard } from '../bot-ui';

describe('Mini App entry points in the bot', () => {
  it('opens the app only over HTTPS, always on /app', () => {
    expect(miniAppUrl('https://fintrack.uz')).toBe('https://fintrack.uz/app');
    expect(miniAppUrl('https://fintrack.uz/')).toBe('https://fintrack.uz/app');
    expect(miniAppUrl('http://localhost:5173')).toBeUndefined();
    expect(miniAppUrl(undefined)).toBeUndefined();
  });

  it('never puts a web_app button on the reply keyboard (Telegram would not sign that launch)', () => {
    const keyboard = mainMenu('https://fintrack.uz').keyboard.flat();
    expect(keyboard.some((button) => typeof button === 'object' && 'web_app' in button)).toBe(false);
    expect(keyboard.some((button) => typeof button === 'object' && button.text === MENU.app)).toBe(true);
  });

  it('hides the app button when there is no HTTPS address', () => {
    const keyboard = mainMenu('http://localhost:5173').keyboard.flat();
    expect(keyboard.some((button) => typeof button === 'object' && button.text === MENU.app)).toBe(false);
  });

  it('opens the app from an inline button, which Telegram signs', () => {
    expect(openAppKeyboard('https://fintrack.uz/app').inline_keyboard[0][0]).toMatchObject({
      web_app: { url: 'https://fintrack.uz/app' },
    });
  });
});

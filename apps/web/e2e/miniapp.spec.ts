import { expect, Page, test } from '@playwright/test';
import { signUpThroughTelegram } from './support/login';
import { newTelegramUser, signedInitData, TELEGRAM_SCRIPT_STUB, TelegramUser } from './support/telegram';

const DARK = { bg_color: '#17212b', text_color: '#f5f5f5' };

/** Opens the app the way Telegram does: launch data in the fragment, Telegram's script loaded. */
async function launchMiniApp(page: Page, user: TelegramUser, path = '/app') {
  await page.route('https://telegram.org/js/**', (route) =>
    route.fulfill({ contentType: 'application/javascript', body: TELEGRAM_SCRIPT_STUB }),
  );
  const hash = new URLSearchParams({
    tgWebAppData: signedInitData(user),
    tgWebAppVersion: '8.0',
    tgWebAppPlatform: 'android',
    tgWebAppThemeParams: JSON.stringify(DARK),
  });
  await page.goto(`${path}#${hash.toString()}`);
}

test('someone who never registered in the bot is told to do that first', async ({ page }) => {
  await launchMiniApp(page, newTelegramUser('Stranger'));

  await expect(page.getByRole('heading', { name: 'Avval botda ro‘yxatdan o‘ting' })).toBeVisible();
});

test('a registered user is signed in by Telegram, in Telegram’s theme, without a sign-out button', async ({
  browser,
}) => {
  const signUp = await browser.newPage();
  const user = await signUpThroughTelegram(signUp, 'MiniApp');
  await signUp.close();

  // A fresh context: no cookies, exactly like Telegram's webview.
  const context = await browser.newContext();
  const page = await context.newPage();
  await launchMiniApp(page, user);

  await expect(page.getByRole('heading', { name: /Xush kelibsiz, MiniApp/ }).first()).toBeVisible();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(page.getByRole('button', { name: 'Chiqish' })).toHaveCount(0);

  // Telegram's Back button follows the router and never leaves the app.
  await page.getByRole('link', { name: 'Qarzlar' }).click();
  await expect(page).toHaveURL(/\/app\/debts$/);
  expect(await page.evaluate(() => window.Telegram?.WebApp?.BackButton?.isVisible)).toBe(true);
  await page.evaluate(() => (window.Telegram?.WebApp as unknown as { __pressBack(): void }).__pressBack());
  // Back to the launch URL, which still carries Telegram's parameters in the fragment.
  await expect(page).toHaveURL(/\/app(#.*)?$/);
  await context.close();
});

import { expect, Page } from '@playwright/test';
import { deliver, newTelegramUser, sharedContact, startCommand, TelegramUser, waitForCode } from './telegram';

/**
 * Signs a brand-new user up the way a person does: "Telegram orqali kirish" on the site, /start
 * in the bot, share the contact, type the code the bot sent.
 */
export async function signUpThroughTelegram(page: Page, firstName = 'Playwright'): Promise<TelegramUser> {
  const user = newTelegramUser(firstName);
  // The real page opens t.me in a new tab; the test plays the Telegram side itself.
  await page.addInitScript(() => {
    window.open = () => null;
  });

  await page.goto('/login');
  await page.getByRole('button', { name: 'Telegram orqali kirish' }).click();
  const deepLink = await page.getByRole('link', { name: /Telegram’ni ochish/ }).getAttribute('href');
  const payload = deepLink?.split('start=')[1];
  if (!payload) throw new Error(`unexpected deep link: ${deepLink}`);

  await deliver(startCommand(user, payload));
  await deliver(sharedContact(user));
  const code = await waitForCode(user);

  await page.getByLabel('6 xonali kod').pressSequentially(code);
  await expect(page).toHaveURL(/\/app$/);
  return user;
}

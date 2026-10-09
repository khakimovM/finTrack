import { expect, test, type Page } from '@playwright/test';
import { E2E } from './support/env';
import {
  deliver,
  messageCount,
  messagesSince,
  newTelegramUser,
  sharedContact,
  startCommand,
  waitForCode,
  type TelegramUser,
} from './support/telegram';

/** The id the stack puts in ADMIN_TELEGRAM_IDS (start-stack.ts). */
const OWNER: TelegramUser = { id: E2E.adminTelegramId, first_name: 'Ega', username: 'fintrack_owner' };

/** The owner is an ordinary bot user first (a no-op when an earlier run did it), then signs in at /admin/login. */
async function signInAsOwner(page: Page): Promise<void> {
  await deliver(startCommand(OWNER, ''));
  await deliver(sharedContact(OWNER));
  await page.addInitScript(() => {
    window.open = () => null;
  });

  await page.goto('/admin/login');
  const before = await messageCount(OWNER);
  await page.getByRole('button', { name: 'Telegram orqali admin sifatida kirish' }).click();
  const deepLink = await page.getByRole('link', { name: /Telegram’ni ochish/ }).getAttribute('href');
  expect(deepLink).toContain('start=admin_');
  await deliver(startCommand(OWNER, deepLink?.split('start=')[1] ?? ''));
  await page.getByLabel('6 xonali kod').pressSequentially(await waitForCode(OWNER, 10_000, before));
  await expect(page).toHaveURL(/\/admin$/);
}

/** Someone who signed up in the bot, for the owner to find. */
async function registerInBot(firstName: string): Promise<TelegramUser> {
  const user = newTelegramUser(firstName);
  await deliver(startCommand(user, ''));
  await deliver(sharedContact(user));
  return user;
}

test('a visitor without an admin session sees an ordinary 404 at /admin', async ({ page }) => {
  await page.goto('/admin/users');
  await expect(page.getByRole('heading', { name: 'Sahifa topilmadi' })).toBeVisible();
});

test('the owner signs in, finds a person, bans and unbans them, and checks the system and the audit log', async ({ page }) => {
  // The test database outlives runs: a unique reason finds this run's audit row.
  const stamp = Date.now() % 100_000;
  const reason = `Playwright tekshiruvi ${stamp}`;
  const person = await registerInBot(`Bloklanuvchi ${stamp}`);
  await signInAsOwner(page);
  await expect(page.getByRole('heading', { name: 'Umumiy ko‘rinish' })).toBeVisible();
  await expect(page.getByText('Bugun faol')).toBeVisible();
  await expect(page.getByRole('banner').getByText('Ega', { exact: true })).toBeVisible();

  // Find the person and open their card.
  await page.getByRole('link', { name: 'Foydalanuvchilar' }).click();
  await page.getByLabel('Foydalanuvchini qidirish').fill(String(person.id));
  const row = page.getByRole('row', { name: new RegExp(person.first_name) });
  await row.click();
  const card = page.getByRole('dialog', { name: 'Foydalanuvchi' });
  await expect(card.getByText('O‘z kategoriyalari')).toBeVisible();

  // Ban with a reason: the person hears it in the bot.
  const before = await messageCount(person);
  await card.getByRole('button', { name: 'Bloklash' }).click();
  const form = page.getByRole('dialog', { name: 'Foydalanuvchini bloklash' });
  await form.getByLabel('Sabab').fill(reason);
  await form.getByRole('button', { name: 'Bloklash' }).click();
  await expect(page.getByText(`Sabab: ${reason}`)).toBeVisible();
  await expect.poll(async () => (await messagesSince(person, before)).join('\n')).toContain(reason);

  // Unban after a confirmation.
  await page.getByRole('button', { name: 'Blokdan chiqarish' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Blokdan chiqarish' }).click();
  await expect(page.getByRole('button', { name: 'Bloklash' })).toBeVisible();
  await page.keyboard.press('Escape');

  await page.getByRole('link', { name: 'Tizim' }).click();
  await expect(page.getByRole('heading', { name: 'Ma’lumotlar bazasi' })).toBeVisible();
  await expect(page.getByText('Ishlayapti').first()).toBeVisible();

  await page.getByRole('link', { name: 'Audit' }).click();
  await expect(page.getByText(`Sabab: ${reason} · 0 sessiya tugatildi`)).toBeVisible();

  // On a phone the people list is cards, and nothing scrolls sideways. (Same session: the bot
  // sends one person at most five codes in 15 minutes, so the owner signs in once per run.)
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/admin/users?q=${person.id}`);
  await expect(page.getByRole('button', { name: new RegExp(person.first_name) })).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await page.setViewportSize({ width: 1280, height: 800 });

  // The admin session opens nothing in the user app.
  await page.goto('/app');
  await expect(page).toHaveURL(/\/login$/);

  // Signing out: back to sign-in, and /admin is a plain 404 again.
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Chiqish' }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Sahifa topilmadi' })).toBeVisible();
});

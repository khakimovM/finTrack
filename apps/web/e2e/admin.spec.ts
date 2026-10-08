import { expect, test } from '@playwright/test';
import { E2E } from './support/env';
import { deliver, messageCount, sharedContact, startCommand, waitForCode, type TelegramUser } from './support/telegram';

/** The id the stack puts in ADMIN_TELEGRAM_IDS (start-stack.ts). */
const OWNER: TelegramUser = { id: E2E.adminTelegramId, first_name: 'Ega', username: 'fintrack_owner' };

test('the owner signs into the admin panel with the bot’s admin code, apart from the user app', async ({ page }) => {
  // The owner is an ordinary registered user of the bot first (a no-op when an earlier run did it).
  await deliver(startCommand(OWNER, ''));
  await deliver(sharedContact(OWNER));
  await page.addInitScript(() => {
    window.open = () => null;
  });

  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login$/);

  const before = await messageCount(OWNER);
  await page.getByRole('button', { name: 'Telegram orqali admin sifatida kirish' }).click();
  const deepLink = await page.getByRole('link', { name: /Telegram’ni ochish/ }).getAttribute('href');
  expect(deepLink).toContain('start=admin_');
  await deliver(startCommand(OWNER, deepLink?.split('start=')[1] ?? ''));
  await page.getByLabel('6 xonali kod').pressSequentially(await waitForCode(OWNER, 10_000, before));

  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { name: 'Admin panel' })).toBeVisible();
  await expect(page.getByText('Ega', { exact: true })).toBeVisible();

  // The admin session opens nothing in the user app.
  await page.goto('/app');
  await expect(page).toHaveURL(/\/login$/);

  await page.goto('/admin');
  await page.getByRole('button', { name: 'Chiqish' }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login$/);
});

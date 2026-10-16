import { expect, test, type Page } from '@playwright/test';
import { E2E } from './support/env';
import {
  deliver,
  messageCount,
  messagesSince,
  newTelegramUser,
  sharedContact,
  signedInitData,
  startCommand,
  TELEGRAM_SCRIPT_STUB,
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

/**
 * Opens /admin the way the bot's /admin button does: as a Mini App, with signed launch data in
 * the fragment and Telegram's script loaded. Returns the launch URL, to open the same launch again.
 */
async function openFromBot(page: Page, user: TelegramUser): Promise<string> {
  await page.route('https://telegram.org/js/**', (route) =>
    route.fulfill({ contentType: 'application/javascript', body: TELEGRAM_SCRIPT_STUB }),
  );
  const hash = new URLSearchParams({ tgWebAppData: signedInitData(user), tgWebAppVersion: '8.0', tgWebAppPlatform: 'ios' });
  const url = `/admin#${hash.toString()}`;
  await page.goto(url);
  return url;
}

test('inside Telegram the bot’s /admin button opens the panel signed in, once per launch', async ({ browser }) => {
  await deliver(startCommand(OWNER, ''));
  await deliver(sharedContact(OWNER));
  // A fresh context, no cookies: exactly like Telegram's webview.
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  const launch = await openFromBot(page, OWNER);
  await expect(page.getByRole('heading', { name: 'Umumiy ko‘rinish' })).toBeVisible();
  await expect(page.getByText('Bugun faol')).toBeVisible();
  await page.getByRole('link', { name: 'Foydalanuvchilar' }).click();
  await expect(page.getByLabel('Foydalanuvchini qidirish')).toBeVisible();
  // The session travels in a header, not in a cookie.
  expect((await context.cookies()).map((c) => c.name)).not.toContain('ft_admin');

  // The same launch again (a reload): the panel asks to reopen it from the bot.
  await page.goto(launch);
  await expect(page.getByRole('heading', { name: 'Admin panelni qayta oching' })).toBeVisible();
  await context.close();
});

test('inside Telegram anyone else gets the ordinary 404 page at /admin', async ({ browser }) => {
  const stranger = await registerInBot('Qiziquvchan');
  const context = await browser.newContext();
  const page = await context.newPage();
  await openFromBot(page, stranger);
  await expect(page.getByRole('heading', { name: 'Sahifa topilmadi' })).toBeVisible();
  await context.close();
});

test('a visitor without an admin session sees an ordinary 404 at /admin', async ({ page }) => {
  await page.goto('/admin/users');
  await expect(page.getByRole('heading', { name: 'Sahifa topilmadi' })).toBeVisible();
});

test('the owner signs in, bans and unbans a person, broadcasts a message, and checks the system and the audit log', async ({ page }) => {
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

  // A broadcast: tested on the owner first, then sent to everyone once.
  const announcement = `Playwright e’loni ${stamp}`;
  const ownerBefore = await messageCount(OWNER);
  const personBefore = await messageCount(person);
  await page.getByRole('link', { name: 'Xabarlar' }).click();
  await page.getByLabel('Xabar matni').fill(announcement);
  await expect(page.getByRole('button', { name: 'Yuborish', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Menga test yuborish' }).click();
  await expect.poll(async () => (await messagesSince(OWNER, ownerBefore)).filter((m) => m === announcement).length).toBe(1);
  await page.getByRole('button', { name: 'Yuborish', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toContainText('kishiga yuborilsinmi?');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Yuborish', exact: true }).click();
  const item = page.getByRole('listitem').filter({ hasText: announcement });
  await expect(item.getByText('Tugadi')).toBeVisible({ timeout: 30_000 });
  expect((await messagesSince(person, personBefore)).filter((m) => m === announcement)).toHaveLength(1);
  expect((await messagesSince(OWNER, ownerBefore)).filter((m) => m === announcement)).toHaveLength(2);

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

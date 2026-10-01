import { expect, test } from '@playwright/test';
import { signUpThroughTelegram } from './support/login';

test('on a phone: the menu is a drawer, forms are bottom sheets, lists are cards', async ({ page }) => {
  await signUpThroughTelegram(page, 'Telefon');

  // Sidebar hidden behind the menu button.
  await page.getByRole('button', { name: 'Menyuni ochish' }).click();
  await page.getByRole('link', { name: 'Tranzaksiyalar' }).click();
  await expect(page).toHaveURL(/\/app\/transactions$/);

  // The form opens as a sheet anchored to the bottom of the screen.
  await page.getByRole('button', { name: 'Yangi tranzaksiya', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const box = await dialog.boundingBox();
  const viewport = page.viewportSize();
  expect(box && viewport && Math.round(box.y + box.height)).toBe(viewport?.height);

  await page.getByLabel('Summa').fill('45000');
  await page.getByLabel('Izoh (ixtiyoriy)').fill('Tushlik');
  await page.getByRole('button', { name: 'Saqlash' }).click();

  // No table on a phone: the entry shows up as a card, and nothing scrolls sideways.
  await expect(page.getByRole('table')).toBeHidden();
  await expect(page.getByText('Tushlik').last()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

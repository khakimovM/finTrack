import { expect, test } from '@playwright/test';
import { signUpThroughTelegram } from './support/login';

test('on a phone: a bottom tab bar, "+" opens forms as bottom sheets, lists are cards', async ({ page }) => {
  await signUpThroughTelegram(page, 'Telefon');
  const tabs = page.getByRole('navigation', { name: 'Asosiy menyu' });

  await tabs.getByRole('link', { name: 'Tranzaksiyalar' }).click();
  await expect(page).toHaveURL(/\/app\/transactions$/);

  // The centre "+" offers the four entry types; "Chiqim" opens the form anchored to the bottom.
  await tabs.getByRole('button', { name: 'Qo‘shish' }).click();
  await page.getByRole('button', { name: /^Chiqim/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Yangi tranzaksiya' });
  await expect(dialog).toBeVisible();
  // Measured once the slide-up animation has finished.
  const viewport = page.viewportSize();
  await expect
    .poll(async () => {
      const box = await dialog.boundingBox();
      return box ? Math.round(box.y + box.height) : null;
    })
    .toBe(viewport?.height);

  await page.getByLabel('Summa').fill('45000');
  await page.getByLabel('Izoh (ixtiyoriy)').fill('Tushlik');
  await page.getByRole('button', { name: 'Saqlash' }).click();

  // No table on a phone: the entry shows up as a card, and nothing scrolls sideways.
  await expect(page.getByRole('table')).toBeHidden();
  await expect(page.getByText('Tushlik').last()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  // "Ko‘proq" reaches the sections the tab bar has no room for.
  await tabs.getByRole('button', { name: 'Ko‘proq' }).click();
  await page.getByRole('button', { name: 'Hisoblar' }).click();
  await expect(page).toHaveURL(/\/app\/accounts$/);
});

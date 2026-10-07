import { expect, test, type Page } from '@playwright/test';
import { signUpThroughTelegram } from './support/login';

// The other specs run with reduced motion (playwright.config.ts); this one checks the motion itself.
test.use({ reducedMotion: 'no-preference' });

const NEW_TX = 'Yangi tranzaksiya';

/** Name of the CSS animation the open dialog's panel is set to, or null when there is none. */
const panelAnimation = (page: Page) =>
  page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>('[role="dialog"]');
    return panel ? getComputedStyle(panel).animationName : null;
  });

/** Escape, then a look 30ms later: well inside the 240ms exit, and the same in every run. */
const closeAndPeek = (page: Page) =>
  page.evaluate(async () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 30));
    const panel = document.querySelector<HTMLElement>('[role="dialog"]');
    return panel ? getComputedStyle(panel).animationName : null;
  });

test('dialogs animate in, animate out, and close at once with reduced motion', async ({ page }) => {
  await signUpThroughTelegram(page, 'Harakat');
  await page.goto('/app/transactions');
  const form = page.getByRole('dialog', { name: NEW_TX });

  await page.getByRole('button', { name: NEW_TX, exact: true }).click();
  await expect(form).toBeVisible();
  expect(await panelAnimation(page)).toBe('ft-dialog-in');

  expect(await closeAndPeek(page)).toBe('ft-dialog-out');
  await expect(page.locator('[role="dialog"]')).toHaveCount(0);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: NEW_TX, exact: true }).click();
  await expect(form).toBeVisible();
  // Slides and zooms collapse to a fade: the distance token is zero.
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--motion-distance').trim())).toBe('0');
  expect(await closeAndPeek(page)).toBeNull();
});

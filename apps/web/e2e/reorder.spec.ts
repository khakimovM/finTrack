import { expect, test, type Locator, type Page } from '@playwright/test';
import { signUpThroughTelegram } from './support/login';

/** Drags `handle` onto the middle of `target` the way a mouse does: press, move in steps, release. */
async function drag(page: Page, handle: Locator, target: Locator) {
  const from = await handle.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error('nothing to drag');
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
  await page.mouse.up();
}

const topLevelNames = (page: Page) =>
  page.locator('[data-sort-id]').evaluateAll((rows) =>
    rows
      .filter((row) => row.className.includes('min-h-16'))
      .map((row) => row.querySelector('.font-semibold')?.textContent ?? ''),
  );

test('categories are reordered by dragging and the order survives a reload', async ({ page }) => {
  await signUpThroughTelegram(page, 'Tartib');
  await page.goto('/app/categories');
  const rows = page.locator('[data-sort-id]');
  await expect(rows.first()).toBeVisible();

  const before = await topLevelNames(page);
  const last = rows.filter({ hasText: before[before.length - 1] });
  await drag(page, last.getByLabel('Sudrash'), rows.first());
  await expect(page.getByText('Tartib saqlandi')).toBeVisible();

  const expected = [before[before.length - 1], ...before.slice(0, -1)];
  await expect.poll(() => topLevelNames(page)).toEqual(expected);
  await page.reload();
  await expect.poll(() => topLevelNames(page)).toEqual(expected);
});

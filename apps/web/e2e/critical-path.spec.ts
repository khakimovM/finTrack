import { expect, test } from '@playwright/test';
import { signUpThroughTelegram } from './support/login';

test('critical path: Telegram sign-up → income and expense → dashboard → debt and payment → recurring → reports', async ({
  page,
}) => {
  await signUpThroughTelegram(page, 'Dilnoza');
  await expect(page.getByText(/Xush kelibsiz, Dilnoza/).first()).toBeVisible();

  // Income and expense through the transaction modal.
  await page.goto('/app/transactions');
  const table = page.getByRole('table');
  await page.getByRole('button', { name: 'Yangi tranzaksiya', exact: true }).click();
  await page.getByRole('button', { name: /Kirim \(Daromad\)/ }).click();
  await page.getByLabel('Summa').fill('10000000');
  await page.getByLabel('Izoh (ixtiyoriy)').fill('Oylik maosh');
  await page.getByRole('button', { name: 'Saqlash' }).click();
  await expect(table.getByText('Oylik maosh')).toBeVisible();

  await page.getByRole('button', { name: 'Yangi tranzaksiya', exact: true }).click();
  await page.getByLabel('Summa').fill('2000000');
  await page.getByLabel('Izoh (ixtiyoriy)').fill('Bozorlik');
  await page.getByRole('button', { name: 'Saqlash' }).click();
  await expect(table.getByText('Bozorlik')).toBeVisible();

  // The ledger, not a stored balance, drives the dashboard.
  await page.goto('/app');
  await expect(page.getByText('8 000 000 so‘m').first()).toBeVisible();

  // Lend money, receive part of it back.
  await page.goto('/app/debts');
  await page.getByRole('button', { name: 'Yangi qarz', exact: true }).click();
  await page.getByLabel('Shaxs ismi').fill('Ali Valiyev');
  await page.getByLabel('Summa').fill('1500000');
  await page.getByRole('button', { name: 'Saqlash' }).click();
  await expect(page.getByText('Ali Valiyev').first()).toBeVisible();

  await page.getByRole('button', { name: /To‘lov kiritish/ }).first().click();
  await page.getByLabel('To‘lov summasi').fill('500000');
  await page.getByRole('button', { name: 'To‘lovni qabul qilish' }).click();
  await expect(page.getByText('1 000 000 so‘m').first()).toBeVisible();

  // A loan row cannot be deleted from the list; it leads to its debt instead.
  await page.goto('/app/transactions');
  await table.getByRole('link', { name: 'Qarzga o‘tish' }).first().click();
  await expect(page).toHaveURL(/\/app\/debts\?debt=/);
  await expect(page.getByText('Ali Valiyev').first()).toBeVisible();

  // A monthly rule books today's occurrence right away when today is its day.
  await page.goto('/app/recurring');
  await page.getByRole('button', { name: 'Yangi qoida' }).click();
  await page.getByLabel('Summa').fill('300000');
  await page.getByLabel('Izoh (ixtiyoriy)').fill('Internet');
  await page.getByRole('button', { name: 'Saqlash' }).click();
  await expect(page.getByText('Internet')).toBeVisible();
  await expect(page.getByText(/Har oy, \d+-kuni/)).toBeVisible();

  // Reports compare this month with the same days of the previous one.
  await page.goto('/app/reports');
  await expect(page.getByRole('heading', { name: 'Hisobotlar' })).toBeVisible();
  await expect(page.getByText('Xarajatlar kategoriyalar bo‘yicha')).toBeVisible();
});

test('signing out ends the session and protects the app again', async ({ page }) => {
  await signUpThroughTelegram(page, 'Aziz');

  // Signing out lands on the public front page, which offers the way back in.
  await page.getByRole('button', { name: 'Chiqish' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('link', { name: 'Kirish', exact: true }).first()).toBeVisible();

  await page.goto('/app/transactions');
  await expect(page).toHaveURL(/\/login$/);
});

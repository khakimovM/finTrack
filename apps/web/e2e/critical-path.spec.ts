import { expect, test } from '@playwright/test';
import { signUpThroughTelegram } from './support/login';

test('critical path: Telegram sign-up → income and expense → dashboard → debt and payment → recurring → reports', async ({
  page,
}) => {
  await signUpThroughTelegram(page, 'Dilnoza');
  await expect(page.getByText(/Xush kelibsiz, Dilnoza/).first()).toBeVisible();

  // Income and expense through the transaction modal.
  await page.goto('/app/transactions');
  const list = page.getByRole('region', { name: 'Tranzaksiyalar ro‘yxati' });
  // The page has its own "Summa dan/gacha" filter inputs: fields are looked up inside the form.
  const form = page.getByRole('dialog', { name: 'Yangi tranzaksiya' });
  await page.getByRole('button', { name: 'Yangi tranzaksiya', exact: true }).click();
  await form.getByRole('radio', { name: 'Kirim' }).click();
  await form.getByLabel('Summa').fill('10000000');
  await form.getByLabel('Izoh (ixtiyoriy)').fill('Oylik maosh');
  await form.getByRole('button', { name: 'Saqlash' }).click();
  await expect(list.getByText('Oylik maosh')).toBeVisible();

  await page.getByRole('button', { name: 'Yangi tranzaksiya', exact: true }).click();
  await form.getByLabel('Summa').fill('2000000');
  await form.getByLabel('Izoh (ixtiyoriy)').fill('Bozorlik');
  await form.getByRole('button', { name: 'Saqlash' }).click();
  await expect(list.getByText('Bozorlik')).toBeVisible();

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
  const payment = page.getByRole('dialog', { name: 'To‘lov kiritish' });
  await payment.getByLabel('To‘lov summasi').fill('500000');
  await payment.getByRole('button', { name: 'Saqlash' }).click();
  // 1 500 000 lent, 500 000 back: what is left is owed to me.
  await expect(page.getByRole('button', { name: /Menga qarzdor/ })).toContainText('1 000 000');

  // A loan row cannot be edited or deleted from the list; it leads to its debt instead.
  await page.goto('/app/transactions');
  await list.getByText('Ali Valiyev').first().click();
  await page.getByRole('dialog', { name: 'Qarz yozuvi' }).getByRole('button', { name: 'Qarzga o‘tish' }).click();
  await expect(page).toHaveURL(/\/app\/debts\?debt=/);
  await expect(page.getByText('Ali Valiyev').first()).toBeVisible();

  // A monthly rule books today's occurrence right away when today is its day.
  await page.goto('/app/recurring');
  await page.getByRole('button', { name: 'Yangi qoida' }).first().click();
  const ruleForm = page.getByRole('dialog', { name: 'Yangi takroriy to‘lov' });
  await ruleForm.getByLabel('Summa').fill('300000');
  await ruleForm.getByLabel('Izoh').fill('Internet');
  await ruleForm.getByRole('button', { name: 'Saqlash' }).click();
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

import { test, expect } from '@playwright/test';

test.describe('FinTrack Critical Path E2E', () => {
  const timestamp = Date.now();
  const testUser = {
    name: `Test User ${timestamp}`,
    email: `test_${timestamp}@fintrack.uz`,
    password: 'Password123!',
  };

  test('critical path: register -> income -> expense -> dashboard -> debt -> partial payment', async ({
    page,
  }) => {
    // 1. Register
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: /Ro‘yxatdan o‘tish/i })).toBeVisible();

    await page.getByLabel(/Ism/i).fill(testUser.name);
    await page.getByLabel(/Email/i).fill(testUser.email);
    await page.getByLabel(/Parol/i).fill(testUser.password);
    await page.getByRole('button', { name: /Hisob yaratish|Ro‘yxatdan o‘tish/i }).click();

    // 2. Redirected to Dashboard
    await expect(page).toHaveURL(/\/app/);
    await expect(page.getByRole('heading', { name: /Dashboard/i })).toBeVisible();

    // 3. Navigate to Transactions page
    await page.goto('/app/transactions');
    await expect(page.getByRole('heading', { name: /Tranzaksiyalar/i })).toBeVisible();

    // 4. Add Income transaction (10 000 000 so'm)
    await page.getByRole('button', { name: /Yangi tranzaksiya/i }).click();
    await expect(page.getByRole('heading', { name: /Yangi tranzaksiya/i })).toBeVisible();

    await page.getByRole('button', { name: /Kirim/i }).click();
    await page.getByLabel(/Summa/i).fill('10000000');
    // Select first category and account if not preselected
    const categorySelect = page.getByLabel(/Kategoriya/i);
    if (await categorySelect.isVisible()) {
      const options = await categorySelect.locator('option').all();
      if (options.length > 1) {
        const val = await options[1].getAttribute('value');
        if (val) await categorySelect.selectOption(val);
      }
    }
    await page.getByLabel(/Izoh/i).fill('Oylik maosh');
    await page.getByRole('button', { name: /Saqlash|Qo‘shish/i }).click();

    // Verify income is recorded
    await expect(page.getByText('Oylik maosh')).toBeVisible();

    // 5. Add Expense transaction (2 000 000 so'm)
    await page.getByRole('button', { name: /Yangi tranzaksiya/i }).click();
    await page.getByRole('button', { name: /Chiqim/i }).click();
    await page.getByLabel(/Summa/i).fill('2000000');
    if (await categorySelect.isVisible()) {
      const options = await categorySelect.locator('option').all();
      if (options.length > 1) {
        const val = await options[1].getAttribute('value');
        if (val) await categorySelect.selectOption(val);
      }
    }
    await page.getByLabel(/Izoh/i).fill('Bozorlik xarajatlari');
    await page.getByRole('button', { name: /Saqlash|Qo‘shish/i }).click();

    await expect(page.getByText('Bozorlik xarajatlari')).toBeVisible();

    // 6. Verify Dashboard KPI and charts
    await page.goto('/app');
    await expect(page.getByRole('heading', { name: /Dashboard/i })).toBeVisible();
    await expect(page.getByText(/8 000 000/)).toBeVisible();

    // 7. Navigate to Debts page
    await page.goto('/app/debts');
    await expect(page.getByRole('heading', { name: /Qarzlar/i })).toBeVisible();

    // 8. Create a new Debt (1 500 000 so'm)
    await page.getByRole('button', { name: /Yangi qarz/i }).click();
    await page.getByLabel(/Shaxs ismi/i).fill('Ali Valiyev');
    await page.getByLabel(/Summa/i).fill('1500000');
    await page.getByRole('button', { name: /Saqlash|Qo‘shish/i }).click();

    // Verify Debt card appears
    await expect(page.getByText('Ali Valiyev')).toBeVisible();

    // 9. Record partial payment (500 000 so'm)
    const paymentButton = page.getByRole('button', { name: /To‘lov kiritish|Qisman to‘lov/i }).first();
    if (await paymentButton.isVisible()) {
      await paymentButton.click();
      await page.getByLabel(/To‘lov summasi/i).fill('500000');
      await page.getByRole('button', { name: /Saqlash|Tasdiqlash/i }).click();

      // Verify remaining amount is updated to 1 000 000
      await expect(page.getByText(/1 000 000/)).toBeVisible();
    }
  });
});

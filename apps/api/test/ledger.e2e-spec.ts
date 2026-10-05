import { createTestApp, TestApp } from './helpers/app';
import { ApiClient, categoryId, newUser, today } from './helpers/api-client';

describe('Ledger invariants (e2e, real Postgres)', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function account(client: ApiClient, name: string, openingBalance: string): Promise<string> {
    const res = await client.post('/accounts', { name, type: 'CARD', openingBalance });
    expect(res.status).toBe(201);
    return res.body.data.id as string;
  }

  async function balanceOf(client: ApiClient, accountId: string): Promise<string> {
    const res = await client.get(`/accounts/${accountId}`);
    return res.body.data.balance as string;
  }

  async function enableStrictMode(client: ApiClient): Promise<void> {
    await ctx.prisma.user.update({ where: { id: client.userId }, data: { strictMode: true } });
  }

  describe('strict mode', () => {
    it('rejects an overdraft with 422 INSUFFICIENT_BALANCE and saves nothing', async () => {
      const user = await newUser(ctx);
      await enableStrictMode(user);
      const acc = await account(user, 'Strict', '3000000');
      const food = await categoryId(user, 'Oziq-ovqat');

      const res = await user.post('/transactions', {
        type: 'EXPENSE',
        accountId: acc,
        amount: '4500000',
        categoryId: food,
        date: today(),
      });

      expect(res.status).toBe(422);
      expect(res.body.error).toMatchObject({
        code: 'INSUFFICIENT_BALANCE',
        details: { accountId: acc, currentBalance: '3000000', requested: '4500000' },
      });
      expect(await balanceOf(user, acc)).toBe('3000000');
    });

    it('serialises concurrent expenses so the balance never goes negative', async () => {
      const user = await newUser(ctx);
      await enableStrictMode(user);
      const acc = await account(user, 'Race', '100');
      const food = await categoryId(user, 'Oziq-ovqat');

      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          user.post('/transactions', {
            type: 'EXPENSE',
            accountId: acc,
            amount: '30',
            categoryId: food,
            date: today(),
          }),
        ),
      );

      const statuses = results.map((r) => r.status).sort();
      expect(statuses).toEqual([201, 201, 201, 422, 422]);
      expect(await balanceOf(user, acc)).toBe('10');
    });

    it('allows a negative balance when strict mode is off', async () => {
      const user = await newUser(ctx);
      const acc = await account(user, 'Loose', '100');
      const food = await categoryId(user, 'Oziq-ovqat');

      const res = await user.post('/transactions', {
        type: 'EXPENSE',
        accountId: acc,
        amount: '250',
        categoryId: food,
        date: today(),
      });

      expect(res.status).toBe(201);
      expect(await balanceOf(user, acc)).toBe('-150');
    });
  });

  describe('debts', () => {
    it('never accepts more than the remaining amount, even under concurrency', async () => {
      const user = await newUser(ctx);
      const acc = await account(user, 'Debt source', '0');
      const created = await user.post('/debts', {
        direction: 'I_LENT',
        personName: 'Jasur',
        accountId: acc,
        amount: '1000',
      });
      expect(created.status).toBe(201);
      const debtId = created.body.data.debt.id as string;

      const results = await Promise.all(
        Array.from({ length: 5 }, () => user.post(`/debts/${debtId}/payments`, { amount: '300', accountId: acc })),
      );

      expect(results.filter((r) => r.status === 201)).toHaveLength(3);
      for (const r of results.filter((x) => x.status !== 201)) {
        expect(r.status).toBe(422);
        expect(r.body.error.code).toBe('DEBT_OVERPAYMENT');
      }

      const debt = await user.get(`/debts/${debtId}`);
      expect(debt.body.data).toMatchObject({
        paidAmount: '900',
        remainingAmount: '100',
        status: 'PARTIALLY_PAID',
      });
      // −1000 lent, +900 repaid.
      expect(await balanceOf(user, acc)).toBe('-100');
    });

    it('names the account each payment went to', async () => {
      const user = await newUser(ctx);
      const cash = await account(user, 'Naqd', '0');
      const card = await account(user, 'Humo', '0');
      const created = await user.post('/debts', { direction: 'I_LENT', personName: 'Ali', accountId: cash, amount: '1000' });
      const debtId = created.body.data.debt.id as string;

      const paid = await user.post(`/debts/${debtId}/payments`, { amount: '400', accountId: card });
      expect(paid.status).toBe(201);
      expect(paid.body.data.payment.account).toMatchObject({ id: card, name: 'Humo' });
      await user.post(`/debts/${debtId}/settle`, { accountId: cash });

      const history = await user.get(`/debts/${debtId}/payments`);
      expect(history.status).toBe(200);
      expect(history.body.data.map((p: { amount: string; account: { name: string } }) => [p.amount, p.account.name]).sort()).toEqual([
        ['400', 'Humo'],
        ['600', 'Naqd'],
      ]);
    });

    it('deleting a payment reverses its ledger row and reopens the debt', async () => {
      const user = await newUser(ctx);
      const acc = await account(user, 'Borrow', '0');
      const created = await user.post('/debts', {
        direction: 'I_BORROWED',
        personName: 'Bank',
        accountId: acc,
        amount: '500',
      });
      const debtId = created.body.data.debt.id as string;

      const settled = await user.post(`/debts/${debtId}/settle`, { accountId: acc });
      expect(settled.status).toBe(201);
      expect(settled.body.data.debt.status).toBe('PAID');
      expect(await balanceOf(user, acc)).toBe('0');

      const paymentId = settled.body.data.payment.id as string;
      const undone = await user.delete(`/debts/${debtId}/payments/${paymentId}`);
      expect(undone.status).toBe(200);
      expect(undone.body.data).toMatchObject({ status: 'ACTIVE', remainingAmount: '500' });
      expect(await balanceOf(user, acc)).toBe('500');
    });

    it('loans never appear in category statistics', async () => {
      const user = await newUser(ctx);
      const acc = await account(user, 'Stats', '0');
      await user.post('/debts', { direction: 'I_LENT', personName: 'Ali', accountId: acc, amount: '777' });

      const month = today().slice(0, 7);
      const res = await user.get(`/stats/by-category?type=EXPENSE&from=${month}-01&to=${today()}`);
      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe('0');
    });
  });

  describe('managed rows', () => {
    it('refuses to edit or delete loan and transfer rows through /transactions', async () => {
      const user = await newUser(ctx);
      const a = await account(user, 'A', '1000');
      const b = await account(user, 'B', '0');
      await user.post('/debts', { direction: 'I_LENT', personName: 'Vali', accountId: a, amount: '100' });
      await user.post('/transfers', { fromAccountId: a, toAccountId: b, amount: '200', date: today() });

      const list = await user.get('/transactions?limit=100');
      const loanRow = list.body.data.find((t: { type: string }) => t.type === 'LOAN_GIVEN');
      const transferRow = list.body.data.find((t: { type: string }) => t.type === 'TRANSFER_IN');

      for (const res of [
        await user.delete(`/transactions/${loanRow.id}`),
        await user.patch(`/transactions/${transferRow.id}`, { amount: '1' }),
        await user.post('/transactions/bulk-delete', { ids: [loanRow.id, transferRow.id] }),
      ]) {
        expect(res.status).toBe(422);
        expect(res.body.error.code).toBe('MANAGED_TRANSACTION');
      }
    });

    it('a transfer keeps the total unchanged and deleting it removes both legs', async () => {
      const user = await newUser(ctx);
      const a = await account(user, 'Card', '1000');
      const b = await account(user, 'Cash', '0');
      const before = (await user.get('/accounts')).body.meta.totalBalance as string;

      const transfer = await user.post('/transfers', { fromAccountId: a, toAccountId: b, amount: '400', date: today() });
      expect(transfer.status).toBe(201);
      expect(transfer.body.data.balances).toMatchObject({ [a]: '600', [b]: '400', total: before });

      const removed = await user.delete(`/transfers/${transfer.body.data.transferGroupId}`);
      expect(removed.status).toBe(204);
      expect(await balanceOf(user, a)).toBe('1000');
      expect(await balanceOf(user, b)).toBe('0');
    });
  });

  describe('accounts', () => {
    it('refuses to delete an account with history but deletes an empty one', async () => {
      const user = await newUser(ctx);
      const used = await account(user, 'Used', '0');
      const empty = await account(user, 'Empty', '0');
      const food = await categoryId(user, 'Oziq-ovqat');
      await user.post('/transactions', { type: 'EXPENSE', accountId: used, amount: '1', categoryId: food, date: today() });

      const blocked = await user.delete(`/accounts/${used}`);
      expect(blocked.status).toBe(409);
      expect(blocked.body.error.code).toBe('ACCOUNT_HAS_HISTORY');

      expect((await user.delete(`/accounts/${empty}`)).status).toBe(204);
    });

    it('does not accept new rows on an archived account', async () => {
      const user = await newUser(ctx);
      const acc = await account(user, 'Old', '0');
      expect((await user.post(`/accounts/${acc}/archive`)).status).toBe(201);
      const food = await categoryId(user, 'Oziq-ovqat');

      const res = await user.post('/transactions', {
        type: 'EXPENSE',
        accountId: acc,
        amount: '1',
        categoryId: food,
        date: today(),
      });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('ACCOUNT_ARCHIVED');
    });
  });

  describe('budgets', () => {
    it('announces the 80% threshold exactly once under concurrent expenses', async () => {
      const user = await newUser(ctx);
      const acc = await account(user, 'Budget', '0');
      const food = await categoryId(user, 'Oziq-ovqat');
      expect(
        (await user.post('/budgets', { categoryId: food, month: today().slice(0, 7), limitAmount: '100' })).status,
      ).toBe(201);

      await Promise.all(
        Array.from({ length: 4 }, () =>
          user.post('/transactions', { type: 'EXPENSE', accountId: acc, amount: '21', categoryId: food, date: today() }),
        ),
      );

      const notifications = await user.get('/notifications');
      const warnings = notifications.body.data.filter((n: { type: string }) => n.type === 'BUDGET_WARNING');
      expect(warnings).toHaveLength(1);
    });
  });
});

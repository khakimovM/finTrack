import { createTestApp, TestApp } from './helpers/app';
import { ApiClient, categoryId, newUser, today } from './helpers/api-client';

interface Row {
  id: string;
  type: string;
  note: string | null;
  debt: { id: string; personName: string } | null;
  transferPeer: { accountId: string; name: string; icon: string } | null;
}

describe('Transaction list and edits (e2e, real Postgres)', () => {
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

  async function expense(client: ApiClient, accountId: string, categoryIdValue: string, amount: string, note: string) {
    const res = await client.post('/transactions', {
      type: 'EXPENSE',
      accountId,
      categoryId: categoryIdValue,
      amount,
      date: today(),
      note,
    });
    expect(res.status).toBe(201);
    return res.body.data.transaction.id as string;
  }

  it('names the other leg of a transfer and the person of a loan', async () => {
    const user = await newUser(ctx);
    const card = await account(user, 'Humo karta', '100000');
    const savings = await account(user, 'Jamg‘arma', '0');
    expect((await user.post('/transfers', { fromAccountId: card, toAccountId: savings, amount: '30000', date: today() })).status).toBe(201);
    expect(
      (await user.post('/debts', { direction: 'I_LENT', personName: 'Jasur Karimov', amount: '20000', accountId: card })).status,
    ).toBe(201);

    const rows = (await user.get('/transactions?limit=100')).body.data as Row[];
    const out = rows.find((r) => r.type === 'TRANSFER_OUT');
    const into = rows.find((r) => r.type === 'TRANSFER_IN');
    const loan = rows.find((r) => r.type === 'LOAN_GIVEN');

    expect(out?.transferPeer).toMatchObject({ accountId: savings, name: 'Jamg‘arma' });
    expect(into?.transferPeer).toMatchObject({ accountId: card, name: 'Humo karta' });
    expect(loan?.debt).toMatchObject({ personName: 'Jasur Karimov' });
    expect(loan?.transferPeer).toBeNull();
  });

  it('a parent category filter includes its subcategories, in the list, the totals and the export', async () => {
    const user = await newUser(ctx);
    const card = await account(user, 'Karta', '500000');
    const transport = await categoryId(user, 'Transport');
    const taxi = await user.post('/categories', { name: 'Taksi', type: 'EXPENSE', parentId: transport });
    expect(taxi.status).toBe(201);
    await expense(user, card, transport, '10000', 'Benzin');
    await expense(user, card, taxi.body.data.id as string, '3500', 'Taksi uyga');
    await expense(user, card, await categoryId(user, 'Oziq-ovqat'), '7000', 'Non');

    const res = await user.get(`/transactions?categoryId=${transport}`);
    expect(res.status).toBe(200);
    expect((res.body.data as Row[]).map((r) => r.note).sort()).toEqual(['Benzin', 'Taksi uyga']);
    expect(res.body.meta.sums).toEqual({ income: '0', expense: '13500', incomeCount: 0, expenseCount: 2 });

    const csv = await user.get(`/export/transactions.csv?categoryId=${transport}`);
    expect(csv.status).toBe(200);
    expect(csv.text).toContain('Taksi uyga');
    expect(csv.text).not.toContain('Non');
  });

  it('switches an expense to income with a category of the new type, and refuses one of the old type', async () => {
    const user = await newUser(ctx);
    const card = await account(user, 'Karta', '100000');
    const id = await expense(user, card, await categoryId(user, 'Oziq-ovqat'), '20000', 'Adashib chiqim');

    const refused = await user.patch(`/transactions/${id}`, { type: 'INCOME' });
    expect(refused.status).toBe(422);
    expect(refused.body.error.code).toBe('INVALID_CATEGORY_TYPE');

    const switched = await user.patch(`/transactions/${id}`, { type: 'INCOME', categoryId: await categoryId(user, 'Oylik') });
    expect(switched.status).toBe(200);
    expect(switched.body.data.type).toBe('INCOME');
    // 100 000 − 20 000 became 100 000 + 20 000.
    expect((await user.get(`/accounts/${card}`)).body.data.balance).toBe('120000');
  });
});

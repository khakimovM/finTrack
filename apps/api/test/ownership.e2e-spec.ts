import { createTestApp, TestApp } from './helpers/app';
import { categoryId, firstAccountId, newUser, today } from './helpers/api-client';

/** 60-security.md: another user's resource answers 404 (never 403), for every resource type. */
describe('Ownership isolation (e2e)', () => {
  let ctx: TestApp;
  const owned: Record<string, string> = {};
  let intruder: Awaited<ReturnType<typeof newUser>>;

  beforeAll(async () => {
    ctx = await createTestApp();
    const owner = await newUser(ctx);
    intruder = await newUser(ctx);

    const account = await firstAccountId(owner);
    const second = (await owner.post('/accounts', { name: 'Ikkinchi', type: 'CARD' })).body.data.id;
    const food = await categoryId(owner, 'Oziq-ovqat');

    owned.account = account;
    owned.category = food;
    owned.tag = (await owner.post('/tags', { name: 'oila' })).body.data.id;
    owned.transaction = (
      await owner.post('/transactions', { type: 'EXPENSE', accountId: account, amount: '100', categoryId: food, date: today() })
    ).body.data.transaction.id;
    owned.transfer = (
      await owner.post('/transfers', { fromAccountId: account, toAccountId: second, amount: '10', date: today() })
    ).body.data.transferGroupId;
    const debt = await owner.post('/debts', { direction: 'I_LENT', personName: 'Jasur', accountId: account, amount: '50' });
    owned.debt = debt.body.data.debt.id;
    owned.payment = (await owner.post(`/debts/${owned.debt}/payments`, { amount: '10', accountId: account })).body.data.payment.id;
    owned.budget = (await owner.post('/budgets', { categoryId: food, month: today().slice(0, 7), limitAmount: '1000' })).body.data.id;
    owned.recurring = (
      await owner.post('/recurring', {
        accountId: account,
        categoryId: food,
        type: 'EXPENSE',
        amount: '100',
        frequency: 'MONTHLY',
        startsAt: today(),
      })
    ).body.data.id;
  });

  afterAll(async () => {
    await ctx.close();
  });

  const cases: Array<[string, () => [method: 'get' | 'patch' | 'delete' | 'post', path: string, body?: Record<string, unknown>]]> = [
    ['GET account', () => ['get', `/accounts/${owned.account}`]],
    ['PATCH account', () => ['patch', `/accounts/${owned.account}`, { name: 'hack' }]],
    ['archive account', () => ['post', `/accounts/${owned.account}/archive`]],
    ['DELETE account', () => ['delete', `/accounts/${owned.account}`]],
    ['GET category', () => ['get', `/categories/${owned.category}`]],
    ['PATCH category', () => ['patch', `/categories/${owned.category}`, { name: 'hack' }]],
    ['DELETE category', () => ['delete', `/categories/${owned.category}`]],
    ['PATCH tag', () => ['patch', `/tags/${owned.tag}`, { name: 'hack' }]],
    ['DELETE tag', () => ['delete', `/tags/${owned.tag}`]],
    ['GET transaction', () => ['get', `/transactions/${owned.transaction}`]],
    ['PATCH transaction', () => ['patch', `/transactions/${owned.transaction}`, { note: 'hack' }]],
    ['DELETE transaction', () => ['delete', `/transactions/${owned.transaction}`]],
    ['restore transaction', () => ['post', `/transactions/${owned.transaction}/restore`]],
    ['DELETE transfer', () => ['delete', `/transfers/${owned.transfer}`]],
    ['GET debt', () => ['get', `/debts/${owned.debt}`]],
    ['PATCH debt', () => ['patch', `/debts/${owned.debt}`, { note: 'hack' }]],
    ['GET debt payments', () => ['get', `/debts/${owned.debt}/payments`]],
    ['POST debt payment', () => ['post', `/debts/${owned.debt}/payments`, { amount: '1', accountId: owned.account }]],
    ['DELETE debt payment', () => ['delete', `/debts/${owned.debt}/payments/${owned.payment}`]],
    ['DELETE debt', () => ['delete', `/debts/${owned.debt}`]],
    ['PATCH budget', () => ['patch', `/budgets/${owned.budget}`, { limitAmount: '1' }]],
    ['DELETE budget', () => ['delete', `/budgets/${owned.budget}`]],
    ['GET recurring', () => ['get', `/recurring/${owned.recurring}`]],
    ['PATCH recurring', () => ['patch', `/recurring/${owned.recurring}`, { note: 'hack' }]],
    ['run recurring', () => ['post', `/recurring/${owned.recurring}/run-now`]],
    ['DELETE recurring', () => ['delete', `/recurring/${owned.recurring}`]],
  ];

  it.each(cases)('%s → 404', async (_name, build) => {
    const [method, path, body] = build();
    const res = await intruder.send(method, path, body);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('the intruder cannot book money onto a foreign account', async () => {
    const food = await categoryId(intruder, 'Oziq-ovqat');
    const res = await intruder.post('/transactions', {
      type: 'EXPENSE',
      accountId: owned.account,
      amount: '1',
      categoryId: food,
      date: today(),
    });
    expect(res.status).toBe(404);
  });

  it('lists never leak foreign rows', async () => {
    const res = await intruder.get('/transactions?limit=100');
    expect(res.body.data.map((t: { id: string }) => t.id)).not.toContain(owned.transaction);
  });
});

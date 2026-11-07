import { ManualEntry, PlanContext, PlanInput, SavedPurchase, planImport } from '../cards/card-planner';

const CATEGORIES = [
  { id: 'cat-food', name: 'Oziq-ovqat', type: 'EXPENSE' as const },
  { id: 'cat-transport', name: 'Transport', type: 'EXPENSE' as const },
  { id: 'cat-health', name: 'Sog‘liq', type: 'EXPENSE' as const },
  { id: 'cat-fun', name: 'Ko‘ngilochar', type: 'EXPENSE' as const },
  { id: 'cat-fees', name: 'Bank xizmatlari', type: 'EXPENSE' as const },
  { id: 'cat-salary', name: 'Oylik', type: 'INCOME' as const },
];

let seq = 0;
function op(overrides: Partial<PlanInput> & Pick<PlanInput, 'direction' | 'amount' | 'merchant'>): PlanInput {
  seq += 1;
  return {
    id: `op-${seq}`,
    cardId: 'card-a',
    accountId: 'acc-a',
    occurredAt: new Date('2026-11-01T10:00:00+05:00'),
    date: '2026-11-01',
    reversal: false,
    ...overrides,
  };
}

function context(overrides: Partial<PlanContext> = {}): PlanContext {
  return { categories: CATEGORIES, memory: new Map(), feeCategoryId: null, manual: [], savedPurchases: [], ...overrides };
}

const minutesLater = (minutes: number) => new Date(new Date('2026-11-01T10:00:00+05:00').getTime() + minutes * 60_000);

describe('planImport: shops', () => {
  it('books a known chain or a shop whose name says what it is, and leaves the rest to the person', () => {
    const korzinka = op({ direction: 'DEBIT', amount: 1_845_000n, merchant: 'ANGLESEY FOOD' });
    const metro = op({ direction: 'DEBIT', amount: 300_000n, merchant: 'OOO ATTO TOLOV' });
    const pharmacy = op({ direction: 'DEBIT', amount: 4_500_000n, merchant: 'OKEAN FARM GLOBAL' });
    const unknown = op({ direction: 'DEBIT', amount: 1_000_000n, merchant: 'XALQ RETAIL MCHJ KHK' });
    const plans = planImport([korzinka, metro, pharmacy, unknown], context());

    expect(plans.get(korzinka.id)).toMatchObject({ resolution: 'EXPENSE', categoryId: 'cat-food', categorySource: 'KNOWN' });
    expect(plans.get(metro.id)).toMatchObject({ resolution: 'EXPENSE', categoryId: 'cat-transport' });
    expect(plans.get(pharmacy.id)).toMatchObject({ resolution: 'EXPENSE', categoryId: 'cat-health' });
    expect(plans.get(unknown.id)).toMatchObject({ resolution: null, categoryId: null });
  });

  it('prefers what the person chose for the shop before', () => {
    const korzinka = op({ direction: 'DEBIT', amount: 1_845_000n, merchant: 'anglesey  food' });
    const plans = planImport([korzinka], context({ memory: new Map([['ANGLESEY FOOD', 'cat-fun']]) }));
    expect(plans.get(korzinka.id)).toMatchObject({ resolution: 'EXPENSE', categoryId: 'cat-fun', categorySource: 'MEMORY' });
  });

  it('never decides card-to-card payments, payment apps or money coming in', () => {
    const p2p = op({ direction: 'DEBIT', amount: 4_044_000n, merchant: 'CLICK P2P U2HEW' });
    const app = op({ direction: 'DEBIT', amount: 500_000n, merchant: 'AO CLICK' });
    const salary = op({ direction: 'CREDIT', amount: 900_000_000n, merchant: 'BO GATE' });
    const plans = planImport([p2p, app, salary], context());
    for (const o of [p2p, app, salary]) expect(plans.get(o.id)?.resolution).toBeNull();
  });
});

describe('planImport: refunds', () => {
  it('cancels a purchase against its refund in the same import', () => {
    const purchase = op({ direction: 'DEBIT', amount: 9_650_000n, merchant: 'OOO UZUM' });
    const refund = op({ direction: 'CREDIT', amount: 9_650_000n, merchant: 'OOO UZUM', reversal: true, occurredAt: minutesLater(1) });
    const plans = planImport([refund, purchase], context());
    expect(plans.get(purchase.id)).toMatchObject({ resolution: 'CANCELLED', pairedId: refund.id });
    expect(plans.get(refund.id)).toMatchObject({ resolution: 'CANCELLED', pairedId: purchase.id });
  });

  it('takes out a purchase saved by an earlier import, but only on the same card, merchant and amount', () => {
    const saved: SavedPurchase = {
      id: 'old-op',
      cardId: 'card-a',
      amount: 9_650_000n,
      merchant: 'OOO UZUM',
      occurredAt: new Date('2026-10-20T12:00:00+05:00'),
      transactionId: 'tx-old',
    };
    const refund = op({ direction: 'CREDIT', amount: 9_650_000n, merchant: 'OOO UZUM', reversal: true });
    const otherCard = op({ direction: 'CREDIT', amount: 9_650_000n, merchant: 'OOO UZUM', reversal: true, cardId: 'card-b' });
    const plans = planImport([refund, otherCard], context({ savedPurchases: [saved] }));
    expect(plans.get(refund.id)).toMatchObject({ resolution: 'CANCELLED', pairedId: 'old-op', transactionId: 'tx-old' });
    expect(plans.get(otherCard.id)?.resolution).toBeNull();
  });

  it('does not match a refund to a purchase made after it or long before it', () => {
    const later = op({ direction: 'DEBIT', amount: 100_000n, merchant: 'SHOP', occurredAt: minutesLater(10) });
    const refund = op({ direction: 'CREDIT', amount: 100_000n, merchant: 'SHOP', reversal: true });
    const ancient: SavedPurchase = { id: 'x', cardId: 'card-a', amount: 100_000n, merchant: 'SHOP', occurredAt: new Date('2026-08-01'), transactionId: 'tx' };
    const plans = planImport([later, refund], context({ savedPurchases: [ancient] }));
    expect(plans.get(refund.id)?.resolution).toBeNull();
    expect(plans.get(later.id)?.resolution).not.toBe('CANCELLED');
  });
});

describe('planImport: transfers between own cards', () => {
  const out = (amount: bigint, minutes = 0) =>
    op({ direction: 'DEBIT', amount, merchant: 'UB P2P UZCARD2HUMO', occurredAt: minutesLater(minutes) });
  const into = (amount: bigint, minutes = 1, overrides: Partial<PlanInput> = {}) =>
    op({ direction: 'CREDIT', amount, merchant: 'UB P2P UZCARD2HUMO', cardId: 'card-b', accountId: 'acc-b', occurredAt: minutesLater(minutes), ...overrides });

  it('pairs the same money leaving one card and reaching another within minutes', () => {
    const a = out(5_000_000n);
    const b = into(5_000_000n);
    const plans = planImport([a, b], context());
    expect(plans.get(a.id)).toMatchObject({ resolution: 'TRANSFER', pairedId: b.id, categoryId: null });
    expect(plans.get(b.id)).toMatchObject({ resolution: 'TRANSFER', pairedId: a.id });
  });

  it('books the fee to the fee category, or waits for the person to choose one', () => {
    const a = out(4_044_000n);
    const b = into(4_000_000n);
    const known = planImport([a, b], context({ feeCategoryId: 'cat-fees' }));
    expect(known.get(a.id)).toMatchObject({ resolution: 'TRANSFER', categoryId: 'cat-fees' });

    const unknown = planImport([a, b], context());
    expect(unknown.get(a.id)).toMatchObject({ resolution: null, pairedId: b.id });
    expect(unknown.get(b.id)).toMatchObject({ resolution: null, pairedId: a.id });
  });

  it('does not pair across one account, too far apart in time, or with more than a few percent missing', () => {
    const paired = (a: PlanInput, b: PlanInput) => planImport([a, b], context()).get(a.id)?.pairedId ?? null;
    expect(paired(out(100_000n), into(100_000n, 1, { accountId: 'acc-a' }))).toBeNull();
    expect(paired(out(100_000n), into(100_000n, 30))).toBeNull();
    expect(paired(out(100_000n), into(90_000n))).toBeNull();
  });

  it('is not fooled by a shop purchase of the same amount', () => {
    const shop = op({ direction: 'DEBIT', amount: 5_000_000n, merchant: 'ANGLESEY FOOD' });
    const b = into(5_000_000n);
    const plans = planImport([shop, b], context({ feeCategoryId: 'cat-fees' }));
    expect(plans.get(shop.id)).toMatchObject({ resolution: 'EXPENSE', pairedId: null });
    expect(plans.get(b.id)?.resolution).toBeNull();
  });
});

describe('planImport: entries typed in by hand', () => {
  const manual = (overrides: Partial<ManualEntry>): ManualEntry => ({
    id: 'tx-manual',
    accountId: 'acc-cash',
    type: 'EXPENSE',
    amount: 1_845_000n,
    date: '2026-11-01',
    ...overrides,
  });

  it('links an operation to the same expense typed in that day, on any account, once', () => {
    const first = op({ direction: 'DEBIT', amount: 1_845_000n, merchant: 'ANGLESEY FOOD' });
    const second = op({ direction: 'DEBIT', amount: 1_845_000n, merchant: 'ANGLESEY FOOD' });
    const plans = planImport([first, second], context({ manual: [manual({})] }));
    expect(plans.get(first.id)).toMatchObject({ resolution: 'DUPLICATE', transactionId: 'tx-manual' });
    expect(plans.get(second.id)).toMatchObject({ resolution: 'EXPENSE', categoryId: 'cat-food' });
  });

  it('wants transfers and debts typed in by hand on the card’s own account, and the same day and side', () => {
    const p2p = op({ direction: 'DEBIT', amount: 1_845_000n, merchant: 'CLICK P2P' });
    expect(planImport([p2p], context({ manual: [manual({ type: 'LOAN_GIVEN' })] })).get(p2p.id)?.resolution).toBeNull();
    expect(planImport([p2p], context({ manual: [manual({ type: 'LOAN_GIVEN', accountId: 'acc-a' })] })).get(p2p.id)?.resolution).toBe('DUPLICATE');
    expect(planImport([p2p], context({ manual: [manual({ date: '2026-11-02' })] })).get(p2p.id)?.resolution).toBeNull();
    expect(planImport([p2p], context({ manual: [manual({ type: 'INCOME' })] })).get(p2p.id)?.resolution).toBeNull();
  });
});

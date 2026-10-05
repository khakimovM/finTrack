import { describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { INVALIDATES, invalidateAfter } from './invalidation';

/** docs/05-FRONTEND-SPEC.md, "Query kalitlari va invalidatsiya": the minimum per write. */
const SPEC: Record<keyof typeof INVALIDATES, string[]> = {
  transaction: ['transactions', 'stats', 'accounts', 'budgets'],
  transfer: ['transactions', 'accounts', 'stats'],
  debt: ['debts', 'transactions', 'accounts', 'stats'],
  debtPayment: ['debts', 'transactions', 'accounts', 'stats'],
  budget: ['budgets', 'stats'],
  category: ['categories', 'transactions', 'stats', 'budgets'],
  account: ['accounts', 'transactions', 'stats'],
  recurring: ['recurring'],
  tag: ['tags', 'transactions'],
  recurringRun: ['recurring', 'transactions', 'accounts', 'stats'],
};

describe('INVALIDATES', () => {
  it.each(Object.entries(SPEC))(
    '%s refreshes at least what the spec requires',
    (kind, required) => {
      expect(INVALIDATES[kind as keyof typeof INVALIDATES]).toEqual(
        expect.arrayContaining(required),
      );
    },
  );

  it.each(['transaction', 'debt', 'debtPayment', 'recurringRun'] as const)(
    '%s refreshes notifications (budget and negative-balance alerts)',
    (kind) => {
      expect(INVALIDATES[kind]).toContain('notifications');
    },
  );
});

describe('invalidateAfter', () => {
  it('marks every query under each root stale and leaves the others alone', async () => {
    const client = new QueryClient();
    client.setQueryData(['transactions', { page: 2 }], []);
    client.setQueryData(['stats', 'summary', { from: 'a' }], {});
    client.setQueryData(['categories'], []);
    const spy = vi.spyOn(client, 'invalidateQueries');

    await invalidateAfter(client, 'transfer');

    expect(spy.mock.calls.map(([filters]) => filters?.queryKey)).toEqual(
      INVALIDATES.transfer.map((root) => [root]),
    );
    expect(client.getQueryState(['transactions', { page: 2 }])?.isInvalidated).toBe(true);
    expect(client.getQueryState(['stats', 'summary', { from: 'a' }])?.isInvalidated).toBe(true);
    expect(client.getQueryState(['categories'])?.isInvalidated).toBe(false);
  });
});

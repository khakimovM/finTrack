import { QueryClient } from '@tanstack/react-query';

/** Every query key in the app starts with one of these roots. */
export type QueryRoot =
  | 'transactions'
  | 'stats'
  | 'accounts'
  | 'budgets'
  | 'debts'
  | 'categories'
  | 'recurring'
  | 'notifications';

/**
 * What each kind of write makes stale — docs/05 "Query kalitlari va invalidatsiya", plus
 * `notifications` for writes that can raise an alert (budget threshold, negative balance) and
 * `recurring` where a rule shows the renamed account or category. Too much invalidation is
 * safe; too little shows the user stale money.
 */
export const INVALIDATES = {
  transaction: ['transactions', 'stats', 'accounts', 'budgets', 'notifications'],
  transfer: ['transactions', 'accounts', 'stats', 'notifications'],
  debt: ['debts', 'transactions', 'accounts', 'stats', 'notifications'],
  debtPayment: ['debts', 'transactions', 'accounts', 'stats', 'notifications'],
  budget: ['budgets', 'stats'],
  category: ['categories', 'transactions', 'stats', 'budgets', 'recurring'],
  account: ['accounts', 'transactions', 'stats', 'recurring', 'debts'],
  recurring: ['recurring'],
  /** Run-now, and creation (which books today's occurrence right away). */
  recurringRun: ['recurring', 'transactions', 'accounts', 'stats', 'budgets', 'notifications'],
} as const satisfies Record<string, readonly QueryRoot[]>;

export type WriteKind = keyof typeof INVALIDATES;

export async function invalidateAfter(queryClient: QueryClient, kind: WriteKind): Promise<void> {
  await Promise.all(
    INVALIDATES[kind].map((root) => queryClient.invalidateQueries({ queryKey: [root] })),
  );
}

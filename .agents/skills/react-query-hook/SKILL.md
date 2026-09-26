---
name: react-query-hook
description: Create data hooks for the FinTrack frontend using TanStack Query v5 — query keys, list filters, mutations, invalidation, and error mapping to Uzbek toasts. Use whenever the UI needs to read or write server data.
---

# FinTrack data hooks

## Structure
```
apps/web/src/features/<feature>/
├── api/<feature>.api.ts       # axios calls, typed with packages/shared
└── hooks/use<Feature>.ts      # useQuery / useMutation wrappers
```

## Query keys — always from the registry
`apps/web/src/lib/queryKeys.ts`:

```ts
export const queryKeys = {
  me: ['me'] as const,
  accounts: () => ['accounts'] as const,
  categories: (f?: CategoryFilters) => ['categories', f ?? {}] as const,
  transactions: (f: TransactionFilters) => ['transactions', f] as const,
  budgets: (month: string) => ['budgets', month] as const,
  debts: (f: DebtFilters) => ['debts', f] as const,
  stats: {
    summary: (p: Period) => ['stats', 'summary', p] as const,
    series: (p: Period) => ['stats', 'timeseries', p] as const,
    byCategory: (p: Period) => ['stats', 'by-category', p] as const,
  },
};
```
Never write an inline key array in a component.

## Query hook

```ts
export function useTransactions(filters: TransactionFilters) {
  return useQuery({
    queryKey: queryKeys.transactions(filters),
    queryFn: () => transactionApi.list(filters),
    placeholderData: keepPreviousData,   // no layout collapse while paging
    staleTime: 30_000,
  });
}
```

## Mutation hook

```ts
export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: transactionApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });   // balance changed
      toast.success('Tranzaksiya qo\'shildi');
    },
    onError: (e) => toast.error(apiErrorToMessage(e)),
  });
}
```

## Invalidation map — keep in sync with docs/05-FRONTEND-SPEC.md

| Mutation | Invalidate |
|---|---|
| transaction create/update/delete | `transactions`, `stats`, `accounts`, `budgets` |
| transfer | `transactions`, `accounts`, `stats` |
| debt create/delete | `debts`, `transactions`, `accounts`, `stats` |
| debt payment / settle | `debts`, `transactions`, `accounts`, `stats` |
| budget create/update | `budgets`, `stats` |
| category update/delete | `categories`, `transactions`, `stats` |
| account create/update | `accounts`, `stats` |

Over-invalidating is safe; missing an invalidation shows the user stale money. Prefer broad keys.

## Error mapping
`apiErrorToMessage()` in `src/lib/apiError.ts` maps documented codes to Uzbek text:

| code | message |
|---|---|
| `INSUFFICIENT_BALANCE` | Balansingiz yetarli emas |
| `DEBT_OVERPAYMENT` | To'lov qarz qoldig'idan ko'p |
| `VALIDATION_ERROR` | Kiritilgan ma'lumot noto'g'ri |
| `CATEGORY_EXISTS` | Bunday kategoriya allaqachon mavjud |
| default | Xatolik yuz berdi, qayta urinib ko'ring |

## Rules
- No `useEffect` + `setState` to hold query data.
- No fetching inside a component body — always a hook.
- Handle `isPending`, `isError`, and the empty case in every consuming view.

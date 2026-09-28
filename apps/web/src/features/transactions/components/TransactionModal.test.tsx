import { describe, expect, it } from 'vitest';
import { useState } from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { CategoryResponse } from '@fintrack/shared';
import { TransactionModal } from './TransactionModal';
import { renderWithProviders } from '../../../test/render';
import { ok, server } from '../../../test/server';
import { account, transaction } from '../../../test/fixtures';

function category(id: string, name: string, type: 'INCOME' | 'EXPENSE'): CategoryResponse {
  return {
    id,
    name,
    type,
    icon: '•',
    color: '#000000',
    parentId: null,
    isSystem: false,
    sortOrder: 0,
    children: [],
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  } as CategoryResponse;
}

const food = category('00000000-0000-4000-8000-0000000000f0', 'Oziq-ovqat', 'EXPENSE');
const salary = category('00000000-0000-4000-8000-0000000000a1', 'Oylik', 'INCOME');

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>ochish</button>
      <TransactionModal isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}

describe('TransactionModal', () => {
  it('after an income, the next opening files an expense under an expense category', async () => {
    const posted: Array<{ type: string; categoryId: string }> = [];
    server.use(
      http.get('*/api/v1/accounts', () => HttpResponse.json(ok([account()], { totalBalance: '0' }))),
      http.get('*/api/v1/categories', () => HttpResponse.json(ok([food, salary]))),
      http.post('*/api/v1/transactions', async ({ request }) => {
        posted.push((await request.json()) as { type: string; categoryId: string });
        return HttpResponse.json(ok({ transaction: transaction(), accountBalance: '0', totalBalance: '0', budgetAlert: null }), {
          status: 201,
        });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.click(screen.getByText('ochish'));
    await user.click(await screen.findByRole('button', { name: /Kirim/ }));
    await user.type(screen.getByLabelText('Summa'), '100');
    await user.click(screen.getByRole('button', { name: 'Saqlash' }));
    await waitFor(() => expect(posted).toHaveLength(1));

    await user.click(screen.getByText('ochish'));
    await user.type(await screen.findByLabelText('Summa'), '50');
    await user.click(screen.getByRole('button', { name: 'Saqlash' }));
    await waitFor(() => expect(posted).toHaveLength(2));

    expect(posted.map((p) => [p.type, p.categoryId])).toEqual([
      ['INCOME', salary.id],
      ['EXPENSE', food.id],
    ]);
  });
});

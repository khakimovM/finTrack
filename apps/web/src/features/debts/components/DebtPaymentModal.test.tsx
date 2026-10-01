import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { DebtResponse } from '@fintrack/shared';
import { DebtPaymentModal } from './DebtPaymentModal';
import { renderWithProviders } from '../../../test/render';
import { ok, server } from '../../../test/server';
import { account, cash } from '../../../test/fixtures';

const debt = {
  id: '00000000-0000-4000-8000-0000000000d1',
  personName: 'Ali Valiyev',
  remainingAmount: '150000000',
} as DebtResponse;

describe('DebtPaymentModal', () => {
  it('opens for a debt after rendering closed (hooks keep their order) and pays from the shown account', async () => {
    const posted: Array<Record<string, unknown>> = [];
    server.use(
      http.get('*/api/v1/accounts', () => HttpResponse.json(ok([account()], { totalBalance: '0' }))),
      http.post(`*/api/v1/debts/${debt.id}/payments`, async ({ request }) => {
        posted.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json(ok({ payment: {}, debt, transaction: {} }), { status: 201 });
      }),
    );
    const user = userEvent.setup();
    const { rerender, queryClient } = renderWithProviders(
      <DebtPaymentModal debt={null} isOpen={false} onClose={() => undefined} />,
    );
    // The page renders the modal closed with no debt, then opens it for the chosen one.
    rerender(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <DebtPaymentModal debt={debt} isOpen onClose={() => undefined} />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await user.type(await screen.findByLabelText(/To‘lov summasi/), '500000');
    await user.click(screen.getByRole('button', { name: 'To‘lovni qabul qilish' }));

    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]).toMatchObject({ accountId: cash.id, amount: '50000000' });
  });
});

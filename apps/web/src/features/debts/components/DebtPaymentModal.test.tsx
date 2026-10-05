import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { DebtPaymentModal } from './DebtPaymentModal';
import { renderWithProviders } from '../../../test/render';
import { fail, ok, server } from '../../../test/server';
import { account, cash, debt as debtFixture } from '../../../test/fixtures';

const debt = debtFixture({ personName: 'Ali Valiyev', amount: '150000000', remainingAmount: '150000000' });

function serve(path: 'payments' | 'settle', reply?: () => Response) {
  const posted: Array<Record<string, unknown>> = [];
  server.use(
    http.get('*/api/v1/accounts', () => HttpResponse.json(ok([account()], { totalBalance: '0' }))),
    http.post(`*/api/v1/debts/${debt.id}/${path}`, async ({ request }) => {
      posted.push((await request.json()) as Record<string, unknown>);
      return reply?.() ?? HttpResponse.json(ok({ payment: {}, debt, transaction: {} }), { status: 201 });
    }),
  );
  return posted;
}

describe('DebtPaymentModal', () => {
  it('opens for a debt after rendering closed (hooks keep their order) and pays from the shown account', async () => {
    const posted = serve('payments');
    const user = userEvent.setup();
    const { rerender, queryClient } = renderWithProviders(<DebtPaymentModal debt={null} isOpen={false} onClose={() => undefined} />);
    // The page renders the modal closed with no debt, then opens it for the chosen one.
    rerender(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <DebtPaymentModal debt={debt} isOpen onClose={() => undefined} />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('Ali Valiyev · Joriy qoldiq: 1 500 000 so‘m')).toBeTruthy();
    await user.type(screen.getByLabelText(/To‘lov summasi/), '500000');
    await user.click(screen.getByRole('button', { name: 'Saqlash' }));

    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]).toMatchObject({ accountId: cash.id, amount: '50000000' });
  });

  it('refuses more than what is left before asking the API', async () => {
    const posted = serve('payments');
    renderWithProviders(<DebtPaymentModal debt={debt} isOpen onClose={() => undefined} />);

    await userEvent.type(await screen.findByLabelText(/To‘lov summasi/), '2000000');
    expect(screen.getByRole('alert').textContent).toContain('To‘lov summasi qoldiq qarzdan oshib ketdi');
    expect((screen.getByRole('button', { name: 'Saqlash' }) as HTMLButtonElement).disabled).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: /Hammasi/ }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(posted).toEqual([]);
  });

  it('settles the rest in one payment', async () => {
    const posted = serve('settle');
    renderWithProviders(<DebtPaymentModal debt={debt} mode="settle" isOpen onClose={() => undefined} />);

    expect(await screen.findByText('Qolgan 1 500 000 so‘m bitta to‘lov bilan yopiladi.')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Yopishni tasdiqlash' }));
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]).toMatchObject({ accountId: cash.id, note: 'Qarz to‘liq yopildi' });
    expect(posted[0]).not.toHaveProperty('amount');
  });

  it('shows the strict-mode refusal inside the form', async () => {
    serve('payments', () => HttpResponse.json(fail('INSUFFICIENT_BALANCE'), { status: 422 }));
    renderWithProviders(<DebtPaymentModal debt={{ ...debt, direction: 'I_BORROWED' }} isOpen onClose={() => undefined} />);

    expect(await screen.findByText('Qaysi hisobdan to‘lanadi')).toBeTruthy();
    await userEvent.type(screen.getByLabelText(/To‘lov summasi/), '1000');
    await userEvent.click(screen.getByRole('button', { name: 'Saqlash' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Qatʼiy rejim');
  });
});

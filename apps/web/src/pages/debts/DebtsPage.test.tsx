import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { DebtResponse } from '@fintrack/shared';
import { DebtsPage } from './DebtsPage';
import { renderWithProviders } from '../../test/render';
import { ok, server } from '../../test/server';
import { account, debt } from '../../test/fixtures';

const jasur = debt({ personName: 'Jasur Karimov', amount: '100000000', paidAmount: '40000000', remainingAmount: '60000000', status: 'PARTIALLY_PAID' });
const bank = debt({ personName: 'Bank krediti', direction: 'I_BORROWED', isOverdue: true, dueDate: '2026-09-20', daysLeft: -15 });
const ali = debt({ personName: 'Ali', amount: '5000000', paidAmount: '5000000', remainingAmount: '0', status: 'PAID' });
const summary = { owedToMe: '60000000', iOwe: '100000000', net: '-40000000', overdueCount: 1 };

function serve(debts: DebtResponse[]) {
  const deleted: string[] = [];
  server.use(
    // The pay and edit forms are mounted (closed) with the page.
    http.get('*/api/v1/accounts', () => HttpResponse.json(ok([account()], { totalBalance: '0' }))),
    http.get('*/api/v1/debts', () => HttpResponse.json(ok(debts, { page: 1, limit: 100, total: debts.length, totalPages: 1, summary }))),
    http.get(`*/api/v1/debts/${jasur.id}/payments`, () =>
      HttpResponse.json(
        ok([
          { id: 'p1', amount: '40000000', paidAt: '2026-09-25', note: 'Qisman qaytardi', account: { id: 'a1', name: 'Humo karta', icon: '💳' }, createdAt: '' },
        ]),
      ),
    ),
    http.delete(`*/api/v1/debts/${jasur.id}/payments/:paymentId`, ({ params }) => {
      deleted.push(String(params.paymentId));
      return HttpResponse.json(ok(jasur));
    }),
  );
  return deleted;
}

const cardOf = (name: string) => screen.getByRole('article', { name });

describe('DebtsPage', () => {
  it('sums both directions and puts open, overdue debts first', async () => {
    serve([ali, jasur, bank]);
    renderWithProviders(<DebtsPage />);

    expect(await screen.findByText('Saldo')).toBeTruthy();
    expect(screen.getByText('−400 000 so‘m')).toBeTruthy();
    expect(screen.getAllByRole('article').map((card) => card.getAttribute('aria-label'))).toEqual(['Bank krediti', 'Jasur Karimov', 'Ali']);
    expect(within(cardOf('Bank krediti')).getByText('Muddati o‘tgan!')).toBeTruthy();
    // A paid debt has nothing left to pay.
    expect(within(cardOf('Ali')).queryByRole('button', { name: 'To‘lov kiritish' })).toBeNull();
  });

  it('filters by direction and by status, with counts', async () => {
    serve([ali, jasur, bank]);
    renderWithProviders(<DebtsPage />);

    await userEvent.click(await screen.findByRole('button', { name: /Menga qarzdor/ }));
    expect(screen.queryByRole('article', { name: 'Bank krediti' })).toBeNull();
    const paidChip = screen.getByRole('button', { name: /^To‘langan/ });
    expect(paidChip.textContent).toContain('1');
    await userEvent.click(paidChip);
    expect(screen.getAllByRole('article').map((card) => card.getAttribute('aria-label'))).toEqual(['Ali']);
  });

  it('opens the debt a transaction pointed to, with its payment history and accounts', async () => {
    serve([ali, jasur, bank]);
    renderWithProviders(<DebtsPage />, { route: `/app/debts?debt=${jasur.id}` });

    const card = await screen.findByRole('article', { name: 'Jasur Karimov' });
    expect(await within(card).findByText('25-sentabr, 2026 · Humo karta')).toBeTruthy();
    expect(within(card).getByRole('button', { name: /To‘lovlar tarixi \(1\)/ }).getAttribute('aria-expanded')).toBe('true');
  });

  it('deletes a payment after asking', async () => {
    const deleted = serve([jasur]);
    renderWithProviders(<DebtsPage />);

    await userEvent.click(within(await screen.findByRole('article', { name: 'Jasur Karimov' })).getByRole('button', { name: /To‘lovlar tarixi/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'To‘lovni o‘chirish' }));
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'O‘chirish' }));
    await waitFor(() => expect(deleted).toEqual(['p1']));
  });
});

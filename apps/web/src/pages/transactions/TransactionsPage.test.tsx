import { afterEach, describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { TransactionResponse } from '@fintrack/shared';
import { TransactionsPage } from './TransactionsPage';
import { renderWithProviders } from '../../test/render';
import { ok, server } from '../../test/server';
import { account, transaction } from '../../test/fixtures';
import { setViewportWidth } from '../../test/viewport';

const sums = { income: '0', expense: '5000000', incomeCount: 0, expenseCount: 1 };

/** Answers the list from `pages` (by the page asked for) and records every query string. */
function serve(pages: TransactionResponse[][], total = pages.flat().length) {
  const queries: URLSearchParams[] = [];
  server.use(
    http.get('*/api/v1/accounts', () => HttpResponse.json(ok([account()], { totalBalance: '0' }))),
    http.get('*/api/v1/categories', () => HttpResponse.json(ok([]))),
    http.get('*/api/v1/transactions', ({ request }) => {
      const params = new URL(request.url).searchParams;
      queries.push(params);
      const page = Number(params.get('page') ?? 1);
      const data = pages[page - 1] ?? [];
      return HttpResponse.json(ok(data, { page, limit: 20, total, totalPages: pages.length, sums }));
    }),
  );
  return queries;
}

afterEach(() => setViewportWidth(1280));

describe('TransactionsPage', () => {
  it('shows the filtered totals with their counts', async () => {
    serve([[transaction({ note: 'Taksi' })]]);
    renderWithProviders(<TransactionsPage />, { route: '/app/transactions' });

    expect(await screen.findByText('Taksi')).toBeTruthy();
    expect(screen.getByText('1 ta chiqim')).toBeTruthy();
    expect(screen.getByText('0 ta kirim')).toBeTruthy();
  });

  it('sends the URL filters to the API and offers to clear them when nothing matches', async () => {
    const queries = serve([[]], 0);
    renderWithProviders(<TransactionsPage />, { route: '/app/transactions?type=INCOME&min=1000&sort=big' });

    expect(await screen.findByText('Tranzaksiyalar topilmadi')).toBeTruthy();
    const last = queries[queries.length - 1];
    expect(last.get('type')).toBe('INCOME');
    expect(last.get('minAmount')).toBe('100000');
    expect(last.get('sort')).toBe('amount:desc');

    await userEvent.click(screen.getAllByRole('button', { name: 'Filtrlarni tozalash' })[0]);
    await waitFor(() => {
      const after = queries[queries.length - 1];
      expect(after.get('type')).toBeNull();
      // The sort is how the list is read, not a filter: it stays.
      expect(after.get('sort')).toBe('amount:desc');
    });
  });

  it('greets a new user with the first-transaction state', async () => {
    serve([[]], 0);
    renderWithProviders(<TransactionsPage />, { route: '/app/transactions' });
    expect(await screen.findByText('Hali tranzaksiyalar yo‘q')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Birinchi tranzaksiyani qo‘shish/ })).toBeTruthy();
  });

  it('appends the next page on phones', async () => {
    setViewportWidth(390);
    serve([[transaction({ note: 'Birinchi' })], [transaction({ note: 'Ikkinchi' })]]);
    renderWithProviders(<TransactionsPage />, { route: '/app/transactions' });

    expect(await screen.findByText('Birinchi')).toBeTruthy();
    expect(screen.getByText('Jami 2 tadan 1–1 ko‘rsatilmoqda')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Yana yuklash' }));

    expect(await screen.findByText('Ikkinchi')).toBeTruthy();
    expect(screen.getByText('Birinchi')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Yana yuklash' })).toBeNull();
  });
});

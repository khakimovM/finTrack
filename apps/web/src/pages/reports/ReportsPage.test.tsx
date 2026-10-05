import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { StatsCompareResponse, todayLocalIso } from '@fintrack/shared';
import { ReportsPage } from './ReportsPage';
import { renderWithProviders } from '../../test/render';
import { ok, server } from '../../test/server';

function compare(over: Partial<StatsCompareResponse> = {}): StatsCompareResponse {
  return {
    current: { from: '', to: '', income: '800000000', expense: '300000000', net: '500000000', transactionCount: 12 },
    previous: { from: '', to: '', income: '0', expense: '200000000', net: '-200000000', transactionCount: 7 },
    changes: {
      incomeChange: '800000000',
      incomeChangePercent: 100,
      expenseChange: '100000000',
      expenseChangePercent: 50,
      netChange: '700000000',
      netChangePercent: 350,
    },
    byCategory: [],
    ...over,
  };
}

const transport = (amount: string) => ({
  categoryId: 'c1',
  name: 'Transport',
  icon: '🚗',
  color: '#3d7bd6',
  amount,
  percent: 100,
  count: 3,
  children: [],
});

function serve(body: StatsCompareResponse) {
  const queries: URLSearchParams[] = [];
  const today = todayLocalIso();
  server.use(
    http.get('*/api/v1/stats/compare', ({ request }) => {
      queries.push(new URL(request.url).searchParams);
      return HttpResponse.json(ok(body));
    }),
    http.get('*/api/v1/stats/timeseries', ({ request }) => {
      const from = new URL(request.url).searchParams.get('from') ?? today;
      return HttpResponse.json({
        success: true,
        data: [{ bucket: from, income: '0', expense: from.startsWith(today.slice(0, 7)) ? '300000000' : '200000000', net: '0' }],
        meta: { groupBy: 'day', from, to: from, bucketCount: 1 },
      });
    }),
    http.get('*/api/v1/stats/by-category', ({ request }) => {
      const params = new URL(request.url).searchParams;
      const current = params.get('from')?.startsWith(today.slice(0, 7));
      const items = params.get('type') === 'EXPENSE' ? [transport(current ? '300000000' : '200000000')] : [];
      return HttpResponse.json(ok({ total: '0', items }));
    }),
  );
  return queries;
}

describe('ReportsPage', () => {
  it('compares this month so far with the same days of last month', async () => {
    const queries = serve(compare());
    renderWithProviders(<ReportsPage />);

    const spending = await screen.findByRole('region', { name: 'Xarajatlar kategoriyalar bo‘yicha' });
    expect(within(spending).getByText('Transport')).toBeTruthy();
    const today = todayLocalIso();
    expect(queries[0].get('currentFrom')).toBe(`${today.slice(0, 8)}01`);
    expect(queries[0].get('currentTo')).toBe(today);
    expect(within(screen.getByRole('region', { name: 'Kirimlar kategoriyalar bo‘yicha' })).getByText('Bu davrlarda yozuvlar yo‘q')).toBeTruthy();
  });

  it('says "yangi" instead of +100% and shows more spending as bad news', async () => {
    serve(compare());
    renderWithProviders(<ReportsPage />);

    const income = await screen.findByRole('region', { name: 'Kirim' });
    expect(within(income).getByText('yangi')).toBeTruthy();
    const spending = within(screen.getByRole('region', { name: 'Chiqim' })).getByLabelText('O‘sish 50%');
    expect(spending.className).toContain('text-danger');
  });

  it('shows the empty state when neither period has records', async () => {
    const empty = compare();
    serve({
      ...empty,
      current: { ...empty.current, transactionCount: 0 },
      previous: { ...empty.previous, transactionCount: 0 },
    });
    renderWithProviders(<ReportsPage />);

    expect(await screen.findByText('Bu davrlarda yozuvlar yo‘q')).toBeTruthy();
  });

  it('applies a custom range only when it is the right way round', async () => {
    const queries = serve(compare());
    renderWithProviders(<ReportsPage />);
    await screen.findByRole('region', { name: 'Kirim' });

    await userEvent.click(screen.getByRole('radio', { name: 'Oraliq' }));
    fireEvent.change(screen.getByLabelText('Boshlanish'), { target: { value: '2026-09-20' } });
    fireEvent.change(screen.getByLabelText('Tugash'), { target: { value: '2026-09-10' } });
    await userEvent.click(screen.getByRole('button', { name: 'Qo‘llash' }));

    expect(screen.getByRole('alert').textContent).toContain('Tugash sanasi boshlanishdan oldin bo‘lishi mumkin emas');
    expect(queries.some((q) => q.get('currentFrom') === '2026-09-20')).toBe(false);

    fireEvent.change(screen.getByLabelText('Tugash'), { target: { value: '2026-09-25' } });
    await userEvent.click(screen.getByRole('button', { name: 'Qo‘llash' }));
    await waitFor(() => expect(queries.some((q) => q.get('currentFrom') === '2026-09-20' && q.get('currentTo') === '2026-09-25')).toBe(true));
  });
});

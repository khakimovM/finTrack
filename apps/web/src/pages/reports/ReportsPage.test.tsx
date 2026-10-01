import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { StatsCompareResponse, todayLocalIso } from '@fintrack/shared';
import { ReportsPage } from './ReportsPage';
import { renderWithProviders } from '../../test/render';
import { ok, server } from '../../test/server';

function compare(over: Partial<StatsCompareResponse> = {}): StatsCompareResponse {
  return {
    current: {
      from: '',
      to: '',
      income: '800000000',
      expense: '300000000',
      net: '500000000',
      transactionCount: 12,
    },
    previous: {
      from: '',
      to: '',
      income: '0',
      expense: '200000000',
      net: '-200000000',
      transactionCount: 7,
    },
    changes: {
      incomeChange: '800000000',
      incomeChangePercent: 100,
      expenseChange: '100000000',
      expenseChangePercent: 50,
      netChange: '700000000',
      netChangePercent: 350,
    },
    byCategory: [
      {
        categoryId: 'c1',
        name: 'Transport',
        icon: '🚗',
        color: '#f97316',
        currentAmount: '300000000',
        previousAmount: '200000000',
        change: '100000000',
        changePercent: 50,
      },
    ],
    ...over,
  };
}

function mockCompare(body: StatsCompareResponse, queries: URLSearchParams[] = []) {
  server.use(
    http.get('*/api/v1/stats/compare', ({ request }) => {
      queries.push(new URL(request.url).searchParams);
      return HttpResponse.json(ok(body));
    }),
  );
  return queries;
}

describe('ReportsPage', () => {
  it('compares this month so far with the same days of last month', async () => {
    const queries = mockCompare(compare());
    renderWithProviders(<ReportsPage />);

    expect(await screen.findByText('Transport')).toBeTruthy();
    const today = todayLocalIso();
    expect(queries[0].get('currentFrom')).toBe(`${today.slice(0, 8)}01`);
    expect(queries[0].get('currentTo')).toBe(today);
  });

  it('says "yangi" instead of +100% when the previous period had nothing', async () => {
    mockCompare(compare());
    renderWithProviders(<ReportsPage />);

    expect(await screen.findByLabelText('o‘sdi: yangi')).toBeTruthy();
    // Spending grew: shown as bad news, not as a green arrow.
    const spending = screen.getAllByLabelText('o‘sdi: 50%');
    expect(spending[0].className).toContain('text-destructive');
  });

  it('shows the empty state when neither period has records', async () => {
    const empty = compare();
    mockCompare({
      ...empty,
      current: { ...empty.current, transactionCount: 0 },
      previous: { ...empty.previous, transactionCount: 0 },
    });
    renderWithProviders(<ReportsPage />);

    expect(await screen.findByText('Bu davrlarda yozuvlar yo‘q')).toBeTruthy();
  });

  it('does not query an inverted custom range', async () => {
    const queries = mockCompare(compare());
    renderWithProviders(<ReportsPage />);
    await screen.findByText('Transport');

    await userEvent.click(screen.getByRole('tab', { name: 'Oraliq' }));
    const from = screen.getByLabelText('Boshlanish');
    await userEvent.clear(from);
    await userEvent.type(from, '2099-01-01');

    await waitFor(() =>
      expect(
        screen.getByText('Tugash sanasi boshlanishdan oldin bo‘lishi mumkin emas'),
      ).toBeTruthy(),
    );
    expect(queries.every((q) => q.get('currentFrom') !== '2099-01-01')).toBe(true);
  });
});

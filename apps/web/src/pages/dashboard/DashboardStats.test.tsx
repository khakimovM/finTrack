import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { StatsSummaryResponse } from '@fintrack/shared';
import { DashboardPage } from './DashboardPage';
import { usePeriodStore } from '../../stores/periodStore';
import { renderWithProviders } from '../../test/render';
import { ok, server } from '../../test/server';
import { account, debt, transaction } from '../../test/fixtures';

const summary: StatsSummaryResponse = {
  totalBalance: '110000000',
  isNegative: false,
  periodIncome: '50000000',
  periodExpense: '30000000',
  periodNet: '20000000',
  spentPercent: 60,
  byAccount: [],
  debt: { owedToMe: '0', iOwe: '0', net: '0', overdueCount: 0 },
  topCategory: null,
  transactionCount: 4,
  previousPeriod: { income: '40000000', expense: '20000000', changePercent: 50 },
};

const page = (data: unknown[]) => ({ success: true, data, meta: { page: 1, limit: 100, total: data.length, totalPages: 1 } });

/** Every widget's endpoint; returns the balance-trend queries the page made. */
function serve() {
  const trendQueries: URLSearchParams[] = [];
  server.use(
    http.get('*/api/v1/stats/summary', () => HttpResponse.json(ok(summary))),
    http.get('*/api/v1/stats/balance-trend', ({ request }) => {
      const params = new URL(request.url).searchParams;
      trendQueries.push(params);
      return HttpResponse.json({
        success: true,
        data: [{ date: params.get('from'), balance: '105000000', change: '5000000' }],
        // The end differs from today's balance on purpose: the balance card shows today's.
        meta: { from: params.get('from'), to: params.get('to'), startingBalance: '100000000', endingBalance: '105000000' },
      });
    }),
    http.get('*/api/v1/stats/timeseries', () =>
      HttpResponse.json({ success: true, data: [], meta: { groupBy: 'week', from: '', to: '', bucketCount: 0 } }),
    ),
    http.get('*/api/v1/stats/by-category', () => HttpResponse.json(ok({ total: '0', items: [] }))),
    http.get('*/api/v1/stats/debts', () =>
      HttpResponse.json(
        ok({
          owedToMe: '300000000',
          iOwe: '50000000',
          net: '250000000',
          activeCount: 3,
          overdueCount: 0,
          overdueAmount: '0',
          partiallyPaidCount: 0,
          paidCount: 0,
        }),
      ),
    ),
    http.get('*/api/v1/debts', () =>
      HttpResponse.json(
        page([
          debt({ personName: 'Jasur Karimov' }),
          // The same man lent to a second time, typed a little differently.
          debt({ personName: 'jasur karimov ', amount: '200000000', remainingAmount: '200000000' }),
          debt({ direction: 'I_BORROWED', personName: 'Dilnoza', remainingAmount: '50000000' }),
        ]),
      ),
    ),
    http.get('*/api/v1/transactions', () => HttpResponse.json(page([transaction({ date: '2026-10-21' })]))),
    http.get('*/api/v1/accounts', () => HttpResponse.json({ success: true, data: [account()], meta: { totalBalance: '110000000' } })),
    http.get('*/api/v1/budgets/status', () =>
      HttpResponse.json({ success: true, data: [], meta: { month: '2026-10', totalLimit: '0', totalSpent: '0' } }),
    ),
  );
  return trendQueries;
}

describe('Dashboard figures', () => {
  beforeEach(() => {
    // Thursday 22 October 2026: the month is two thirds through.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-22T09:00:00Z'));
    usePeriodStore.setState({ preset: 'this_month', from: '2026-10-01', to: '2026-10-31', groupBy: 'week' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('says what each chip compares with: the same days of last month, and the balance the month began with', async () => {
    serve();
    renderWithProviders(<DashboardPage />);

    // Income and expense so far against 1–22 September (the server's previousPeriod).
    expect(await screen.findByLabelText('O‘sish 25%')).toBeTruthy();
    expect(screen.getByLabelText('O‘sish 50%')).toBeTruthy();
    expect(screen.getAllByText('o‘tgan oyning shu kunlariga nisbatan')).toHaveLength(2);
    expect(screen.queryByText('o‘tgan oyga nisbatan')).toBeNull();
    // 1.1 mln now against 1 mln on 1 October: +10%, whatever the trend's last point says.
    expect(await screen.findByLabelText('O‘sish 10%')).toBeTruthy();
    expect(screen.getByText('oy boshiga nisbatan')).toBeTruthy();
  });

  it('draws the balance up to today, not as a flat line to the end of the month', async () => {
    const trendQueries = serve();
    renderWithProviders(<DashboardPage />);

    const card = (await screen.findByRole('heading', { name: 'Balans dinamikasi' })).closest('section') as HTMLElement;
    expect(await within(card).findByText('Bugun')).toBeTruthy();
    expect(within(card).queryByText('Yakuniy')).toBeNull();
    expect(trendQueries.map((q) => `${q.get('from')} ${q.get('to')}`)).toEqual(['2026-10-01 2026-10-22']);
  });

  it('counts the people in debt, not the debts', async () => {
    serve();
    renderWithProviders(<DashboardPage />);

    const card = (await screen.findByRole('heading', { name: 'Qarzlar' })).closest('section') as HTMLElement;
    const owed = (await within(card).findByText('Menga qarzdor')).parentElement as HTMLElement;
    expect(within(owed).getByText('1 kishi')).toBeTruthy();
    const owing = within(card).getByText('Men qarzdorman').parentElement as HTMLElement;
    expect(within(owing).getByText('1 kishi')).toBeTruthy();
  });
});

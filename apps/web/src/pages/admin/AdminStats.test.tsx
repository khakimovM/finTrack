import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { AdminOverviewResponse, AdminUsageResponse } from '@fintrack/shared';
import { AdminShell } from '../../features/admin/components/AdminShell';
import { AdminOverviewPage } from './AdminOverviewPage';
import { AdminGrowthPage } from './AdminGrowthPage';
import { renderWithProviders } from '../../test/render';
import { ok, server } from '../../test/server';
import { mockAdminPanel, overview, usage, userRow } from '../../test/adminFixtures';

// What the panel showed on 2026-10-21: 27 people, 18 of them new this week, one the week before.
const youngOverview: AdminOverviewResponse = {
  ...overview,
  users: {
    ...overview.users,
    total: 27,
    newToday: 4,
    new7d: { current: 18, previous: 1 },
    new30d: { current: 27, previous: 0 },
    activeToday: 8,
    active7d: { current: 23, previous: 1 },
    active30d: { current: 25, previous: 0 },
  },
  entries: { total: 40, today: 13, last7d: { current: 34, previous: 5 } },
};
const youngUsage: AdminUsageResponse = { ...usage, activeUsers: { total: 25, web: 12, miniApp: 8, bot: 23, unknown: 6 } };

function renderPanel(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/admin" element={<AdminShell />}>
        <Route index element={<AdminOverviewPage />} />
        <Route path="growth" element={<AdminGrowthPage />} />
      </Route>
    </Routes>,
    { route },
  );
}

describe('Admin statistics as read', () => {
  beforeEach(() => {
    // Thursday 2026-10-08, 15:00 in Tashkent.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-08T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('overview: every change chip compares the number it sits under', async () => {
    mockAdminPanel();
    server.use(
      http.get('*/api/v1/admin/stats/overview', () => HttpResponse.json(ok(youngOverview))),
      http.get('*/api/v1/admin/stats/usage', () => HttpResponse.json(ok(youngUsage))),
    );
    renderPanel('/admin');

    // 27 people now, 9 a week ago: the user base tripled (+200%), not "18 sign-ups against 1".
    expect(await screen.findByLabelText('O‘sish 200%')).toBeTruthy();
    expect(screen.queryByLabelText('O‘sish 1700%')).toBeNull();
    // The weekly actives are the number, compared with the week before; today is a detail.
    expect(screen.getByText('7 kunda faol')).toBeTruthy();
    expect(screen.getByLabelText('O‘sish 2200%')).toBeTruthy();
    expect(screen.getByText('Bugun 8 kishi')).toBeTruthy();
    expect(screen.getAllByText('oldingi 7 kunga nisbatan')).toHaveLength(2);
    expect(screen.getByText('Foydalanuvchilarning 93%')).toBeTruthy();
  });

  it('overview: channels are shares of the people active, which may add up past 100%', async () => {
    mockAdminPanel();
    server.use(http.get('*/api/v1/admin/stats/usage', () => HttpResponse.json(ok(youngUsage))));
    renderPanel('/admin');

    const card = (await screen.findByRole('heading', { name: 'Kanallar, 30 kun' })).closest('section') as HTMLElement;
    expect(await within(card).findByText('23 · 92%')).toBeTruthy();
    expect(within(card).getByText('12 · 48%')).toBeTruthy();
    expect(within(card).getByText('6 · 24%')).toBeTruthy();
    expect(within(card).getByText(/25 faol foydalanuvchidan/)).toBeTruthy();
  });

  it('overview: a sign-up after midnight in Tashkent is today, though still yesterday in UTC', async () => {
    mockAdminPanel();
    server.use(
      http.get('*/api/v1/admin/users', () =>
        HttpResponse.json(ok([userRow({ createdAt: '2026-10-07T20:30:00.000Z' })], { page: 1, limit: 6, total: 1, totalPages: 1 })),
      ),
    );
    renderPanel('/admin');
    const link = await screen.findByRole('link', { name: /Zebo Karimova/ });
    expect(within(link).getByText('Bugun')).toBeTruthy();
  });

  it('growth: weeks are whole, and coming back in week 2 is counted only among people two weeks in', async () => {
    const growthFrom: string[] = [];
    mockAdminPanel();
    server.use(
      http.get('*/api/v1/admin/stats/growth', ({ request }) => {
        const params = new URL(request.url).searchParams;
        growthFrom.push(`${params.get('from')} ${params.get('groupBy')}`);
        return HttpResponse.json(ok({ groupBy: params.get('groupBy'), points: [] }));
      }),
      http.get('*/api/v1/admin/stats/retention', () =>
        HttpResponse.json(
          ok({
            weeks: 9,
            cohorts: [
              { week: '2026-09-28', size: 4, active: [4, 1, null, null, null, null, null, null, null] },
              { week: '2026-10-05', size: 2, active: [2, null, null, null, null, null, null, null, null] },
            ],
          }),
        ),
      ),
      http.get('*/api/v1/admin/stats/funnel', ({ request }) => {
        const params = new URL(request.url).searchParams;
        const from = params.get('from') ?? '';
        const to = params.get('to') ?? '';
        // Everyone in the 90 days, and those of them who signed up at least 14 days ago.
        const counts =
          to === '2026-10-08'
            ? { registered: 20, firstEntry: 12, fiveEntries: 6, returnedWeek2: 4 }
            : { registered: 10, firstEntry: 8, fiveEntries: 5, returnedWeek2: 4 };
        return HttpResponse.json(ok({ from, to, ...counts }));
      }),
    );
    renderPanel('/admin/growth');

    // 90 days back from Thursday 2026-10-08 is Saturday 2026-07-11; its week began on Monday the 6th.
    expect(await screen.findByText('Haftalik qaytish (kogortalar)')).toBeTruthy();
    expect(growthFrom).toContain('2026-07-06 week');
    expect(await screen.findByText('12 · 60%')).toBeTruthy();
    // 4 of the 10 whose second week is over, not 4 of all 20.
    expect(screen.getByText('4 · 40%')).toBeTruthy();
    expect(screen.queryByText('4 · 20%')).toBeNull();
    expect(screen.getByText(/14 kuni to‘lganlar orasida hisoblanadi \(10 kishi\)/)).toBeTruthy();

    // This week (from Monday 2026-10-05) is not over: its cells say so instead of passing for final.
    expect(screen.getByTitle('4 / 4')).toBeTruthy();
    expect(screen.getByTitle('1 / 4 · hafta davom etmoqda')).toBeTruthy();
    expect(screen.getByTitle('2 / 2 · hafta davom etmoqda')).toBeTruthy();
  });
});

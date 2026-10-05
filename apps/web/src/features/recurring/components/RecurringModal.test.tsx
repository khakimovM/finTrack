import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { RecurringModal } from './RecurringModal';
import { renderWithProviders } from '../../../test/render';
import { ok, server } from '../../../test/server';
import { account, cash, rule } from '../../../test/fixtures';

function serve() {
  const calls: { posted: unknown[]; patched: unknown[] } = { posted: [], patched: [] };
  server.use(
    http.get('*/api/v1/accounts', () => HttpResponse.json(ok([account()], { totalBalance: '0' }))),
    http.get('*/api/v1/categories', () => HttpResponse.json(ok([]))),
    http.post('*/api/v1/recurring', async ({ request }) => {
      calls.posted.push(await request.json());
      return HttpResponse.json(ok(rule()), { status: 201 });
    }),
    http.patch('*/api/v1/recurring/:id', async ({ request }) => {
      calls.patched.push(await request.json());
      return HttpResponse.json(ok(rule()));
    }),
  );
  return calls;
}

// Saturday, 3 October 2026: the forms' "today".
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 3, 12));
});
afterEach(() => vi.useRealTimers());

describe('RecurringModal', () => {
  it('previews the first payment the way the API schedules it', async () => {
    const calls = serve();
    renderWithProviders(<RecurringModal isOpen onClose={() => undefined} />);

    // A monthly rule starts on today's day of the month: booked today.
    expect(await screen.findByText('Keyingi to‘lov: 3-oktabr, 2026 (bugun yoziladi)')).toBeTruthy();

    await userEvent.click(screen.getByRole('radio', { name: 'Har hafta' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Dushanba' }));
    expect(screen.getByText('Keyingi to‘lov: 5-oktabr, 2026')).toBeTruthy();

    await userEvent.type(screen.getByLabelText('Summa'), '150000');
    await userEvent.click(screen.getByRole('button', { name: 'Saqlash' }));
    await waitFor(() => expect(calls.posted).toHaveLength(1));
    expect(calls.posted[0]).toMatchObject({
      type: 'EXPENSE',
      amount: '15000000',
      accountId: cash.id,
      categoryId: null,
      frequency: 'WEEKLY',
      dayOfCycle: 1,
      startsAt: '2026-10-03',
      endsAt: null,
    });
  });

  it('sends only what changed when editing', async () => {
    const calls = serve();
    const rent = rule({ amount: '150000000', dayOfCycle: 5, nextRunAt: '2026-10-05', note: null });
    renderWithProviders(<RecurringModal isOpen onClose={() => undefined} rule={rent} />);

    expect(await screen.findByText('Keyingi to‘lov: 5-oktabr, 2026')).toBeTruthy();
    expect(screen.getByText('O‘zgarmaydigan maydonlar')).toBeTruthy();
    await userEvent.click(screen.getByRole('radio', { name: '10' }));
    expect(screen.getByText('Keyingi to‘lov: 10-oktabr, 2026')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Saqlash' }));

    await waitFor(() => expect(calls.patched).toEqual([{ dayOfCycle: 10 }]));
  });
});

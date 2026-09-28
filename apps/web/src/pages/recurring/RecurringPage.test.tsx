import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { RecurringRuleResponse } from '@fintrack/shared';
import { RecurringPage } from './RecurringPage';
import { renderWithProviders } from '../../test/render';
import { fail, ok, server } from '../../test/server';
import { account, rule } from '../../test/fixtures';

interface Calls {
  lists: string[];
  patches: Array<{ id: string; body: unknown }>;
  runs: string[];
}

function mockApi(
  rules: { active: RecurringRuleResponse[]; paused?: RecurringRuleResponse[] },
  calls: Calls,
) {
  server.use(
    http.get('*/api/v1/accounts', () =>
      HttpResponse.json(ok([account()], { totalBalance: '10000000' })),
    ),
    http.get('*/api/v1/categories', () => HttpResponse.json(ok([]))),
    http.get('*/api/v1/recurring', ({ request }) => {
      const isActive = new URL(request.url).searchParams.get('isActive') ?? '';
      calls.lists.push(isActive);
      return HttpResponse.json(ok(isActive === 'false' ? (rules.paused ?? []) : rules.active));
    }),
    http.patch('*/api/v1/recurring/:id', async ({ params, request }) => {
      calls.patches.push({ id: String(params.id), body: await request.json() });
      return HttpResponse.json(ok({ ...rules.active[0], isActive: false }));
    }),
    http.post('*/api/v1/recurring/:id/run-now', ({ params }) => {
      calls.runs.push(String(params.id));
      return HttpResponse.json(ok({ transaction: {}, rule: rules.active[0] }));
    }),
  );
}

const newCalls = (): Calls => ({ lists: [], patches: [], runs: [] });

describe('RecurringPage', () => {
  it('lists active rules with their schedule and next run', async () => {
    const rent = rule();
    mockApi({ active: [rent] }, newCalls());
    renderWithProviders(<RecurringPage />);

    expect(await screen.findByText('Uy-joy')).toBeTruthy();
    expect(screen.getByText('Har oy, 5-kuni')).toBeTruthy();
    expect(screen.getByText('5-oktabr, 2026')).toBeTruthy();
  });

  it('shows the note: as the title without a category, under the details with one', async () => {
    mockApi(
      {
        active: [
          rule({ category: null, categoryId: null, note: 'Internet' }),
          rule({ note: 'Kvartira ijarasi' }),
        ],
      },
      newCalls(),
    );
    renderWithProviders(<RecurringPage />);

    expect(await screen.findByRole('heading', { name: 'Internet' })).toBeTruthy();
    expect(screen.getByText('Kvartira ijarasi')).toBeTruthy();
  });

  it('offers to create the first rule when there are none', async () => {
    mockApi({ active: [] }, newCalls());
    renderWithProviders(<RecurringPage />);

    expect(await screen.findByText('Faol takroriy to‘lovlar yo‘q')).toBeTruthy();
    expect(screen.getByRole('button', { name: '+ Birinchi qoidani qo‘shish' })).toBeTruthy();
  });

  it('shows the error and recovers on retry', async () => {
    const calls = newCalls();
    mockApi({ active: [rule()] }, calls);
    server.use(
      http.get(
        '*/api/v1/recurring',
        () => HttpResponse.json(fail('INTERNAL_ERROR'), { status: 500 }),
        { once: true },
      ),
    );
    renderWithProviders(<RecurringPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Qayta urinish' }));
    expect(await screen.findByText('Uy-joy')).toBeTruthy();
  });

  it('pauses a rule and reloads the list', async () => {
    const calls = newCalls();
    const rent = rule();
    mockApi({ active: [rent] }, calls);
    renderWithProviders(<RecurringPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'To‘xtatish' }));

    await waitFor(() =>
      expect(calls.patches).toEqual([{ id: rent.id, body: { isActive: false } }]),
    );
    await waitFor(() => expect(calls.lists.length).toBeGreaterThanOrEqual(2));
  });

  it('books today only after the user confirms', async () => {
    const calls = newCalls();
    const rent = rule();
    mockApi({ active: [rent] }, calls);
    renderWithProviders(<RecurringPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Hozir bajarish' }));
    await userEvent.click(screen.getByRole('button', { name: 'Bekor qilish' }));
    expect(calls.runs).toEqual([]);

    await userEvent.click(screen.getByRole('button', { name: 'Hozir bajarish' }));
    await userEvent.click(screen.getByRole('button', { name: 'Yozish' }));
    await waitFor(() => expect(calls.runs).toEqual([rent.id]));
  });

  it('shows paused rules on their own tab', async () => {
    const calls = newCalls();
    mockApi({ active: [], paused: [rule({ isActive: false })] }, calls);
    renderWithProviders(<RecurringPage />);

    await userEvent.click(await screen.findByRole('tab', { name: 'To‘xtatilgan' }));

    expect(await screen.findByRole('button', { name: 'Davom ettirish' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Hozir bajarish' })).toBeNull();
    expect(calls.lists).toContain('false');
  });
});

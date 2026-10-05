import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { BudgetStatusItem } from '@fintrack/shared';
import { BudgetsPage } from './BudgetsPage';
import { renderWithProviders } from '../../test/render';
import { ok, server } from '../../test/server';
import { category } from '../../test/fixtures';

const transport = category({ name: 'Transport', children: [category({ name: 'Taksi' })] });
const food = category({ name: 'Oziq-ovqat' });
const fun = category({ name: 'Ko‘ngilochar' });

function item(cat: typeof food, limit: string, spent: string, percent: number): BudgetStatusItem {
  return {
    id: `00000000-0000-4000-8000-${cat.id.slice(-12)}`,
    category: { id: cat.id, name: cat.name, icon: cat.icon, color: cat.color },
    limitAmount: limit,
    spent,
    remaining: (BigInt(limit) - BigInt(spent)).toString(),
    percent,
    state: percent > 100 ? 'EXCEEDED' : percent >= 80 ? 'WARNING' : 'OK',
  };
}

function serve(items: BudgetStatusItem[]) {
  const months: string[] = [];
  const posted: unknown[] = [];
  server.use(
    http.get('*/api/v1/categories', () => HttpResponse.json(ok([transport, food, fun]))),
    http.get('*/api/v1/budgets/status', ({ request }) => {
      months.push(new URL(request.url).searchParams.get('month') ?? '');
      const totalLimit = items.reduce((sum, b) => sum + BigInt(b.limitAmount), 0n).toString();
      const totalSpent = items.reduce((sum, b) => sum + BigInt(b.spent), 0n).toString();
      return HttpResponse.json({ success: true, data: items, meta: { month: '2026-10', totalLimit, totalSpent } });
    }),
    http.post('*/api/v1/budgets', async ({ request }) => {
      posted.push(await request.json());
      return HttpResponse.json(ok(items[0]), { status: 201 });
    }),
  );
  return { months, posted };
}

describe('BudgetsPage', () => {
  it('shows each budget in its zone and the month total', async () => {
    serve([item(food, '100000000', '50000000', 50), item(transport, '50000000', '45000000', 90), item(fun, '20000000', '30000000', 150)]);
    renderWithProviders(<BudgetsPage />, { route: '/app/budgets?month=2026-10' });

    // 125 of 170 spent: 73.5%, shown rounded.
    expect(await screen.findByText('Limitdan 74% sarflandi')).toBeTruthy();
    expect(within(screen.getByRole('article', { name: 'Oziq-ovqat' })).getByText('Meʼyorida')).toBeTruthy();
    expect(within(screen.getByRole('article', { name: 'Transport' })).getByText('80% dan oshdi')).toBeTruthy();
    expect(within(screen.getByRole('article', { name: 'Transport' })).getByText('Subkategoriyalar ham hisobga olinadi')).toBeTruthy();
    const over = screen.getByRole('article', { name: 'Ko‘ngilochar' });
    expect(within(over).getByText('Oshib ketdi')).toBeTruthy();
    expect(within(over).getByText('Limitdan 100 000 so‘m ko‘p sarflandi')).toBeTruthy();
  });

  it('moves between months', async () => {
    const { months } = serve([]);
    renderWithProviders(<BudgetsPage />, { route: '/app/budgets?month=2026-01' });

    expect(await screen.findByText('Yanvar 2026 uchun byudjet yo‘q')).toBeTruthy();
    await userEvent.click(screen.getAllByRole('button', { name: 'Oldingi oy' })[0]);
    expect(await screen.findByText('Dekabr 2025 uchun byudjet yo‘q')).toBeTruthy();
    expect(months).toContain('2025-12');
  });

  it('refuses a category the month already has a budget for', async () => {
    const { posted } = serve([item(food, '100000000', '0', 0)]);
    renderWithProviders(<BudgetsPage />, { route: '/app/budgets?month=2026-10' });

    await userEvent.click((await screen.findAllByRole('button', { name: /Byudjet belgilash/ }))[0]);
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('radio', { name: /Oziq-ovqat/ }));
    expect(within(dialog).getByRole('alert').textContent).toContain('Bu oy uchun ushbu kategoriyada byudjet allaqachon bor');

    await userEvent.click(within(dialog).getByRole('radio', { name: /Transport/ }));
    await userEvent.type(within(dialog).getByLabelText('Oylik limit'), '300000');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Saqlash' }));
    await waitFor(() => expect(posted).toEqual([{ categoryId: transport.id, month: '2026-10', limitAmount: '30000000' }]));
  });
});

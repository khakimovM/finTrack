import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { AccountResponse } from '@fintrack/shared';
import { AccountsPage } from './AccountsPage';
import { renderWithProviders } from '../../test/render';
import { fail, ok, server } from '../../test/server';
import { account } from '../../test/fixtures';

const card = account({ id: '00000000-0000-4000-8000-0000000000c1', name: 'Humo karta', type: 'CARD', isDefault: true, sortOrder: 1, transactionCount: 12 });
const cash = account({ id: '00000000-0000-4000-8000-0000000000c2', name: 'Naqd pul', type: 'CASH', isDefault: false, sortOrder: 2, transactionCount: 0 });
const old = account({
  id: '00000000-0000-4000-8000-0000000000c3',
  name: 'Eski karta',
  isDefault: false,
  archivedAt: '2026-09-01T00:00:00.000Z',
  transactionCount: 0,
});

function serve(accounts: AccountResponse[]) {
  const calls: Array<{ method: string; url: string; body?: unknown }> = [];
  server.use(
    http.get('*/api/v1/accounts', ({ request }) => {
      const withArchived = new URL(request.url).searchParams.get('includeArchived') === 'true';
      return HttpResponse.json(ok(withArchived ? accounts : accounts.filter((a) => !a.archivedAt), { totalBalance: '20000000' }));
    }),
    http.patch('*/api/v1/accounts/reorder', async ({ request }) => {
      calls.push({ method: 'PATCH', url: 'reorder', body: await request.json() });
      return HttpResponse.json(ok({ message: 'ok' }));
    }),
    http.post('*/api/v1/accounts/:id/archive', ({ params }) => {
      calls.push({ method: 'POST', url: `archive/${String(params.id)}` });
      const target = accounts.find((a) => a.id === params.id);
      return HttpResponse.json(ok({ ...target, archivedAt: target?.archivedAt ? null : '2026-10-05T00:00:00.000Z' }));
    }),
    http.delete('*/api/v1/accounts/:id', ({ params }) => {
      calls.push({ method: 'DELETE', url: String(params.id) });
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return calls;
}

const cardOf = (name: string) => screen.getByText(name).closest('[class*="rounded-[20px]"]') as HTMLElement;

describe('AccountsPage', () => {
  it('splits active and archived accounts and shows the total', async () => {
    serve([card, cash, old]);
    renderWithProviders(<AccountsPage />);

    expect(await screen.findByText('Humo karta')).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Faol/ }).textContent).toContain('2');
    expect(screen.getByText('Faol hisoblar: 2 ta')).toBeTruthy();
    expect(screen.queryByText('Eski karta')).toBeNull();

    await userEvent.click(screen.getByRole('tab', { name: /Arxiv/ }));
    expect(screen.getByText('Eski karta')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Arxivdan chiqarish' })).toBeTruthy();
  });

  it('offers to archive an account that has history instead of deleting it', async () => {
    const calls = serve([card, cash]);
    renderWithProviders(<AccountsPage />);

    await screen.findByText('Humo karta');
    await userEvent.click(within(cardOf('Humo karta')).getByRole('button', { name: 'Amallar' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'O‘chirish' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog.textContent).toContain('“Humo karta” hisobida 12 ta tranzaksiya bor');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Arxivlash' }));
    await waitFor(() => expect(calls).toEqual([{ method: 'POST', url: `archive/${card.id}` }]));
  });

  it('never leaves the user without an active account', async () => {
    const calls = serve([cash, old]);
    renderWithProviders(<AccountsPage />);

    await screen.findByText('Naqd pul');
    await userEvent.click(within(cardOf('Naqd pul')).getByRole('button', { name: 'Amallar' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Arxivlash' }));

    expect((await screen.findByRole('alertdialog')).textContent).toContain('Kamida bitta faol hisob qolishi kerak');
    expect(calls).toEqual([]);
  });

  it('deletes an empty account after asking', async () => {
    const calls = serve([card, cash]);
    renderWithProviders(<AccountsPage />);

    await screen.findByText('Naqd pul');
    await userEvent.click(within(cardOf('Naqd pul')).getByRole('button', { name: 'Amallar' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'O‘chirish' }));
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'O‘chirish' }));
    await waitFor(() => expect(calls).toEqual([{ method: 'DELETE', url: cash.id }]));
  });

  it('turns a refused delete into the archive advice', async () => {
    serve([card, cash]);
    server.use(http.delete('*/api/v1/accounts/:id', () => HttpResponse.json(fail('LAST_ACCOUNT'), { status: 422 })));
    renderWithProviders(<AccountsPage />);

    await screen.findByText('Naqd pul');
    await userEvent.click(within(cardOf('Naqd pul')).getByRole('button', { name: 'Amallar' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'O‘chirish' }));
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'O‘chirish' }));
    expect((await screen.findByRole('alertdialog')).textContent).toContain('Kamida bitta faol hisob qolishi kerak');
  });

  it('saves a new order only when the user presses Saqlash', async () => {
    const calls = serve([card, cash]);
    renderWithProviders(<AccountsPage />);

    await userEvent.click(await screen.findByRole('button', { name: /Tartibni o‘zgartirish/ }));
    within(cardOf('Naqd pul')).getByLabelText('Sudrash').focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(calls).toEqual([]);

    await userEvent.click(screen.getByRole('button', { name: 'Saqlash' }));
    await waitFor(() =>
      expect(calls).toEqual([
        {
          method: 'PATCH',
          url: 'reorder',
          body: {
            items: [
              { id: cash.id, sortOrder: 1 },
              { id: card.id, sortOrder: 2 },
            ],
          },
        },
      ]),
    );
  });
});

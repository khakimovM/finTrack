import { afterEach, describe, expect, it } from 'vitest';
import { useState } from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { CategoryResponse, TransactionResponse } from '@fintrack/shared';
import { TransactionModal } from './TransactionModal';
import { renderWithProviders } from '../../../test/render';
import { fail, ok, server } from '../../../test/server';
import { account, cash, transaction, user } from '../../../test/fixtures';
import { useAuthStore } from '../../../stores/authStore';

function category(id: string, name: string, type: 'INCOME' | 'EXPENSE'): CategoryResponse {
  return {
    id,
    name,
    type,
    icon: '•',
    color: '#000000',
    parentId: null,
    isSystem: false,
    sortOrder: 0,
    children: [],
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  } as CategoryResponse;
}

const food = category('00000000-0000-4000-8000-0000000000f0', 'Oziq-ovqat', 'EXPENSE');
const salary = category('00000000-0000-4000-8000-0000000000a1', 'Oylik', 'INCOME');

function Harness({ edit }: { edit?: TransactionResponse }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>ochish</button>
      <TransactionModal isOpen={open} onClose={() => setOpen(false)} transaction={edit ?? null} />
    </>
  );
}

function serveLists() {
  server.use(
    // 100 000 so‘m on the only account.
    http.get('*/api/v1/accounts', () => HttpResponse.json(ok([account({ balance: '10000000' })], { totalBalance: '10000000' }))),
    http.get('*/api/v1/categories', () => HttpResponse.json(ok([food, salary]))),
  );
}

afterEach(() => useAuthStore.setState({ user: null }));

describe('TransactionModal', () => {
  it('after an income, the next opening files an expense under an expense category', async () => {
    const posted: Array<{ type: string; categoryId: string }> = [];
    serveLists();
    server.use(
      http.post('*/api/v1/transactions', async ({ request }) => {
        posted.push((await request.json()) as { type: string; categoryId: string });
        return HttpResponse.json(ok({ transaction: transaction(), accountBalance: '0', totalBalance: '0', budgetAlert: null }), {
          status: 201,
        });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.click(screen.getByText('ochish'));
    await user.click(await screen.findByRole('radio', { name: /Kirim/ }));
    await user.type(screen.getByLabelText('Summa'), '100');
    await user.click(screen.getByRole('button', { name: 'Saqlash' }));
    await waitFor(() => expect(posted).toHaveLength(1));

    await user.click(screen.getByText('ochish'));
    await user.type(await screen.findByLabelText('Summa'), '50');
    await user.click(screen.getByRole('button', { name: 'Saqlash' }));
    await waitFor(() => expect(posted).toHaveLength(2));

    expect(posted.map((p) => [p.type, p.categoryId])).toEqual([
      ['INCOME', salary.id],
      ['EXPENSE', food.id],
    ]);
  });

  it('in strict mode refuses an expense larger than the balance before asking the API', async () => {
    useAuthStore.setState({ user: user({ strictMode: true }) });
    serveLists();
    const actor = userEvent.setup();
    renderWithProviders(<Harness />);

    await actor.click(screen.getByText('ochish'));
    await actor.type(await screen.findByLabelText('Summa'), '150000');

    expect(screen.getByRole('alert').textContent).toContain('Hisobda yetarli mablag‘ yo‘q (Qatʼiy rejim)');
    expect((screen.getByRole('button', { name: 'Saqlash' }) as HTMLButtonElement).disabled).toBe(true);

    // An income is never limited by the balance.
    await actor.click(screen.getByRole('radio', { name: /Kirim/ }));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the server’s strict-mode refusal inside the form', async () => {
    serveLists();
    server.use(http.post('*/api/v1/transactions', () => HttpResponse.json(fail('INSUFFICIENT_BALANCE'), { status: 422 })));
    const actor = userEvent.setup();
    renderWithProviders(<Harness />);

    await actor.click(screen.getByText('ochish'));
    await actor.type(await screen.findByLabelText('Summa'), '50');
    await actor.click(screen.getByRole('button', { name: 'Saqlash' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Qatʼiy rejim');
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('edits by sending only what changed, the type switch included', async () => {
    const patches: unknown[] = [];
    serveLists();
    const existing = transaction({ type: 'EXPENSE', amount: '500000', account: cash, category: { ...food }, note: 'Bozor' });
    server.use(
      http.patch(`*/api/v1/transactions/${existing.id}`, async ({ request }) => {
        patches.push(await request.json());
        return HttpResponse.json(ok(existing));
      }),
    );
    const actor = userEvent.setup();
    renderWithProviders(<Harness edit={existing} />);

    await actor.click(screen.getByText('ochish'));
    expect(await screen.findByRole('heading', { name: 'Tranzaksiyani tahrirlash' })).toBeTruthy();
    await actor.click(screen.getByRole('radio', { name: /Kirim/ }));
    await actor.click(screen.getByRole('button', { name: 'Saqlash' }));

    await waitFor(() => expect(patches).toEqual([{ type: 'INCOME', categoryId: salary.id }]));
  });

  it('creates a new tag inline and files the transaction under it', async () => {
    const newTag = { id: '00000000-0000-4000-8000-0000000000e1', name: 'sayohat', color: '#94a3b8', transactionCount: 0, createdAt: '' };
    const createdTags: unknown[] = [];
    let posted: { tagIds?: string[] } | undefined;
    serveLists();
    server.use(
      http.post('*/api/v1/tags', async ({ request }) => {
        createdTags.push(await request.json());
        return HttpResponse.json(ok(newTag), { status: 201 });
      }),
      http.post('*/api/v1/transactions', async ({ request }) => {
        posted = (await request.json()) as { tagIds?: string[] };
        return HttpResponse.json(ok({ transaction: transaction(), accountBalance: '0', totalBalance: '0', budgetAlert: null }), {
          status: 201,
        });
      }),
    );
    const actor = userEvent.setup();
    renderWithProviders(<Harness />);

    await actor.click(screen.getByText('ochish'));
    await actor.type(await screen.findByLabelText('Summa'), '20');
    await actor.click(screen.getByRole('button', { name: '+ Yangi teg' }));
    await actor.type(screen.getByLabelText('Yangi teg'), '#Sayohat{Enter}');
    await waitFor(() => expect(createdTags).toEqual([{ name: 'sayohat', color: '#94a3b8' }]));

    await actor.click(screen.getByRole('button', { name: 'Saqlash' }));
    await waitFor(() => expect(posted?.tagIds).toEqual([newTag.id]));
  });
});

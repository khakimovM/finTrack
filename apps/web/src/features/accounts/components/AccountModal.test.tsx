import { describe, expect, it } from 'vitest';
import { useState } from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { AccountResponse } from '@fintrack/shared';
import { AccountModal } from './AccountModal';
import { renderWithProviders } from '../../../test/render';
import { fail, ok, server } from '../../../test/server';
import { account } from '../../../test/fixtures';

function Harness({ edit }: { edit?: AccountResponse }) {
  const [open, setOpen] = useState(true);
  return open ? <AccountModal isOpen onClose={() => setOpen(false)} initialAccount={edit ?? null} /> : <p>yopildi</p>;
}

describe('AccountModal', () => {
  it('creates an account with its opening balance in tiyin', async () => {
    let posted: Record<string, unknown> | undefined;
    server.use(
      http.post('*/api/v1/accounts', async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(ok(account()), { status: 201 });
      }),
    );
    renderWithProviders(<Harness />);

    await userEvent.type(screen.getByLabelText('Hisob nomi'), 'Jamg‘arma');
    await userEvent.click(screen.getByRole('radio', { name: /Jamg‘arma \/ Depozit/ }));
    await userEvent.type(screen.getByLabelText('Boshlang‘ich balans'), '250000');
    await userEvent.click(screen.getByRole('button', { name: 'Saqlash' }));

    await waitFor(() => expect(screen.getByText('yopildi')).toBeTruthy());
    expect(posted).toMatchObject({ name: 'Jamg‘arma', type: 'SAVINGS', openingBalance: '25000000' });
  });

  it('shows a taken name next to the field', async () => {
    server.use(http.post('*/api/v1/accounts', () => HttpResponse.json(fail('ACCOUNT_EXISTS'), { status: 409 })));
    renderWithProviders(<Harness />);

    await userEvent.click(screen.getByRole('button', { name: 'Saqlash' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Hisob nomini kiriting');

    await userEvent.type(screen.getByLabelText('Hisob nomi'), 'Humo karta');
    await userEvent.click(screen.getByRole('button', { name: 'Saqlash' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Bunday nomli hisob allaqachon mavjud');
  });

  it('edits without touching the balance, sending only what changed', async () => {
    const existing = account({ name: 'Naqd pul', isDefault: false });
    let patched: unknown;
    server.use(
      http.patch(`*/api/v1/accounts/${existing.id}`, async ({ request }) => {
        patched = await request.json();
        return HttpResponse.json(ok(existing));
      }),
    );
    renderWithProviders(<Harness edit={existing} />);

    expect(screen.getByText('Balans tranzaksiyalar orqali o‘zgaradi')).toBeTruthy();
    expect(screen.queryByLabelText('Boshlang‘ich balans')).toBeNull();
    await userEvent.click(screen.getByRole('switch'));
    await userEvent.click(screen.getByRole('button', { name: 'Saqlash' }));

    await waitFor(() => expect(patched).toEqual({ isDefault: true }));
  });
});

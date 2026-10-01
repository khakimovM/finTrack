import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { DebtModal } from './DebtModal';
import { renderWithProviders } from '../../../test/render';
import { ok, server } from '../../../test/server';
import { account, cash } from '../../../test/fixtures';

describe('DebtModal', () => {
  it('records the debt against the account the select shows, without touching the select', async () => {
    const posted: Array<Record<string, unknown>> = [];
    server.use(
      http.get('*/api/v1/accounts', () => HttpResponse.json(ok([account()], { totalBalance: '0' }))),
      http.post('*/api/v1/debts', async ({ request }) => {
        posted.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json(ok({ debt: {}, transaction: {} }), { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<DebtModal isOpen onClose={() => undefined} />);

    await user.type(screen.getByLabelText(/Shaxs ismi/), 'Ali Valiyev');
    await user.type(screen.getByLabelText(/Summa/), '1500000');
    await user.click(screen.getByRole('button', { name: 'Saqlash' }));

    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]).toMatchObject({ accountId: cash.id, personName: 'Ali Valiyev', amount: '150000000' });
  });
});

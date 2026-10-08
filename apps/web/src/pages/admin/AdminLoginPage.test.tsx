import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { AdminLoginPage } from './AdminLoginPage';
import { AdminHomePage } from './AdminHomePage';
import { AdminShell } from '../../features/admin/components/AdminShell';
import { renderWithProviders } from '../../test/render';
import { fail, ok, server } from '../../test/server';

const requestId = '00000000-0000-4000-8000-0000000ad111';
const adminSession = {
  admin: { id: '00000000-0000-4000-8000-0000000000a1', name: 'Aziz', telegramUsername: 'aziz' },
  expiresAt: '2026-10-08T17:00:00.000Z',
};

/** No admin session until the code is verified; the admin API answers 404 like an unknown URL. */
function mockAdminApi() {
  let signedIn = false;
  server.use(
    http.get('*/api/v1/admin/auth/me', () =>
      signedIn ? HttpResponse.json(ok(adminSession)) : HttpResponse.json(fail('NOT_FOUND'), { status: 404 }),
    ),
    http.post('*/api/v1/admin/auth/telegram/start', () =>
      HttpResponse.json(
        ok({
          requestId,
          deepLink: 'https://t.me/fintrack_bot?start=admin_abc',
          botUsername: 'fintrack_bot',
          expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
        }),
        { status: 201 },
      ),
    ),
    http.get(`*/api/v1/admin/auth/telegram/status/${requestId}`, () =>
      HttpResponse.json(ok({ status: 'CODE_SENT', codeExpiresAt: new Date(Date.now() + 180_000).toISOString() })),
    ),
    http.post('*/api/v1/admin/auth/telegram/verify', () => {
      signedIn = true;
      return HttpResponse.json(ok(adminSession));
    }),
  );
}

function renderAdmin(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin" element={<AdminShell />}>
        <Route index element={<AdminHomePage />} />
      </Route>
    </Routes>,
    { route },
  );
}

describe('Admin panel sign-in', () => {
  it('sends someone without an admin session from /admin to the admin sign-in', async () => {
    mockAdminApi();
    renderAdmin('/admin');
    expect(await screen.findByRole('heading', { name: 'Admin panel' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Telegram orqali admin sifatida kirish' })).toBeTruthy();
  });

  it('opens the bot with an admin link, takes the admin code and lands in the panel', async () => {
    const opened = vi.spyOn(window, 'open').mockReturnValue(null);
    mockAdminApi();
    renderAdmin('/admin/login');

    await userEvent.click(await screen.findByRole('button', { name: 'Telegram orqali admin sifatida kirish' }));
    expect(opened).toHaveBeenCalledWith('https://t.me/fintrack_bot?start=admin_abc', '_blank', 'noopener');

    await userEvent.type(await screen.findByLabelText('6 xonali kod'), '123456');
    expect(await screen.findByText('Statistika tez orada shu yerda bo‘ladi')).toBeTruthy();
    expect(screen.getByText('Aziz')).toBeTruthy();
  });
});

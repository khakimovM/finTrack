import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { AdminLoginPage } from './AdminLoginPage';
import { AdminOverviewPage } from './AdminOverviewPage';
import { AdminShell } from '../../features/admin/components/AdminShell';
import { renderWithProviders } from '../../test/render';
import { fail, ok, server } from '../../test/server';
import { adminSession, mockAdminPanel } from '../../test/adminFixtures';

const requestId = '00000000-0000-4000-8000-0000000ad111';

/** No admin session until the code is verified; the admin API answers 404 like an unknown URL. */
function mockSignIn() {
  let signedIn = false;
  mockAdminPanel();
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
        <Route index element={<AdminOverviewPage />} />
      </Route>
    </Routes>,
    { route },
  );
}

describe('Admin panel sign-in', () => {
  it('shows a visitor without an admin session the ordinary 404 page at /admin', async () => {
    sessionStorage.clear();
    mockSignIn();
    renderAdmin('/admin');
    expect(await screen.findByRole('heading', { name: 'Sahifa topilmadi' })).toBeTruthy();
    expect(screen.queryByText('Admin')).toBeNull();
  });

  it('opens the bot with an admin link, takes the admin code and lands in the panel', async () => {
    const opened = vi.spyOn(window, 'open').mockReturnValue(null);
    mockSignIn();
    renderAdmin('/admin/login');

    await userEvent.click(await screen.findByRole('button', { name: 'Telegram orqali admin sifatida kirish' }));
    expect(opened).toHaveBeenCalledWith('https://t.me/fintrack_bot?start=admin_abc', '_blank', 'noopener');

    await userEvent.type(await screen.findByLabelText('6 xonali kod'), '123456');
    expect(await screen.findByRole('heading', { name: 'Umumiy ko‘rinish' })).toBeTruthy();
    expect(screen.getByText('Aziz')).toBeTruthy();
  });

  it('sends the owner back to sign-in when the session ends while the panel is open', async () => {
    mockAdminPanel();
    const { queryClient } = renderAdmin('/admin');
    expect(await screen.findByRole('heading', { name: 'Umumiy ko‘rinish' })).toBeTruthy();

    // The session runs out: every admin endpoint now answers 404.
    server.use(
      http.get('*/api/v1/admin/auth/me', () => HttpResponse.json(fail('NOT_FOUND'), { status: 404 })),
      http.get('*/api/v1/admin/stats/overview', () => HttpResponse.json(fail('NOT_FOUND'), { status: 404 })),
    );
    await queryClient.refetchQueries({ queryKey: ['admin', 'stats', 'overview'] });

    expect(await screen.findByRole('button', { name: 'Telegram orqali admin sifatida kirish' })).toBeTruthy();
  });
});

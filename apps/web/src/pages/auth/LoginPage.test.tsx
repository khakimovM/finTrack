import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { LoginPage } from './LoginPage';
import { renderWithProviders } from '../../test/render';
import { fail, ok, server } from '../../test/server';
import { useAuthStore } from '../../stores/authStore';

const requestId = '00000000-0000-4000-8000-0000000109e1';
const user = { id: 'u1', name: 'Aziz', telegramUsername: 'aziz' };

function mockLogin(verifications: string[]) {
  server.use(
    http.post('*/api/v1/auth/telegram/start', () =>
      HttpResponse.json(
        ok({
          requestId,
          deepLink: 'https://t.me/fintrack_bot?start=login_abc',
          botUsername: 'fintrack_bot',
          expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
        }),
        { status: 201 },
      ),
    ),
    http.get(`*/api/v1/auth/telegram/status/${requestId}`, () =>
      HttpResponse.json(
        ok({ status: 'CODE_SENT', codeExpiresAt: new Date(Date.now() + 180_000).toISOString() }),
      ),
    ),
    http.post('*/api/v1/auth/telegram/verify', async ({ request }) => {
      const { code } = (await request.json()) as { code: string };
      verifications.push(code);
      if (code === '123456') return HttpResponse.json(ok({ user }));
      return HttpResponse.json(
        {
          success: false,
          error: { code: 'OTP_INVALID', message: 'Kod noto‘g‘ri', details: { attemptsLeft: 4 } },
        },
        { status: 400 },
      );
    }),
  );
}

function renderLogin() {
  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/app" element={<p>Bosh sahifa</p>} />
    </Routes>,
    { route: '/login' },
  );
}

describe('LoginPage (Telegram code)', () => {
  it('opens the bot, accepts the code it sent and lands on the dashboard', async () => {
    const opened = vi.spyOn(window, 'open').mockReturnValue(null);
    const verifications: string[] = [];
    mockLogin(verifications);
    renderLogin();

    await userEvent.click(screen.getByRole('button', { name: 'Telegram orqali kirish' }));
    expect(opened).toHaveBeenCalledWith(
      'https://t.me/fintrack_bot?start=login_abc',
      '_blank',
      'noopener',
    );

    await userEvent.type(await screen.findByLabelText('1-raqam'), '111111');
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Kod noto‘g‘ri. Yana 4 ta urinish qoldi',
    );

    await userEvent.type(screen.getByLabelText('1-raqam'), '123456');
    expect(await screen.findByText('Bosh sahifa')).toBeTruthy();
    expect(verifications).toEqual(['111111', '123456']);
    expect(useAuthStore.getState().user?.id).toBe('u1');
  });

  it('explains when Telegram sign-in is unavailable', async () => {
    server.use(
      http.post('*/api/v1/auth/telegram/start', () =>
        HttpResponse.json(fail('TELEGRAM_UNAVAILABLE'), { status: 503 }),
      ),
    );
    renderLogin();

    await userEvent.click(screen.getByRole('button', { name: 'Telegram orqali kirish' }));
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        'Telegram orqali kirish vaqtincha ishlamayapti',
      ),
    );
  });
});

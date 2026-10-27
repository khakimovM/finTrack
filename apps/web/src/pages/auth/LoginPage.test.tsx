import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { LoginPage } from './LoginPage';
import { renderWithProviders } from '../../test/render';
import { fail, ok, server } from '../../test/server';
import { useAuthStore } from '../../stores/authStore';
import { useLocaleStore } from '../../stores/localeStore';
import { inRussian, latinLeftovers } from '../../test/russian';
import { FinishedRow, WaitingSteps } from '../../features/auth/components/LoginStates';

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
  // No session: the page checks /auth/me first and stays on the login form.
  server.use(
    http.get('*/api/v1/auth/me', () => HttpResponse.json(fail('UNAUTHORIZED'), { status: 401 })),
    http.post('*/api/v1/auth/refresh', () => HttpResponse.json(fail('UNAUTHORIZED'), { status: 401 })),
  );
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

    await userEvent.type(await screen.findByLabelText('6 xonali kod'), '111111');
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Kod noto‘g‘ri. Yana 4 ta urinish qoldi',
    );

    await userEvent.type(screen.getByLabelText('6 xonali kod'), '123456');
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
      expect(screen.getByRole('alert').textContent).toContain(
        'Telegram orqali kirish vaqtincha ishlamayapti',
      ),
    );
  });
});

describe('LoginPage in Russian', () => {
  // The bot's handle from the mock and the switch back to Uzbek stay Latin.
  const latin = ['fintrack_bot', 'O‘zbekcha'];

  it('goes through the code flow without a word of Uzbek', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    mockLogin([]);
    inRussian();
    renderLogin();

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Вход в FinTrack');
    expect(latinLeftovers(latin)).toEqual([]);

    await userEvent.click(screen.getByRole('button', { name: 'Войти через Telegram' }));
    await userEvent.type(await screen.findByLabelText('6-значный код'), '111111');
    expect((await screen.findByRole('alert')).textContent).toBe('Неверный код. Осталось 4 попытки');
    expect(screen.getByText('Код отправлен в Telegram')).toBeTruthy();
    expect(latinLeftovers(latin)).toEqual([]);
  });

  it('writes the waiting steps and the finished request in Russian', () => {
    inRussian();
    const waiting = render(<WaitingSteps botUsername="fintrack_bot" deepLink="https://t.me/fintrack_bot" awaitingContact />);
    expect(waiting.container.querySelector('li')?.textContent).toBe('1В Telegram откроется @fintrack_bot.');
    expect(screen.getByText('Ждём, когда вы поделитесь номером…')).toBeTruthy();
    expect(latinLeftovers(latin, waiting.container)).toEqual([]);
    waiting.unmount();

    const finished = render(<FinishedRow cancelled={false} onRestart={() => {}} restarting={false} />);
    expect(screen.getByText('Время запроса истекло. Начните заново.')).toBeTruthy();
    expect(latinLeftovers([], finished.container)).toEqual([]);
  });

  it('offers Uzbek in the header and switches in place', async () => {
    // Like App: a new language draws the page again.
    function Keyed() {
      const locale = useLocaleStore((state) => state.locale);
      return <LoginPage key={locale} />;
    }
    server.use(
      http.get('*/api/v1/auth/me', () => HttpResponse.json(fail('UNAUTHORIZED'), { status: 401 })),
      http.post('*/api/v1/auth/refresh', () => HttpResponse.json(fail('UNAUTHORIZED'), { status: 401 })),
    );
    inRussian();
    renderWithProviders(<Keyed />, { route: '/login' });

    await userEvent.click(screen.getByRole('button', { name: 'O‘zbekcha' }));
    expect(useLocaleStore.getState().locale).toBe('uz');
    expect(document.documentElement.lang).toBe('uz');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('FinTrack’ga kirish');
    expect(screen.getByRole('button', { name: 'Русский' })).toBeTruthy();
    localStorage.clear();
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { adminMiniAppToken, forgetAdminMiniAppToken, isAdminMiniApp, isAdminPath, signInAdminMiniApp } from './adminMiniApp';
import type { TelegramWebApp } from './telegram';
import { api } from './api';
import { queryClient } from './queryClient';
import { queryKeys } from './queryKeys';
import { useMiniAppStore } from '../stores/miniAppStore';
import { MiniAppGate } from '../features/miniapp/MiniAppGate';
import { fail, ok, server } from '../test/server';

const session = { admin: { id: 'a1', name: 'Ega', telegramUsername: 'ega' }, expiresAt: '2026-10-16T20:00:00.000Z' };

/** Telegram's object for a launch from the bot's /admin button. */
function telegram(initData = 'signed-admin-launch'): TelegramWebApp {
  return { initData, colorScheme: 'dark', onEvent: vi.fn(), close: vi.fn() } as unknown as TelegramWebApp;
}

afterEach(() => {
  forgetAdminMiniAppToken();
  useMiniAppStore.getState().setStatus('off');
  queryClient.clear();
  window.history.replaceState(null, '', '/');
});

describe('isAdminPath', () => {
  it.each([
    ['/admin', true],
    ['/admin/users', true],
    ['/administrator', false],
    ['/app', false],
  ])('%s → %s', (path, expected) => {
    expect(isAdminPath(path)).toBe(expected);
  });
});

describe('the admin panel opened from the bot', () => {
  it('signs in with the launch data and sends its token to the admin API only', async () => {
    const seen: Record<string, string | null> = {};
    server.use(
      http.post('*/api/v1/admin/auth/telegram/webapp', async ({ request }) => {
        expect(await request.json()).toEqual({ initData: 'signed-admin-launch' });
        return HttpResponse.json(ok({ ...session, token: 'admin-token' }));
      }),
      http.get('*/api/v1/admin/auth/me', ({ request }) => {
        seen.admin = request.headers.get('X-Admin-Token');
        return HttpResponse.json(ok(session));
      }),
      http.get('*/api/v1/accounts', ({ request }) => {
        seen.user = request.headers.get('X-Admin-Token');
        return HttpResponse.json(ok([]));
      }),
    );

    await signInAdminMiniApp(telegram());

    expect(useMiniAppStore.getState().status).toBe('ready');
    expect(isAdminMiniApp()).toBe(true);
    expect(adminMiniAppToken()).toBe('admin-token');
    // The panel starts signed in, without asking the API who it is first.
    expect(queryClient.getQueryData(queryKeys.admin.session())).toEqual(session);

    await api.get('/admin/auth/me');
    await api.get('/accounts');
    expect(seen).toEqual({ admin: 'admin-token', user: null });
  });

  it('leaves a non-admin on the panel’s 404 page, as in a browser', async () => {
    server.use(http.post('*/api/v1/admin/auth/telegram/webapp', () => HttpResponse.json(fail('NOT_FOUND'), { status: 404 })));
    await signInAdminMiniApp(telegram());
    expect(useMiniAppStore.getState().status).toBe('ready');
    expect(adminMiniAppToken()).toBeNull();
  });

  it('asks to reopen the panel from the bot when the launch was already used or is too old', async () => {
    server.use(
      http.post('*/api/v1/admin/auth/telegram/webapp', () =>
        HttpResponse.json(fail('TELEGRAM_INIT_DATA_EXPIRED'), { status: 401 }),
      ),
    );
    await signInAdminMiniApp(telegram());
    expect(useMiniAppStore.getState().status).toBe('expired');

    window.history.replaceState(null, '', '/admin');
    render(<MiniAppGate status="expired" />);
    expect(screen.getByRole('heading', { name: 'Admin panelni qayta oching' })).toBeTruthy();
    expect(screen.getByText(/Botga \/admin yozing/)).toBeTruthy();
  });

  it('needs the launch data Telegram gives an inline button', async () => {
    await signInAdminMiniApp(telegram(''));
    expect(useMiniAppStore.getState().status).toBe('no-init-data');
  });
});

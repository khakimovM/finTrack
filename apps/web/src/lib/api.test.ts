import { afterEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { api } from './api';
import { queryClient } from './queryClient';
import { fail, server } from '../test/server';

function noSession() {
  server.use(
    http.get('*/api/v1/auth/me', () => HttpResponse.json(fail('UNAUTHORIZED'), { status: 401 })),
    http.post('*/api/v1/auth/refresh', () => HttpResponse.json(fail('UNAUTHORIZED'), { status: 401 })),
  );
}

describe('401 handling', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/');
    queryClient.clear();
  });

  it('keeps the cache on public pages when there is no session (the probe must not loop)', async () => {
    noSession();
    window.history.replaceState(null, '', '/login');
    queryClient.setQueryData(['auth', 'telegram-login', 'r1'], { status: 'CODE_SENT' });

    await expect(api.get('/auth/me')).rejects.toBeTruthy();

    expect(queryClient.getQueryData(['auth', 'telegram-login', 'r1'])).toEqual({ status: 'CODE_SENT' });
    expect(window.location.pathname).toBe('/login');
  });

  it('drops the cached data of the app when the session is gone', async () => {
    noSession();
    window.history.replaceState(null, '', '/app/transactions');
    queryClient.setQueryData(['transactions'], { data: [] });

    await expect(api.get('/auth/me')).rejects.toBeTruthy();

    expect(queryClient.getQueryData(['transactions'])).toBeUndefined();
  });
});

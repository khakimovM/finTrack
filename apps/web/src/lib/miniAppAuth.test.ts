import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { AxiosError, AxiosHeaders } from 'axios';
import {
  exchangeInitData,
  isMiniAppSession,
  miniAppAccessToken,
  miniAppStatusFor,
} from './miniAppAuth';
import { hasLaunchParams } from './telegram';
import { api } from './api';
import { fail, ok, server } from '../test/server';

const user = { id: 'u1', name: 'Aziz' };

function axiosErrorWith(code: string): AxiosError {
  const error = new AxiosError('failed');
  error.response = {
    data: fail(code),
    status: 403,
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
  };
  return error;
}

describe('hasLaunchParams', () => {
  it.each([
    ['#tgWebAppData=query_id%3D1&tgWebAppVersion=8.0', true],
    ['#foo=1&tgWebAppPlatform=ios', true],
    ['#/app/debts', false],
    ['', false],
  ])('%s → %s', (hash, expected) => {
    expect(hasLaunchParams(hash)).toBe(expected);
  });
});

describe('miniAppStatusFor', () => {
  it('maps the API codes to the screens that explain them', () => {
    expect(miniAppStatusFor(axiosErrorWith('TELEGRAM_NOT_REGISTERED'))).toBe('unregistered');
    expect(miniAppStatusFor(axiosErrorWith('ACCOUNT_BANNED'))).toBe('banned');
    expect(miniAppStatusFor(axiosErrorWith('TELEGRAM_INIT_DATA_EXPIRED'))).toBe('expired');
    expect(miniAppStatusFor(axiosErrorWith('TELEGRAM_INIT_DATA_INVALID'))).toBe('error');
    expect(miniAppStatusFor(new Error('network'))).toBe('error');
  });
});

describe('Mini App session', () => {
  it('exchanges initData once for parallel callers and renews the token on a 401', async () => {
    let exchanges = 0;
    const seenAuth: Array<string | null> = [];
    server.use(
      http.post('*/api/v1/auth/telegram/webapp', async ({ request }) => {
        exchanges += 1;
        expect(await request.json()).toEqual({ initData: 'signed-init-data' });
        return HttpResponse.json(
          ok({ user, accessToken: `token-${exchanges}`, accessTokenExpiresIn: 900 }),
        );
      }),
      http.get('*/api/v1/accounts', ({ request }) => {
        const auth = request.headers.get('authorization');
        seenAuth.push(auth);
        return auth === 'Bearer token-2'
          ? HttpResponse.json(ok([]))
          : HttpResponse.json(fail('UNAUTHENTICATED'), { status: 401 });
      }),
    );

    const [a, b] = await Promise.all([exchangeInitData('signed-init-data'), exchangeInitData()]);
    expect(exchanges).toBe(1);
    expect(a).toBe(b);
    expect(isMiniAppSession()).toBe(true);
    expect(miniAppAccessToken()).toBe('token-1');

    // token-1 is rejected: the client exchanges the same initData again and retries once.
    const res = await api.get('/accounts');
    expect(res.status).toBe(200);
    expect(seenAuth).toEqual(['Bearer token-1', 'Bearer token-2']);
    expect(exchanges).toBe(2);
  });
});

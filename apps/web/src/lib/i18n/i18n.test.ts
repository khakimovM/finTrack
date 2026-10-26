import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { api } from '../api';
import { apiErrorToMessage } from '../apiError';
import { fail, server } from '../../test/server';
import { useLocaleStore } from '../../stores/localeStore';
import { translate } from '.';

describe('translate', () => {
  it('looks the key up in the language and fills the placeholders', () => {
    expect(translate('uz', 'common.today')).toBe('Bugun');
    expect(translate('ru', 'common.today')).toBe('Сегодня');
    expect(translate('ru', 'language.title', { unused: 1 })).toBe('Язык');
  });
});

describe('requests and their errors', () => {
  it('asks the API for the user’s language, and Uzbek for the admin panel', async () => {
    const asked: Array<string | null> = [];
    server.use(
      http.get('*/api/v1/accounts', ({ request }) => {
        asked.push(request.headers.get('accept-language'));
        return HttpResponse.json(fail('INSUFFICIENT_BALANCE'), { status: 422 });
      }),
      http.get('*/api/v1/admin/system', ({ request }) => {
        asked.push(request.headers.get('accept-language'));
        return HttpResponse.json({ success: true, data: {} });
      }),
    );
    useLocaleStore.setState({ locale: 'ru' });

    const error = await api.get('/accounts').catch((e: unknown) => e);
    await api.get('/admin/system');

    expect(asked).toEqual(['ru', 'uz']);
    expect(apiErrorToMessage(error)).toBe('На счёте недостаточно средств');
    expect(apiErrorToMessage(null)).toBe('Произошла непредвиденная ошибка. Попробуйте ещё раз');
  });
});

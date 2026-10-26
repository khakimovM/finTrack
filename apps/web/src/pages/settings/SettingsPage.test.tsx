import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { SettingsPage } from './SettingsPage';
import { renderWithProviders } from '../../test/render';
import { ok, server } from '../../test/server';
import { user } from '../../test/fixtures';
import { useAuthStore } from '../../stores/authStore';
import { maskIp } from '../../features/settings/components/SecuritySections';
import { useLocaleStore } from '../../stores/localeStore';

const sessions = [
  { id: 's1', userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/130.0', ipAddress: '84.54.12.7', createdAt: '', lastUsedAt: '2026-10-05T09:00:00.000Z', expiresAt: '', isCurrent: true },
  { id: 's2', userAgent: 'Mozilla/5.0 (iPhone) Safari/604.1', ipAddress: '213.230.1.2', createdAt: '', lastUsedAt: '2026-10-01T09:05:00.000Z', expiresAt: '', isCurrent: false },
];

function serve() {
  const calls: { patches: unknown[]; deletes: unknown[]; revoked: string[] } = { patches: [], deletes: [], revoked: [] };
  server.use(
    http.get('*/api/v1/users/me/sessions', () => HttpResponse.json(ok(sessions))),
    http.delete('*/api/v1/users/me/sessions/:id', ({ params }) => {
      calls.revoked.push(String(params.id));
      return new HttpResponse(null, { status: 204 });
    }),
    http.patch('*/api/v1/users/me', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      calls.patches.push(body);
      return HttpResponse.json(ok({ user: { ...useAuthStore.getState().user, ...body } }));
    }),
    http.delete('*/api/v1/users/me', async ({ request }) => {
      calls.deletes.push(await request.json());
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return calls;
}

beforeEach(() => useAuthStore.setState({ user: user({ name: 'Aziz Karimov', telegramUsername: 'aziz_k' }) }));
afterEach(() => useAuthStore.setState({ user: null }));

describe('SettingsPage', () => {
  it('switches the language on this device; the account keeps Uzbek until Russian is ready', async () => {
    const calls = serve();
    renderWithProviders(<SettingsPage />);

    const languages = screen.getByRole('radiogroup', { name: 'Til' });
    expect(within(languages).getByRole('radio', { name: 'O‘zbekcha' }).getAttribute('aria-checked')).toBe('true');
    await userEvent.click(within(languages).getByRole('radio', { name: 'Русский' }));

    expect(useLocaleStore.getState().locale).toBe('ru');
    expect(document.documentElement.lang).toBe('ru');
    expect(await screen.findByRole('radiogroup', { name: 'Язык' })).toBeTruthy();
    expect(calls.patches).toEqual([]);
  });

  it('saves the profile only when it changed and is valid', async () => {
    const calls = serve();
    renderWithProviders(<SettingsPage />);

    const save = screen.getByRole('button', { name: 'Saqlash' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    const name = screen.getByLabelText('Ism');
    await userEvent.clear(name);
    await userEvent.type(name, 'A');
    expect(screen.getByRole('alert').textContent).toContain('Ism 2 dan 100 belgigacha bo‘lishi kerak');
    expect(save.disabled).toBe(true);

    await userEvent.type(name, 'ziz  ');
    await userEvent.click(save);
    await waitFor(() => expect(calls.patches).toEqual([{ name: 'Aziz', timezone: 'Asia/Tashkent' }]));
  });

  it('switches strict mode at once', async () => {
    const calls = serve();
    renderWithProviders(<SettingsPage />);

    await userEvent.click(screen.getByRole('switch', { name: 'Qatʼiy rejim' }));
    await waitFor(() => expect(calls.patches).toEqual([{ strictMode: true }]));
  });

  it('turns the 7:00 and 22:00 reminders and the monthly report off, and only with Telegram linked', async () => {
    const calls = serve();
    const { unmount } = renderWithProviders(<SettingsPage />);

    const reminders = screen.getByRole('switch', { name: 'Kunlik eslatmalar' }) as HTMLButtonElement;
    expect(reminders.getAttribute('aria-checked')).toBe('true');
    await userEvent.click(reminders);
    await waitFor(() => expect(calls.patches).toEqual([{ dailyReminders: false }]));
    await userEvent.click(screen.getByRole('switch', { name: 'Oylik hisobot' }));
    await waitFor(() => expect(calls.patches).toEqual([{ dailyReminders: false }, { monthlyReport: false }]));
    unmount();

    useAuthStore.setState({ user: user({ telegramLinked: false }) });
    renderWithProviders(<SettingsPage />);
    expect((screen.getByRole('switch', { name: 'Kunlik eslatmalar' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('lists sessions with a partly hidden IP and ends another device', async () => {
    const calls = serve();
    renderWithProviders(<SettingsPage />);

    const list = await screen.findByRole('region', { name: 'Faol sessiyalar' });
    expect(await within(list).findByText('IP 84.54.** · hozir faol')).toBeTruthy();
    expect(within(list).getByText('Safari, iOS')).toBeTruthy();
    await userEvent.click(within(list).getByRole('button', { name: 'Yakunlash' }));
    await waitFor(() => expect(calls.revoked).toEqual(['s2']));
  });

  it('deletes the account only after the phrase is typed and confirmed', async () => {
    const calls = serve();
    renderWithProviders(<SettingsPage />);

    const remove = screen.getByRole('button', { name: /Akkauntni butunlay o‘chirish/ }) as HTMLButtonElement;
    expect(remove.disabled).toBe(true);
    // A plain apostrophe from any keyboard is accepted.
    await userEvent.type(screen.getByLabelText(/Tasdiqlash uchun/), "o'chirish");
    expect(remove.disabled).toBe(false);

    await userEvent.click(remove);
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Butunlay o‘chirish' }));
    await waitFor(() => expect(calls.deletes).toEqual([{ confirm: 'O‘CHIRISH' }]));
  });
});

describe('maskIp', () => {
  it('keeps the network and hides the host', () => {
    expect(maskIp('84.54.12.7')).toBe('IP 84.54.**');
    expect(maskIp('::ffff:10.0.0.1')).toBe('IP 10.0.**');
    expect(maskIp('2001:db8:85a3::1')).toBe('IP 2001:db8:**');
    expect(maskIp(null)).toBe('IP nomaʼlum');
  });
});

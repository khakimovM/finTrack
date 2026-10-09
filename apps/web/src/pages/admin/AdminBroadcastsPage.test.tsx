import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import type { BroadcastResponse } from '@fintrack/shared';
import { AdminShell } from '../../features/admin/components/AdminShell';
import { AdminBroadcastsPage } from './AdminBroadcastsPage';
import { renderWithProviders } from '../../test/render';
import { fail, ok, server } from '../../test/server';
import { mockAdminPanel } from '../../test/adminFixtures';
import { useToastStore } from '../../stores/toastStore';

/** Toasts render at the app root, outside this page; read them from the store. */
async function toasted(text: string | RegExp) {
  await waitFor(() =>
    expect(useToastStore.getState().toasts.some((t) => (typeof text === 'string' ? t.message === text : text.test(t.message)))).toBe(true),
  );
}

function broadcast(over: Partial<BroadcastResponse> = {}): BroadcastResponse {
  return {
    id: '00000000-0000-4000-8000-0000000b0001',
    text: 'Yangi hisobotlar qo‘shildi',
    segment: 'ALL',
    includeOptedOut: false,
    status: 'DONE',
    total: 120,
    sent: 117,
    blocked: 2,
    failed: 1,
    pending: 0,
    admin: { id: 'a1', name: 'Aziz' },
    createdAt: '2026-10-08T09:00:00.000Z',
    startedAt: '2026-10-08T09:00:01.000Z',
    finishedAt: '2026-10-08T09:00:06.000Z',
    ...over,
  };
}

interface Seen {
  previews: Array<{ segment: string; includeOptedOut: boolean }>;
  tests: string[];
  created: unknown[];
}

function mockBroadcasts(list: BroadcastResponse[] = [], createAnswer?: () => Response) {
  const seen: Seen = { previews: [], tests: [], created: [] };
  mockAdminPanel();
  server.use(
    http.post('*/api/v1/admin/broadcasts/preview', async ({ request }) => {
      const body = (await request.json()) as { segment: string; includeOptedOut: boolean };
      seen.previews.push(body);
      const recipients = body.includeOptedOut ? 150 : 120;
      return HttpResponse.json(ok({ recipients, excluded: { botBlocked: 4, optedOut: body.includeOptedOut ? 0 : 30 } }));
    }),
    http.post('*/api/v1/admin/broadcasts/test', async ({ request }) => {
      seen.tests.push(((await request.json()) as { text: string }).text);
      return HttpResponse.json(ok({ delivered: true }));
    }),
    http.post('*/api/v1/admin/broadcasts', async ({ request }) => {
      seen.created.push(await request.json());
      return createAnswer?.() ?? HttpResponse.json(ok(broadcast({ status: 'QUEUED', sent: 0, blocked: 0, failed: 0, pending: 120 })), { status: 201 });
    }),
    http.get('*/api/v1/admin/broadcasts', () =>
      HttpResponse.json(ok(list, { page: 1, limit: 10, total: list.length, totalPages: 1 })),
    ),
  );
  return seen;
}

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/admin" element={<AdminShell />}>
        <Route path="broadcasts" element={<AdminBroadcastsPage />} />
      </Route>
    </Routes>,
    { route: '/admin/broadcasts' },
  );
}

describe('Admin broadcasts page', () => {
  beforeEach(() => useToastStore.setState({ toasts: [] }));

  it('sends only a tested text, after a confirmation that names the number of people', async () => {
    const seen = mockBroadcasts();
    renderPage();
    expect(await screen.findByText('kishiga boradi', { exact: false })).toBeTruthy();
    expect(screen.getByText(/4 kishi botni bloklagan, 30 kishi bildirishnomani o‘chirgan/)).toBeTruthy();

    await userEvent.type(screen.getByLabelText('Xabar matni'), 'Texnik ishlar soat 23:00 da');
    const send = screen.getByRole('button', { name: 'Yuborish' });
    expect(send.hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('Avval o‘zingizga test yuboring.')).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Menga test yuborish' }));
    expect(seen.tests).toEqual(['Texnik ishlar soat 23:00 da']);
    await toasted(/Test xabar botda/);

    await userEvent.click(screen.getByRole('button', { name: 'Yuborish' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('120 kishiga yuborilsinmi?')).toBeTruthy();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Yuborish' }));

    await toasted('Xabar navbatga qo‘yildi');
    expect(seen.created).toEqual([
      { text: 'Texnik ishlar soat 23:00 da', segment: 'ALL', includeOptedOut: false, expectedRecipients: 120 },
    ]);
  });

  it('asks for a new test when the text changes after it was tested', async () => {
    mockBroadcasts();
    renderPage();
    const field = await screen.findByLabelText('Xabar matni');
    await userEvent.type(field, 'Salom');
    await userEvent.click(screen.getByRole('button', { name: 'Menga test yuborish' }));
    await toasted(/Test xabar botda/);
    await userEvent.type(field, '!');
    expect(screen.getByText(/Matn test qilinganidan keyin o‘zgardi/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Yuborish' }).hasAttribute('disabled')).toBe(true);
  });

  it('counts people who switched notifications off only when they are included', async () => {
    const seen = mockBroadcasts();
    renderPage();
    await screen.findByText(/30 kishi bildirishnomani o‘chirgan/);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Bildirishnomalarni o‘chirganlarga ham yuborish' }));
    expect(await screen.findByText('150')).toBeTruthy();
    expect(seen.previews.at(-1)).toEqual({ segment: 'ALL', includeOptedOut: true });

    await userEvent.click(screen.getByRole('radio', { name: '30 kunda faol' }));
    expect(seen.previews.at(-1)).toEqual({ segment: 'ACTIVE_30D', includeOptedOut: true });
  });

  it('shows a changed count from the server instead of sending', async () => {
    mockBroadcasts([], () =>
      HttpResponse.json(fail('RECIPIENTS_CHANGED', 'Qabul qiluvchilar soni o‘zgardi: endi 121 kishi'), { status: 409 }),
    );
    renderPage();
    await userEvent.type(await screen.findByLabelText('Xabar matni'), 'Salom');
    await userEvent.click(screen.getByRole('button', { name: 'Menga test yuborish' }));
    await toasted(/Test xabar botda/);
    await userEvent.click(screen.getByRole('button', { name: 'Yuborish' }));
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Yuborish' }));
    await toasted(/endi 121 kishi/);
  });

  it('lists sent broadcasts with their results, and the one going out with its progress', async () => {
    mockBroadcasts([broadcast({ id: '00000000-0000-4000-8000-0000000b0002', status: 'SENDING', sent: 40, blocked: 1, failed: 0, pending: 79 }), broadcast()]);
    renderPage();
    expect(await screen.findByText('Yuborilmoqda')).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: '41 / 120' })).toBeTruthy();
    expect(screen.getByText('Tugadi')).toBeTruthy();
    expect(screen.getByText('Bot bloklangan: 2')).toBeTruthy();
    expect(screen.getByText('Oldingi xabar hali yuborilmoqda.')).toBeTruthy();
  });

  it('says so when nothing has been sent yet', async () => {
    mockBroadcasts();
    renderPage();
    expect(await screen.findByText('Hali xabar yuborilmagan')).toBeTruthy();
  });
});

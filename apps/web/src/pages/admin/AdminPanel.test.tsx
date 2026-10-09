import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { AdminShell } from '../../features/admin/components/AdminShell';
import { AdminOverviewPage } from './AdminOverviewPage';
import { AdminUsersPage } from './AdminUsersPage';
import { AdminSystemPage } from './AdminSystemPage';
import { AdminAuditPage } from './AdminAuditPage';
import { AdminUsagePage } from './AdminUsagePage';
import { renderWithProviders } from '../../test/render';
import { fail, ok, server } from '../../test/server';
import { setViewportWidth } from '../../test/viewport';
import { audit, mockAdminPanel, system, userDetail, userRow } from '../../test/adminFixtures';

function renderPanel(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/admin" element={<AdminShell />}>
        <Route index element={<AdminOverviewPage />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="usage" element={<AdminUsagePage />} />
        <Route path="system" element={<AdminSystemPage />} />
        <Route path="audit" element={<AdminAuditPage />} />
      </Route>
    </Routes>,
    { route },
  );
}

describe('Admin panel pages', () => {
  it('overview: counts, changes against the previous week, account states and the newest people', async () => {
    mockAdminPanel();
    renderPanel('/admin');
    expect(await screen.findByText('1 234')).toBeTruthy();
    expect(screen.getByText('7 kunda +21')).toBeTruthy();
    expect(screen.getByText('Botni bloklagan')).toBeTruthy();
    expect(await screen.findByRole('link', { name: /Zebo Karimova/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Umumiy' }).getAttribute('aria-current')).toBe('page');
  });

  it('users: a table on a laptop, cards on a phone, and only activity, never money', async () => {
    mockAdminPanel();
    const first = renderPanel('/admin/users');
    const table = await screen.findByRole('table', { name: 'Foydalanuvchilar' });
    expect(within(table).getByText('Zebo Karimova')).toBeTruthy();
    expect(within(table).getByText('+998 •• ••• •• 67')).toBeTruthy();
    expect(within(table).getByText('42')).toBeTruthy();
    first.unmount();

    setViewportWidth(390);
    renderPanel('/admin/users');
    expect(await screen.findByText(/42 yozuv · 2 hisob · Bot, Sayt/)).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('users: search and the status tab become the request, and an empty result says so', async () => {
    const seen: URLSearchParams[] = [];
    mockAdminPanel();
    server.use(
      http.get('*/api/v1/admin/users', ({ request }) => {
        const params = new URL(request.url).searchParams;
        seen.push(params);
        const rows = params.get('q') === 'yo‘q odam' ? [] : [userRow()];
        return HttpResponse.json(ok(rows, { page: 1, limit: 25, total: rows.length, totalPages: 1 }));
      }),
    );
    renderPanel('/admin/users');
    await screen.findByRole('table');

    await userEvent.click(screen.getByRole('tab', { name: 'Bloklangan' }));
    await userEvent.type(screen.getByLabelText('Foydalanuvchini qidirish'), 'yo‘q odam');
    expect(await screen.findByText('Hech kim topilmadi')).toBeTruthy();
    const last = seen[seen.length - 1];
    expect(last.get('q')).toBe('yo‘q odam');
    expect(last.get('status')).toBe('banned');
  });

  it('users: opens a person, bans them with a reason and shows the result', async () => {
    let banBody: unknown = null;
    mockAdminPanel();
    server.use(
      http.get('*/api/v1/admin/users/:id', () => HttpResponse.json(ok(userDetail()))),
      http.post('*/api/v1/admin/users/:id/ban', async ({ request }) => {
        banBody = await request.json();
        return HttpResponse.json(
          ok(userDetail({ status: 'banned', bannedAt: '2026-10-08T10:00:00.000Z', banReason: 'Spam yozuvlar' })),
        );
      }),
    );
    renderPanel('/admin/users');
    await userEvent.click(await screen.findByText('Zebo Karimova'));

    const dialog = await screen.findByRole('dialog', { name: 'Foydalanuvchi' });
    expect(within(dialog).getByText('O‘z kategoriyalari')).toBeTruthy();
    expect(within(dialog).getByRole('img', { name: 'So‘nggi 90 kundan 2 kunida faol' })).toBeTruthy();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Bloklash' }));
    const form = await screen.findByRole('dialog', { name: 'Foydalanuvchini bloklash' });
    await userEvent.click(within(form).getByRole('button', { name: 'Bloklash' }));
    expect(await within(form).findByText('Sababni 3 belgidan uzunroq yozing')).toBeTruthy();

    await userEvent.type(within(form).getByLabelText('Sabab'), 'Spam yozuvlar');
    await userEvent.click(within(form).getByRole('button', { name: 'Bloklash' }));
    expect(await screen.findByText('Sabab: Spam yozuvlar')).toBeTruthy();
    expect(banBody).toEqual({ reason: 'Spam yozuvlar' });
    expect(screen.getByRole('button', { name: 'Blokdan chiqarish' })).toBeTruthy();
  });

  it('users: a card opened while the search is still settling stays open', async () => {
    mockAdminPanel();
    server.use(http.get('*/api/v1/admin/users/:id', () => HttpResponse.json(ok(userDetail()))));
    renderPanel('/admin/users');
    await screen.findByRole('table');

    await userEvent.type(screen.getByLabelText('Foydalanuvchini qidirish'), 'zebo');
    await userEvent.click(screen.getByText('Zebo Karimova'));
    await screen.findByRole('dialog', { name: 'Foydalanuvchi' });
    // Past the 300 ms debounce: the search lands in the URL without closing the card.
    await new Promise((resolve) => setTimeout(resolve, 450));
    expect(screen.getByRole('dialog', { name: 'Foydalanuvchi' })).toBeTruthy();
  });

  it('users: an admin cannot be banned from the panel', async () => {
    mockAdminPanel();
    server.use(http.get('*/api/v1/admin/users/:id', () => HttpResponse.json(ok(userDetail({ isAdmin: true })))));
    renderPanel(`/admin/users?open=${userRow().id}`);
    const dialog = await screen.findByRole('dialog', { name: 'Foydalanuvchi' });
    expect(await within(dialog).findByText(/Admin hisobini bloklab/)).toBeTruthy();
    expect(within(dialog).queryByRole('button', { name: 'Bloklash' })).toBeNull();
  });

  it('users: a failed load shows its own error with a retry', async () => {
    mockAdminPanel();
    server.use(http.get('*/api/v1/admin/users', () => HttpResponse.json(fail('INTERNAL_ERROR'), { status: 500 })));
    renderPanel('/admin/users');
    expect(await screen.findByText('Ro‘yxatni yuklab bo‘lmadi')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Qayta urinish/ })).toBeTruthy();
  });

  it('usage: channels, sources, features and the assistant providers', async () => {
    mockAdminPanel();
    renderPanel('/admin/usage');
    expect(await screen.findByText('Ovozli xabar')).toBeTruthy();
    expect(screen.getByText('2 va undan ko‘p hisob')).toBeTruthy();
    expect(screen.getByText(/Limit: 5 · Ishlamadi: 1/)).toBeTruthy();
  });

  it('system: dependencies, the running build and queue failures', async () => {
    mockAdminPanel();
    server.use(http.get('*/api/v1/admin/system', () => HttpResponse.json(ok(system))));
    renderPanel('/admin/system');
    expect(await screen.findByText('bc5adfd')).toBeTruthy();
    expect(screen.getByText('50 MB')).toBeTruthy();
    expect(screen.getByText('Forbidden: bot was blocked')).toBeTruthy();
    expect(screen.getByText('O‘qib bo‘lmadi')).toBeTruthy();
  });

  it('audit: who did what to whom, and refused sign-ins', async () => {
    mockAdminPanel();
    server.use(http.get('*/api/v1/admin/audit', () => HttpResponse.json(ok(audit.data, audit.meta))));
    renderPanel('/admin/audit');
    expect(await screen.findByText('Sabab: Spam · 2 sessiya tugatildi')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Zebo Karimova' }).getAttribute('href')).toBe(`/admin/users?open=${userRow().id}`);
    expect(screen.getByText('Telegram ID 700000001, @begona — admin ro‘yxatida yo‘q')).toBeTruthy();
  });
});

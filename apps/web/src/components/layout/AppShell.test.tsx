import { afterEach, describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { AppShell } from './AppShell';
import { PageHeader } from './PageHeader';
import { renderWithProviders } from '../../test/render';
import { inRussian, latinLeftovers } from '../../test/russian';
import { ok, server } from '../../test/server';
import { setViewportWidth } from '../../test/viewport';
import { user } from '../../test/fixtures';
import { useAuthStore } from '../../stores/authStore';

function renderShell() {
  server.use(
    http.get('*/api/v1/notifications', () =>
      HttpResponse.json({ success: true, data: [], meta: { page: 1, limit: 30, total: 0, totalPages: 1, unreadCount: 0 } }),
    ),
    http.get('*/api/v1/accounts', () => HttpResponse.json(ok([], { totalBalance: '0' }))),
    http.get('*/api/v1/categories', () => HttpResponse.json(ok([]))),
  );
  useAuthStore.setState({ user: user({ name: 'Aziz Karimov' }) });
  renderWithProviders(
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/app" element={<PageHeader title="Главная" quickAdd />} />
      </Route>
    </Routes>,
    { route: '/app' },
  );
}

afterEach(() => {
  setViewportWidth(1280);
  useAuthStore.setState({ user: null });
});

describe('AppShell in Russian', () => {
  it('leaves no Uzbek in the sidebar and the header', async () => {
    inRussian();
    renderShell();

    expect(await screen.findByRole('link', { name: /Операции/ })).toBeTruthy();
    expect(latinLeftovers(['Aziz Karimov', 'aziz', 'AK', 'A'])).toEqual([]);
  });

  it('leaves no Uzbek in the phone tab bar and its “more” sheet', async () => {
    setViewportWidth(390);
    inRussian();
    renderShell();

    await userEvent.click(await screen.findByRole('button', { name: /Ещё/ }));
    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(latinLeftovers(['Aziz Karimov', 'aziz', 'AK', 'A'])).toEqual([]);
  });
});

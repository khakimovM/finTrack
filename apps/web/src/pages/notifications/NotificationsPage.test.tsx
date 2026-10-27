import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { NotificationResponse } from '@fintrack/shared';
import { NotificationsPage } from './NotificationsPage';
import { renderWithProviders } from '../../test/render';
import { inRussian, latinLeftovers } from '../../test/russian';
import { server } from '../../test/server';
import { uuid } from '../../test/fixtures';

const now = new Date().toISOString();
const notifications: NotificationResponse[] = [
  { id: uuid(), type: 'BUDGET_WARNING', title: 'Бюджет почти исчерпан', body: 'Потрачено 85% лимита', meta: null, readAt: null, createdAt: now },
  { id: uuid(), type: 'DEBT_OVERDUE', title: 'Долг просрочен', body: 'Срок прошёл', meta: null, readAt: now, createdAt: '2026-09-01T09:00:00.000Z' },
];

describe('NotificationsPage in Russian', () => {
  it('leaves no Uzbek in the groups, the tabs and the links', async () => {
    server.use(
      http.get('*/api/v1/notifications', () =>
        HttpResponse.json({ success: true, data: notifications, meta: { page: 1, limit: 30, total: 2, totalPages: 1, unreadCount: 1 } }),
      ),
    );
    inRussian();
    renderWithProviders(<NotificationsPage />, { route: '/app/notifications' });

    expect(await screen.findByText('Бюджет почти исчерпан')).toBeTruthy();
    expect(screen.getByText('Сегодня')).toBeTruthy();
    expect(screen.getByText('1 непрочитанное')).toBeTruthy();
    expect(screen.getByText('Открыть бюджет')).toBeTruthy();
    expect(latinLeftovers()).toEqual([]);
  });
});

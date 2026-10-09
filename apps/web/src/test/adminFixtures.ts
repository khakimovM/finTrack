import { http, HttpResponse } from 'msw';
import type {
  AdminAuditResponse,
  AdminOverviewResponse,
  AdminSystemResponse,
  AdminUsageResponse,
  AdminUserDetail,
  AdminUserRow,
} from '@fintrack/shared';
import { fail, ok, server } from './server';

export const adminSession = {
  admin: { id: '00000000-0000-4000-8000-0000000000a1', name: 'Aziz', telegramUsername: 'aziz' },
  expiresAt: '2026-10-08T17:00:00.000Z',
};

export const overview: AdminOverviewResponse = {
  today: '2026-10-08',
  users: {
    total: 1234,
    newToday: 3,
    new7d: { current: 21, previous: 14 },
    new30d: { current: 80, previous: 64 },
    activeToday: 57,
    active7d: { current: 160, previous: 151 },
    active30d: { current: 260, previous: 240 },
    botBlocked: 9,
    banned: 1,
    deleted: 4,
  },
  entries: { total: 18250, today: 140, last7d: { current: 1010, previous: 960 } },
};

export const usage: AdminUsageResponse = {
  from: '2026-09-09',
  to: '2026-10-08',
  activeUsers: { total: 260, web: 120, miniApp: 90, bot: 150, unknown: 0 },
  entries: { total: 4200, web: 1500, miniApp: 900, bot: 1300, voice: 300, recurring: 200, unknown: 0 },
  features: {
    users: 1230,
    withDebt: 310,
    withBudget: 120,
    withRecurring: 95,
    withTag: 60,
    withSeveralAccounts: 400,
    withOwnCategory: 210,
    strictMode: 30,
    dailyDigest: 140,
    telegramNotifications: 900,
  },
  assistant: {
    voice: { ok: 300, limit: 4, unavailable: 1 },
    text: { ok: 80, limit: 0, unavailable: 0 },
    providers: [
      { name: 'gemini', ok: 350, failed: 6, failures: { rate_limited: 5, unavailable: 1, rejected: 0, bad_output: 0 } },
      { name: 'groq', ok: 30, failed: 0, failures: { rate_limited: 0, unavailable: 0, rejected: 0, bad_output: 0 } },
    ],
  },
};

export function userRow(over: Partial<AdminUserRow> = {}): AdminUserRow {
  return {
    id: '00000000-0000-4000-8000-000000000101',
    name: 'Zebo Karimova',
    telegramUsername: 'zebo',
    phone: '+998 •• ••• •• 67',
    createdAt: '2026-10-01T06:00:00.000Z',
    lastSeenAt: '2026-10-08T09:30:00.000Z',
    entries: 42,
    accounts: 2,
    channels: ['BOT', 'WEB'],
    status: 'active',
    botBlocked: false,
    ...over,
  };
}

export function userDetail(over: Partial<AdminUserDetail['user']> = {}): AdminUserDetail {
  return {
    user: { ...userRow(), bannedAt: null, banReason: null, deletedAt: null, isAdmin: false, ...over },
    counts: { entries: 42, accounts: 2, categories: 3, debts: 1, budgets: 0, recurring: 1, tags: 2, activeSessions: 2 },
    entriesBySource: { web: 30, miniApp: 0, bot: 10, voice: 2, recurring: 0, unknown: 0 },
    activity: [
      { day: '2026-10-07', channels: ['WEB'] },
      { day: '2026-10-08', channels: ['BOT', 'WEB'] },
    ],
  };
}

export const system: AdminSystemResponse = {
  version: { commit: 'bc5adfd', node: 'v20.18.0', environment: 'production', startedAt: '2026-10-08T03:00:00.000Z', uptimeSeconds: 93_600 },
  database: { status: 'ok', latencyMs: 3, sizeBytes: 52_428_800, lastMigration: '0007_admin_stats_indexes' },
  redis: { status: 'ok', latencyMs: 1, usedMemoryBytes: 2_097_152 },
  queues: [
    {
      name: 'telegram-outbox',
      counts: { waiting: 0, active: 0, delayed: 2, failed: 1, completed: 340, paused: false },
      recentFailures: [{ job: 'deliver-notification', failedAt: '2026-10-08T08:00:00.000Z', attempts: 6, reason: 'Forbidden: bot was blocked' }],
    },
    { name: 'daily-digest', counts: null, recentFailures: [] },
  ],
  telegram: { mode: 'webhook', webhookHost: 'fintrackuz.up.railway.app', pendingUpdates: 0, lastErrorAt: null, lastError: null },
};

export const audit: AdminAuditResponse = {
  data: [
    {
      id: 'a1',
      action: 'BAN',
      createdAt: '2026-10-08T09:00:00.000Z',
      admin: { id: adminSession.admin.id, name: 'Aziz' },
      target: { id: userRow().id, name: 'Zebo Karimova' },
      telegramId: null,
      meta: { reason: 'Spam', sessions: 2 },
      ipAddress: '10.0.0.1',
    },
    {
      id: 'a2',
      action: 'LOGIN_DENIED',
      createdAt: '2026-10-08T08:00:00.000Z',
      admin: null,
      target: null,
      telegramId: '700000001',
      meta: { reason: 'not_admin', username: 'begona' },
      ipAddress: null,
    },
  ],
  meta: { page: 1, limit: 50, total: 2, totalPages: 1 },
};

const emptyGrowth = (groupBy: string) => ({ groupBy, points: [] });

/** A signed-in admin and every statistics endpoint answering with the fixtures above. */
export function mockAdminPanel({ signedIn = true }: { signedIn?: boolean } = {}) {
  server.use(
    http.get('*/api/v1/admin/auth/me', () =>
      signedIn ? HttpResponse.json(ok(adminSession)) : HttpResponse.json(fail('NOT_FOUND'), { status: 404 }),
    ),
    http.get('*/api/v1/admin/stats/overview', () => HttpResponse.json(ok(overview))),
    http.get('*/api/v1/admin/stats/usage', () => HttpResponse.json(ok(usage))),
    http.get('*/api/v1/admin/stats/growth', ({ request }) => {
      const groupBy = new URL(request.url).searchParams.get('groupBy') ?? 'day';
      return HttpResponse.json(
        ok({
          ...emptyGrowth(groupBy),
          points: [
            { bucket: '2026-10-07', newUsers: 2, registeredUsers: 1231, activeUsers: 50, entries: 130 },
            { bucket: '2026-10-08', newUsers: 3, registeredUsers: 1234, activeUsers: 57, entries: 140 },
          ],
        }),
      );
    }),
    http.get('*/api/v1/admin/users', () =>
      HttpResponse.json(ok([userRow()], { page: 1, limit: 25, total: 1, totalPages: 1 })),
    ),
  );
}

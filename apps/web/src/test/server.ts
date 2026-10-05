import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

/**
 * Shared MSW server: tests register their API responses with `server.use(...)`. Every page has
 * the notification bell in its header, so an empty inbox is answered unless a test says otherwise.
 */
export const server = setupServer(
  http.get('*/api/v1/notifications', () =>
    HttpResponse.json({ success: true, data: [], meta: { page: 1, limit: 30, total: 0, totalPages: 0, unreadCount: 0 } }),
  ),
);

/** The API's success envelope. */
export function ok<T>(data: T, meta?: unknown) {
  return meta === undefined ? { success: true, data } : { success: true, data, meta };
}

/** The API's error envelope. */
export function fail(code: string, message = code) {
  return { success: false, error: { code, message } };
}

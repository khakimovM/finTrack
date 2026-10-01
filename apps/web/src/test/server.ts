import { setupServer } from 'msw/node';

/** Shared MSW server: tests register their API responses with `server.use(...)`. */
export const server = setupServer();

/** The API's success envelope. */
export function ok<T>(data: T, meta?: unknown) {
  return meta === undefined ? { success: true, data } : { success: true, data, meta };
}

/** The API's error envelope. */
export function fail(code: string, message = code) {
  return { success: false, error: { code, message } };
}

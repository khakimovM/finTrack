import { createHmac } from 'crypto';
import { FakeTgUser } from './fake-telegram';

/** Builds `Telegram.WebApp.initData` for a user, signed with the e2e bot token like Telegram would. */
export function signedInitData(user: FakeTgUser, options: { authDate?: number; queryId?: string } = {}): string {
  const token = process.env.TELEGRAM_BOT_TOKEN ?? '';
  const fields: Record<string, string> = {
    auth_date: String(options.authDate ?? Math.floor(Date.now() / 1000)),
    query_id: options.queryId ?? `q${Math.random().toString(36).slice(2)}`,
    user: JSON.stringify({ id: user.id, first_name: user.first_name, username: user.username, language_code: 'uz' }),
  };
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  const lines = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join('\n');
  const hash = createHmac('sha256', secret).update(lines).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}

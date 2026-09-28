import { createHmac } from 'node:crypto';
import { API_URL, E2E, MOCK_TELEGRAM_URL } from './env';

export interface TelegramUser {
  id: number;
  first_name: string;
  username: string;
}

let updateId = Math.floor(Math.random() * 1_000_000);

/** A Telegram identity nobody else uses (the test database keeps users between runs). */
export function newTelegramUser(firstName = 'Playwright'): TelegramUser {
  const id = 1_000_000_000 + Math.floor(Math.random() * 900_000_000);
  return { id, first_name: firstName, username: `pw${id}` };
}

function message(user: TelegramUser, fields: Record<string, unknown>) {
  updateId += 1;
  return {
    update_id: updateId,
    message: {
      message_id: updateId,
      date: Math.floor(Date.now() / 1000),
      chat: { id: user.id, type: 'private', first_name: user.first_name },
      from: { ...user, is_bot: false, language_code: 'uz' },
      ...fields,
    },
  };
}

/** Delivers an update exactly as Telegram's webhook would. */
export async function deliver(update: object): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1/telegram/webhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': E2E.webhookSecret },
    body: JSON.stringify(update),
  });
  if (res.status !== 200) throw new Error(`webhook answered ${res.status}`);
}

export const startCommand = (user: TelegramUser, payload: string) =>
  message(user, {
    text: `/start ${payload}`,
    entities: [{ type: 'bot_command', offset: 0, length: 6 }],
  });

export const sharedContact = (user: TelegramUser) =>
  message(user, {
    contact: { phone_number: `99890${String(user.id).slice(-7)}`, first_name: user.first_name, user_id: user.id },
  });

/** Waits for the one-time code the bot sent to this user through the mock Bot API. */
export async function waitForCode(user: TelegramUser, timeoutMs = 10_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${MOCK_TELEGRAM_URL}/__messages?chat_id=${user.id}`);
    const texts = (await res.json()) as string[];
    const code = texts
      .map((t) => /<code>(\d{6})<\/code>/.exec(t)?.[1])
      .filter(Boolean)
      .pop();
    if (code) return code;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`no login code reached ${user.id}`);
}

/** `Telegram.WebApp.initData` for a user, signed with the e2e bot token like Telegram would. */
export function signedInitData(user: TelegramUser): string {
  const fields: Record<string, string> = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: `pw${Date.now()}`,
    user: JSON.stringify({ id: user.id, first_name: user.first_name, username: user.username }),
  };
  const secret = createHmac('sha256', 'WebAppData').update(E2E.botToken).digest();
  const lines = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join('\n');
  const hash = createHmac('sha256', secret).update(lines).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}

/**
 * Stand-in for telegram-web-app.js (tests must not depend on telegram.org): exposes the
 * launch data from the URL fragment and records Back button state.
 */
export const TELEGRAM_SCRIPT_STUB = `
(() => {
  const params = new URLSearchParams(location.hash.slice(1));
  const theme = JSON.parse(params.get('tgWebAppThemeParams') || '{}');
  const handlers = [];
  const backButton = { isVisible: false, show() { this.isVisible = true; }, hide() { this.isVisible = false; },
    onClick(cb) { handlers.push(cb); }, offClick(cb) { const i = handlers.indexOf(cb); if (i >= 0) handlers.splice(i, 1); } };
  window.Telegram = { WebApp: {
    initData: params.get('tgWebAppData') || '', version: '8.0', platform: 'android',
    colorScheme: theme.bg_color === '#ffffff' ? 'light' : 'dark', themeParams: theme,
    ready() {}, expand() {}, close() {}, disableVerticalSwipes() {}, onEvent() {},
    isVersionAtLeast() { return true; }, BackButton: backButton,
    __pressBack() { handlers.forEach((cb) => cb()); },
  } };
})();
`;

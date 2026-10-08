/**
 * Fixed values of the browser e2e stack (see start-stack.ts). The bot token is fake: every Bot
 * API call goes to the mock Telegram server, never to Telegram.
 */
export const E2E = {
  apiPort: 5010,
  telegramPort: 5099,
  botToken: '123456789:AAFakeTokenForPlaywrightOnly_abcdefghi',
  botUsername: 'fintrack_e2e_bot',
  webhookSecret: 'playwright_webhook_secret_that_is_long_enough',
  /** ADMIN_TELEGRAM_IDS of the stack; below the ids newTelegramUser hands out (1e9+). */
  adminTelegramId: 200_000_002,
};

export const API_URL = `http://localhost:${E2E.apiPort}`;
export const MOCK_TELEGRAM_URL = `http://127.0.0.1:${E2E.telegramPort}`;

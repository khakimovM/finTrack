/** The bot the landing page links to; VITE_TELEGRAM_BOT_USERNAME overrides it outside production. */
export const BOT_USERNAME: string = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'fintrack_cwa_bot';
export const BOT_URL = `https://t.me/${BOT_USERNAME}`;

import { TestApp } from './app';
import { ApiClient } from './api-client';
import { FakeTgUser, contactUpdate, textUpdate } from './fake-telegram';
import { RedisService } from '../../src/infra/redis/redis.service';
import { ADMIN_STATS_CACHE_PREFIX } from '../../src/modules/admin/stats/admin-stats.service';

/** The admin id set in test-env.ts (ADMIN_TELEGRAM_IDS). */
export const OWNER: FakeTgUser = { id: 100_000_001, first_name: 'Ega', username: 'fintrack_owner' };

/** The owner is an ordinary bot user first, like in production; a no-op when already registered. */
export async function registerOwner(ctx: TestApp): Promise<void> {
  await ctx.deliver(textUpdate(OWNER, '/start'));
  await ctx.deliver(contactUpdate(OWNER, OWNER.id, '998901000001'));
}

/** A browser signed into the admin panel with the bot's admin code. */
export async function signInAsAdmin(ctx: TestApp): Promise<ApiClient> {
  const browser = new ApiClient(ctx);
  const start = await browser.post('/admin/auth/telegram/start');
  if (start.status !== 201) throw new Error(`admin start failed: ${start.status}`);
  await ctx.deliver(textUpdate(OWNER, `/start ${String(start.body.data.deepLink).split('start=')[1]}`));
  const verify = await browser.post('/admin/auth/telegram/verify', {
    requestId: start.body.data.requestId,
    code: ctx.telegram.lastCode(OWNER.id),
  });
  if (verify.status !== 200) throw new Error(`admin verify failed: ${verify.status} ${JSON.stringify(verify.body)}`);
  return browser;
}

/** Statistics are cached for a minute; tests that change data read them fresh. */
export async function forgetAdminStats(ctx: TestApp): Promise<void> {
  await ctx.app.get(RedisService).delPattern(`${ADMIN_STATS_CACHE_PREFIX}*`);
}

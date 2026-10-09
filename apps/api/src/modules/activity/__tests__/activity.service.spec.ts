import { ConfigService } from '@nestjs/config';
import { ActivityService } from '../activity.service';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { RedisService } from '../../../infra/redis/redis.service';
import { ClockService } from '../../../infra/clock/clock.service';

/** SET NX with expiry, enough for the throttle keys; `now` is moved by the test. */
function setup() {
  let now = new Date('2026-10-08T05:00:00Z'); // 10:00 in Tashkent
  const keys = new Map<string, number>();
  const redis = {
    setIfAbsent: jest.fn(async (key: string, _value: string, ttl: number) => {
      const until = keys.get(key);
      if (until !== undefined && until > now.getTime()) return false;
      keys.set(key, now.getTime() + ttl * 1000);
      return true;
    }),
    del: jest.fn(async (key: string) => (keys.delete(key) ? 1 : 0)),
  };
  const prisma = {
    user: { update: jest.fn(), findUnique: jest.fn() },
    userActivityDay: { upsert: jest.fn() },
  };
  const clock = {
    now: () => now,
    todayIn: (tz: string) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now),
  };
  const service = new ActivityService(
    prisma as unknown as PrismaService,
    redis as unknown as RedisService,
    clock as unknown as ClockService,
    { get: () => 'Asia/Tashkent' } as unknown as ConfigService,
  );
  return {
    service,
    prisma,
    advanceMinutes: (minutes: number) => {
      now = new Date(now.getTime() + minutes * 60_000);
    },
  };
}

describe('ActivityService', () => {
  it('writes one activity row however many requests a user makes in a day', async () => {
    const t = setup();
    for (let i = 0; i < 100; i++) await t.service.touch('u1', 'WEB');

    expect(t.prisma.userActivityDay.upsert).toHaveBeenCalledTimes(1);
    expect(t.prisma.userActivityDay.upsert.mock.calls[0][0].create).toEqual({
      userId: 'u1',
      day: new Date('2026-10-08T00:00:00Z'),
      channel: 'WEB',
    });
    // And `lastSeenAt` once, not a hundred times.
    expect(t.prisma.user.update).toHaveBeenCalledTimes(1);
  });

  it('records each channel of the day, and the next day again', async () => {
    const t = setup();
    await t.service.touch('u1', 'WEB');
    await t.service.touch('u1', 'MINIAPP');
    await t.service.touch('u1', 'WEB');
    expect(t.prisma.userActivityDay.upsert).toHaveBeenCalledTimes(2);

    t.advanceMinutes(24 * 60);
    await t.service.touch('u1', 'WEB');
    expect(t.prisma.userActivityDay.upsert).toHaveBeenCalledTimes(3);
    expect(t.prisma.userActivityDay.upsert.mock.calls[2][0].create.day).toEqual(new Date('2026-10-09T00:00:00Z'));
  });

  it('keeps lastSeenAt within five minutes of the latest request', async () => {
    const t = setup();
    await t.service.touch('u1', 'WEB');
    t.advanceMinutes(3);
    await t.service.touch('u1', 'WEB');
    expect(t.prisma.user.update).toHaveBeenCalledTimes(1);
    t.advanceMinutes(3);
    await t.service.touch('u1', 'WEB');
    expect(t.prisma.user.update).toHaveBeenCalledTimes(2);
  });

  it('looks a bot user up at most once per few minutes and skips strangers', async () => {
    const t = setup();
    t.prisma.user.findUnique.mockResolvedValue({ id: 'u1', deletedAt: null });
    for (let i = 0; i < 20; i++) await t.service.touchTelegram(777n);
    expect(t.prisma.user.findUnique).toHaveBeenCalledTimes(1);
    expect(t.prisma.userActivityDay.upsert.mock.calls[0][0].create.channel).toBe('BOT');

    t.prisma.user.findUnique.mockResolvedValue(null);
    await t.service.touchTelegram(888n);
    expect(t.prisma.userActivityDay.upsert).toHaveBeenCalledTimes(1);
  });

  it('counts a new user from the very message that registers them', async () => {
    const t = setup();
    t.prisma.user.findUnique.mockResolvedValueOnce(null); // /start: not registered yet
    await t.service.touchTelegram(999n);
    t.prisma.user.findUnique.mockResolvedValueOnce({ id: 'new', deletedAt: null }); // the shared contact
    await t.service.touchTelegram(999n);
    expect(t.prisma.userActivityDay.upsert).toHaveBeenCalledTimes(1);
    expect(t.prisma.userActivityDay.upsert.mock.calls[0][0].create.userId).toBe('new');
  });

  it('never lets a database error reach the request', async () => {
    const t = setup();
    t.prisma.user.update.mockRejectedValue(new Error('db down'));
    await expect(t.service.touch('u1', 'WEB')).resolves.toBeUndefined();
  });
});

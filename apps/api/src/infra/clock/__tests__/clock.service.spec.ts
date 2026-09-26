import { ConfigService } from '@nestjs/config';
import { ClockService } from '../clock.service';
import { PrismaService } from '../../prisma/prisma.service';
import { FutureDateException } from '../../../common/exceptions/domain.exception';

describe('ClockService', () => {
  const prisma = { user: { findFirst: jest.fn() } };
  const config = { get: jest.fn().mockReturnValue('Asia/Tashkent') };
  let clock: ClockService;

  beforeEach(() => {
    jest.clearAllMocks();
    clock = new ClockService(prisma as unknown as PrismaService, config as unknown as ConfigService);
    // 02:30 in Tashkent on 2026-09-27, still the 26th in UTC.
    jest.spyOn(clock, 'now').mockReturnValue(new Date('2026-09-26T21:30:00.000Z'));
  });

  it('resolves today in the user time zone', async () => {
    prisma.user.findFirst.mockResolvedValue({ timezone: 'Asia/Tashkent' });
    await expect(clock.todayFor('u1')).resolves.toBe('2026-09-27');
  });

  it('falls back to APP_TIMEZONE for unknown users', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(clock.todayFor('u1')).resolves.toBe('2026-09-27');
  });

  it('falls back to the default zone when the stored zone is invalid', () => {
    expect(clock.todayIn('Mars/Olympus')).toBe('2026-09-27');
  });

  it('accepts today and rejects tomorrow', async () => {
    prisma.user.findFirst.mockResolvedValue({ timezone: 'Asia/Tashkent' });
    await expect(clock.assertNotFuture('u1', '2026-09-27')).resolves.toBeUndefined();
    await expect(clock.assertNotFuture('u1', '2026-09-28')).rejects.toBeInstanceOf(FutureDateException);
  });
});

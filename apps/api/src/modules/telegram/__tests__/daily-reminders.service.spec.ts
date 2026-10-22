import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';
import { parseIsoDate } from '@fintrack/shared';
import { DailyRemindersService } from '../outbox/daily-reminders.service';
import { UsersRepository } from '../../users/users.repository';
import { SendResult, TelegramBotService } from '../../../infra/telegram/telegram-bot.service';
import { RedisService } from '../../../infra/redis/redis.service';
import { ClockService } from '../../../infra/clock/clock.service';

const person = (id: string, telegramId: bigint | null, name = 'Aziz'): User =>
  ({ id, telegramId, name }) as unknown as User;

function setup(recipients: User[], answers: Record<string, SendResult | Error> = {}) {
  const keys = new Set<string>();
  const findReminderRecipients = jest.fn(async () => recipients);
  const send = jest.fn(async (chatId: bigint, _text: string, _options?: unknown) => {
    const answer = answers[String(chatId)] ?? 'SENT';
    if (answer instanceof Error) throw answer;
    return answer;
  });
  const todayIn = jest.fn(() => '2026-10-22');
  const service = new DailyRemindersService(
    { findReminderRecipients } as unknown as UsersRepository,
    { send } as unknown as TelegramBotService,
    {
      setIfAbsent: jest.fn(async (key: string) => (keys.has(key) ? false : (keys.add(key), true))),
    } as unknown as RedisService,
    { todayIn } as unknown as ClockService,
    { get: () => undefined } as unknown as ConfigService,
  );
  return { service, findReminderRecipients, send, todayIn };
}

describe('DailyRemindersService', () => {
  it('reminds everyone in the morning, with the buttons, on the app time zone day', async () => {
    const { service, findReminderRecipients, send, todayIn } = setup([person('u1', 1n), person('u2', 2n, 'Ali')]);

    expect(await service.run('morning')).toEqual({ kind: 'morning', recipients: 2, sent: 2 });
    expect(todayIn).toHaveBeenCalledWith('Asia/Tashkent');
    expect(findReminderRecipients).toHaveBeenCalledWith(undefined);
    expect(send).toHaveBeenCalledWith(
      2n,
      expect.stringContaining('Xayrli tong, Ali!'),
      expect.objectContaining({ html: true, replyMarkup: expect.objectContaining({ inline_keyboard: expect.any(Array) }) }),
    );
  });

  it('in the evening asks only for those quiet all day, and never twice the same day', async () => {
    const { service, findReminderRecipients, send } = setup([person('u1', 1n)]);

    expect(await service.run('evening')).toEqual({ kind: 'evening', recipients: 1, sent: 1 });
    expect(findReminderRecipients).toHaveBeenCalledWith(parseIsoDate('2026-10-22'));
    expect(send.mock.calls[0][1]).not.toContain('Xayrli tong');

    expect(await service.run('evening')).toEqual({ kind: 'evening', recipients: 1, sent: 0 });
    expect(send).toHaveBeenCalledTimes(1);
    // The morning and the evening reminder are separate messages.
    expect(await service.run('morning')).toMatchObject({ sent: 1 });
  });

  it('carries on past people who blocked the bot or a failed send', async () => {
    const { service, send } = setup([person('u1', 1n), person('u2', null), person('u3', 3n), person('u4', 4n)], {
      '1': 'BLOCKED',
      '3': new Error('network'),
    });

    expect(await service.run('morning')).toEqual({ kind: 'morning', recipients: 4, sent: 1 });
    expect(send.mock.calls.map(([chatId]) => chatId)).toEqual([1n, 3n, 4n]);
  });
});

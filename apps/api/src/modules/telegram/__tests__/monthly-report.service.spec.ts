import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';
import { MonthlyReportService } from '../outbox/monthly-report.service';
import { UsersRepository } from '../../users/users.repository';
import { StatsService } from '../../stats/stats.service';
import { BudgetsService } from '../../budgets/budgets.service';
import { SendResult, TelegramBotService } from '../../../infra/telegram/telegram-bot.service';
import { TtsService } from '../../../infra/tts/tts.service';
import { RedisService } from '../../../infra/redis/redis.service';
import { ClockService } from '../../../infra/clock/clock.service';

const person = (id: string, telegramId: bigint): User => ({ id, telegramId, name: 'Aziz' }) as unknown as User;

const summary = {
  periodIncome: '0',
  periodExpense: '100000',
  transactionCount: 1,
  previousPeriod: { expense: '0', changePercent: 0 },
  debt: { owedToMe: '0', iOwe: '0' },
  totalBalance: '0',
};

function setup(recipients: User[], options: { texts?: Record<string, SendResult | Error>; voice?: boolean } = {}) {
  const keys = new Set<string>();
  const send = jest.fn(async (chatId: bigint, _text: string, _options?: unknown) => {
    const answer = options.texts?.[String(chatId)] ?? 'SENT';
    if (answer instanceof Error) throw answer;
    return answer;
  });
  const sendVoice = jest.fn(async (_chatId: bigint, _audio: Buffer, _options?: unknown): Promise<SendResult> => 'SENT');
  const speak = jest.fn(async () => (options.voice === false ? null : { audio: Buffer.from('OggS'), provider: 'azure-free' }));
  const findMonthlyRecipients = jest.fn(async () => recipients);
  const service = new MonthlyReportService(
    { findMonthlyRecipients } as unknown as UsersRepository,
    {
      getSummary: jest.fn(async () => summary),
      getByCategory: jest.fn(async () => ({ items: [] })),
    } as unknown as StatsService,
    { getStatus: jest.fn(async () => ({ data: [] })) } as unknown as BudgetsService,
    { send, sendVoice } as unknown as TelegramBotService,
    { speak } as unknown as TtsService,
    { setIfAbsent: jest.fn(async (key: string) => (keys.has(key) ? false : (keys.add(key), true))) } as unknown as RedisService,
    { todayIn: jest.fn(() => '2026-10-31') } as unknown as ClockService,
    { get: () => undefined } as unknown as ConfigService,
  );
  return { service, send, sendVoice, speak, findMonthlyRecipients };
}

describe('MonthlyReportService', () => {
  it('sends the text, then the voice, to each recipient of the month, and only once', async () => {
    const { service, send, sendVoice, findMonthlyRecipients } = setup([person('u1', 1n), person('u2', 2n)]);

    expect(await service.run()).toEqual({ month: '2026-10', recipients: 2, sent: 2, voiced: 2, providers: { 'azure-free': 2 } });
    expect(await service.run()).toMatchObject({ sent: 0, voiced: 0 });
    expect(findMonthlyRecipients).toHaveBeenCalledWith({
      from: new Date('2026-10-01T00:00:00.000Z'),
      to: new Date('2026-10-31T00:00:00.000Z'),
    });
    expect(send).toHaveBeenCalledTimes(2);
    expect(sendVoice).toHaveBeenCalledWith(1n, Buffer.from('OggS'), { caption: '🎧 Hisobotni tinglang' });
  });

  it('reads nothing aloud to whom the text did not reach, and one failure does not stop the rest', async () => {
    const { service, speak, sendVoice } = setup([person('u1', 1n), person('u2', 2n), person('u3', 3n)], {
      texts: { '1': 'BLOCKED', '2': new Error('network') },
    });

    expect(await service.run()).toMatchObject({ recipients: 3, sent: 1, voiced: 1 });
    expect(speak).toHaveBeenCalledTimes(1);
    expect(sendVoice.mock.calls.map(([chatId]) => chatId)).toEqual([3n]);
  });

  it('still sends the text when no voice could be made', async () => {
    const { service, sendVoice } = setup([person('u1', 1n)], { voice: false });

    expect(await service.run()).toMatchObject({ sent: 1, voiced: 0, providers: {} });
    expect(sendVoice).not.toHaveBeenCalled();
  });
});

import { Broadcast } from '@prisma/client';
import { TelegramBotService, SendResult } from '../../../../infra/telegram/telegram-bot.service';
import { BroadcastDeliveryService } from '../broadcast-delivery.service';
import { BroadcastsRepository, ClaimedRecipient, DeliveryOutcome } from '../broadcasts.repository';

function setup(status: Broadcast['status'], batches: ClaimedRecipient[][], answers: Record<string, SendResult[]>) {
  const recorded: DeliveryOutcome[] = [];
  const repository = {
    findById: jest.fn(async () => ({ id: 'b1', text: 'Salom', status }) as Broadcast),
    markStarted: jest.fn(async () => undefined),
    failInterrupted: jest.fn(async () => undefined),
    claim: jest.fn(async () => batches.shift() ?? []),
    record: jest.fn(async (_id: string, outcomes: DeliveryOutcome[]) => {
      recorded.push(...outcomes);
    }),
    refreshCounts: jest.fn(async () => ({ sent: 0, blocked: 0, failed: 0, total: 0 }) as unknown as Broadcast),
  };
  const send = jest.fn(async (chatId: bigint) => answers[String(chatId)].shift() ?? 'FAILED');
  const service = new BroadcastDeliveryService(
    repository as unknown as BroadcastsRepository,
    { send } as unknown as TelegramBotService,
  );
  return { service, repository, send, recorded };
}

describe('BroadcastDeliveryService', () => {
  it('sends each claimed person once, retries a reported failure once, and records every outcome', async () => {
    const { service, repository, send, recorded } = setup(
      'QUEUED',
      [[{ userId: 'u1', telegramId: 1n }, { userId: 'u2', telegramId: 2n }, { userId: 'u3', telegramId: 3n }]],
      { '1': ['SENT'], '2': ['FAILED', 'SENT'], '3': ['BLOCKED'] },
    );
    await service.deliver('b1');

    expect(send).toHaveBeenCalledTimes(4);
    expect(recorded).toEqual([
      { userId: 'u1', status: 'SENT' },
      { userId: 'u2', status: 'SENT' },
      { userId: 'u3', status: 'BLOCKED' },
    ]);
    expect(repository.failInterrupted).toHaveBeenCalledWith('b1');
    expect(repository.refreshCounts).toHaveBeenLastCalledWith('b1', true);
  });

  it('gives up after the second failure and says why when the bot is switched off', async () => {
    const { service, recorded } = setup(
      'SENDING',
      [[{ userId: 'u1', telegramId: 1n }, { userId: 'u2', telegramId: 2n }]],
      { '1': ['FAILED', 'FAILED'], '2': ['DISABLED', 'DISABLED'] },
    );
    await service.deliver('b1');
    expect(recorded).toEqual([
      { userId: 'u1', status: 'FAILED', error: 'telegram_error' },
      { userId: 'u2', status: 'FAILED', error: 'bot_disabled' },
    ]);
  });

  it('does nothing for a broadcast that is already done', async () => {
    const { service, repository, send } = setup('DONE', [[{ userId: 'u1', telegramId: 1n }]], { '1': ['SENT'] });
    await service.deliver('b1');
    expect(repository.claim).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });
});

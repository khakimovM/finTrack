import { parseIsoDate } from '@fintrack/shared';
import { DebtRemindersService } from '../debt-reminders.service';
import { DebtsRepository, ReminderCandidate } from '../debts.repository';
import { NotificationsService } from '../../notifications/notifications.service';
import { ClockService } from '../../../infra/clock/clock.service';

function candidate(dueDate: string, overrides: Partial<ReminderCandidate> = {}): ReminderCandidate {
  return {
    id: `debt-${dueDate}`,
    userId: 'u1',
    direction: 'I_LENT',
    personName: 'Jasur',
    dueDate: parseIsoDate(dueDate),
    remaining: 500_000n,
    timezone: 'Asia/Tashkent',
    ...overrides,
  };
}

function setup(candidates: ReminderCandidate[], today = '2026-09-27') {
  const repository = { findReminderCandidates: jest.fn().mockResolvedValue(candidates) };
  const notifications = { createSafe: jest.fn().mockResolvedValue({ id: 'n' }) };
  const clock = { now: () => new Date(`${today}T04:00:00Z`), todayIn: () => today };
  const service = new DebtRemindersService(
    repository as unknown as DebtsRepository,
    notifications as unknown as NotificationsService,
    clock as unknown as ClockService,
  );
  return { service, repository, notifications };
}

describe('DebtRemindersService', () => {
  it('sends DEBT_DUE_SOON for debts due within 3 days, keyed by debt and due date', async () => {
    const t = setup([candidate('2026-09-27'), candidate('2026-09-30'), candidate('2026-10-01')]);

    const summary = await t.service.run();

    expect(summary).toEqual({ dueSoon: 2, overdue: 0 });
    expect(t.notifications.createSafe).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ type: 'DEBT_DUE_SOON', dedupeKey: 'debt-due-soon:debt-2026-09-27:2026-09-27' }),
    );
  });

  it('sends DEBT_OVERDUE at most once per ISO week', async () => {
    const t = setup([candidate('2026-09-20')]);

    await t.service.run();

    // 2026-09-27 is a Sunday: its ISO week starts on Monday 2026-09-21.
    expect(t.notifications.createSafe).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ type: 'DEBT_OVERDUE', dedupeKey: 'debt-overdue:debt-2026-09-20:2026-09-21' }),
    );
  });

  it('does not count an alert that was already delivered (dedupe hit)', async () => {
    const t = setup([candidate('2026-09-28')]);
    t.notifications.createSafe.mockResolvedValue(null);
    expect(await t.service.run()).toEqual({ dueSoon: 0, overdue: 0 });
  });

  it('skips fully repaid debts', async () => {
    const t = setup([candidate('2026-09-20', { remaining: 0n })]);
    await t.service.run();
    expect(t.notifications.createSafe).not.toHaveBeenCalled();
  });
});

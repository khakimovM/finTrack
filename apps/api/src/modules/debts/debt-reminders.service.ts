import { Injectable } from '@nestjs/common';
import {
  addDays,
  diffInDays,
  formatIsoDate,
  formatMoney,
  parseIsoDate,
  startOfIsoWeek,
} from '@fintrack/shared';
import { DebtsRepository, ReminderCandidate } from './debts.repository';
import { NotificationsService } from '../notifications/notifications.service';
import { ClockService } from '../../infra/clock/clock.service';

export const DUE_SOON_DAYS = 3;

export interface ReminderSummary {
  dueSoon: number;
  overdue: number;
}

/**
 * Daily debt reminders. Dedupe keys make the job safe to retry: one "due soon" per debt and due
 * date, and at most one "overdue" per debt per ISO week while it stays unpaid.
 */
@Injectable()
export class DebtRemindersService {
  constructor(
    private readonly repository: DebtsRepository,
    private readonly notifications: NotificationsService,
    private readonly clock: ClockService,
  ) {}

  async run(): Promise<ReminderSummary> {
    // Users may be ahead of UTC, so look one extra day forward and decide per user below.
    const utcToday = parseIsoDate(formatIsoDate(this.clock.now()));
    const candidates = await this.repository.findReminderCandidates(addDays(utcToday, DUE_SOON_DAYS + 1));

    const summary: ReminderSummary = { dueSoon: 0, overdue: 0 };
    for (const debt of candidates) {
      if (debt.remaining <= 0n) continue;
      const today = this.clock.todayIn(debt.timezone);
      const due = formatIsoDate(debt.dueDate);
      const daysLeft = diffInDays(today, due);

      if (daysLeft < 0) {
        if (await this.notifyOverdue(debt, due, -daysLeft, today)) summary.overdue++;
      } else if (daysLeft <= DUE_SOON_DAYS) {
        if (await this.notifyDueSoon(debt, due, daysLeft)) summary.dueSoon++;
      }
    }
    return summary;
  }

  private async notifyDueSoon(debt: ReminderCandidate, due: string, daysLeft: number): Promise<boolean> {
    const when = daysLeft === 0 ? 'bugun' : `${daysLeft} kundan keyin`;
    const body =
      debt.direction === 'I_LENT'
        ? `${debt.personName} sizga ${formatMoney(debt.remaining)} qaytarishi kerak — muddat ${when} (${due}).`
        : `${debt.personName}ga ${formatMoney(debt.remaining)} qaytarishingiz kerak — muddat ${when} (${due}).`;

    const created = await this.notifications.createSafe(debt.userId, {
      type: 'DEBT_DUE_SOON',
      title: 'Qarz muddati yaqinlashmoqda',
      body,
      meta: { debtId: debt.id, dueDate: due, daysLeft },
      dedupeKey: `debt-due-soon:${debt.id}:${due}`,
    });
    return created !== null;
  }

  private async notifyOverdue(
    debt: ReminderCandidate,
    due: string,
    daysOverdue: number,
    today: string,
  ): Promise<boolean> {
    const week = formatIsoDate(startOfIsoWeek(parseIsoDate(today)));
    const body =
      debt.direction === 'I_LENT'
        ? `${debt.personName}ning ${formatMoney(debt.remaining)} qarzi muddati ${daysOverdue} kun o‘tdi (${due}).`
        : `${debt.personName}ga ${formatMoney(debt.remaining)} qarzingiz muddati ${daysOverdue} kun o‘tdi (${due}).`;

    const created = await this.notifications.createSafe(debt.userId, {
      type: 'DEBT_OVERDUE',
      title: 'Qarz muddati o‘tdi',
      body,
      meta: { debtId: debt.id, dueDate: due, daysOverdue },
      dedupeKey: `debt-overdue:${debt.id}:${week}`,
    });
    return created !== null;
  }
}

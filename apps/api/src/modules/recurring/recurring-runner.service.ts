import { Injectable, Logger } from '@nestjs/common';
import { RecurringRule } from '@prisma/client';
import { addDays, formatIsoDate, formatMoney, parseIsoDate } from '@fintrack/shared';
import { RecurringRepository, OccurrenceWithRelations } from './recurring.repository';
import { nextOccurrence } from './recurrence';
import { BalanceService } from '../accounts/balance.service';
import { BalanceGuardService } from '../accounts/balance-guard.service';
import { BudgetsService } from '../budgets/budgets.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { Db } from '../../infra/prisma/prisma.types';
import { ClockService } from '../../infra/clock/clock.service';
import { InsufficientBalanceException } from '../../common/exceptions/domain.exception';

/** A rule that fell far behind (server down, account restored) catches up at most a year at once. */
const MAX_OCCURRENCES_PER_RUN = 366;

export interface MaterializeResult {
  rule: RecurringRule;
  created: OccurrenceWithRelations[];
  skippedDates: string[];
  deactivatedReason: 'ACCOUNT_UNAVAILABLE' | null;
}

export interface ProcessSummary {
  rules: number;
  created: number;
  skipped: number;
  errors: number;
}

@Injectable()
export class RecurringRunnerService {
  private readonly logger = new Logger(RecurringRunnerService.name);

  constructor(
    private readonly repository: RecurringRepository,
    private readonly balanceService: BalanceService,
    private readonly balanceGuard: BalanceGuardService,
    private readonly budgetsService: BudgetsService,
    private readonly notifications: NotificationsService,
    private readonly clock: ClockService,
    private readonly prisma: PrismaService,
  ) {}

  /** Entry point of the hourly job. Each rule runs in its own transaction and cannot fail the batch. */
  async processDueRules(): Promise<ProcessSummary> {
    // Users may be up to 14h ahead of UTC, so anything due "tomorrow in UTC" can be due today for them.
    const horizon = addDays(parseIsoDate(formatIsoDate(this.clock.now())), 1);
    const ids = await this.repository.findDueRuleIds(horizon);
    const summary: ProcessSummary = { rules: ids.length, created: 0, skipped: 0, errors: 0 };

    for (const id of ids) {
      try {
        const result = await this.materialize(id);
        summary.created += result?.created.length ?? 0;
        summary.skipped += result?.skippedDates.length ?? 0;
      } catch (err: unknown) {
        summary.errors++;
        this.logger.error(`Recurring rule ${id} failed`, err instanceof Error ? err.stack : String(err));
      }
    }
    return summary;
  }

  /**
   * Creates every occurrence that is due up to the owner's today. Idempotency comes from the rule
   * lock plus the (recurringRuleId, date) unique key: an occurrence that already exists — even
   * one the user deleted — is never recreated, and the schedule always moves forward.
   */
  async materialize(ruleId: string): Promise<MaterializeResult | null> {
    const result = await this.prisma.$transaction(
      async (db): Promise<MaterializeResult | null> => {
        const rule = await this.repository.lock(db, ruleId);
        if (!rule || !rule.isActive) return null;

        if (!rule.accountActive) {
          const saved = await this.repository.saveSchedule(db, rule.id, rule.nextRunAt, false);
          return { rule: saved, created: [], skippedDates: [], deactivatedReason: 'ACCOUNT_UNAVAILABLE' };
        }

        const today = this.clock.todayIn(rule.timezone);
        const created: OccurrenceWithRelations[] = [];
        const skippedDates: string[] = [];
        let next = rule.nextRunAt;

        for (let i = 0; i < MAX_OCCURRENCES_PER_RUN; i++) {
          if (formatIsoDate(next) > today || (rule.endsAt && next > rule.endsAt)) break;

          if (!(await this.repository.findOccurrence(db, rule.id, next))) {
            if (await this.canDebit(db, rule)) {
              created.push(await this.repository.createOccurrence(db, rule, next));
            } else {
              skippedDates.push(formatIsoDate(next));
            }
          }
          next = nextOccurrence(next, rule.frequency, rule.startsAt, rule.dayOfCycle);
        }

        const stillActive = !(rule.endsAt && next > rule.endsAt);
        const saved = await this.repository.saveSchedule(db, rule.id, next, stillActive);
        return { rule: saved, created, skippedDates, deactivatedReason: null };
      },
      { timeout: 30_000 },
    );

    if (result) await this.afterCommit(result);
    return result;
  }

  private async canDebit(db: Db, rule: RecurringRule): Promise<boolean> {
    if (rule.type !== 'EXPENSE') return true;
    try {
      await this.balanceGuard.assertCanDebit(db, rule.userId, rule.accountId, rule.amount);
      return true;
    } catch (err) {
      if (err instanceof InsufficientBalanceException) return false;
      throw err;
    }
  }

  /** Cache, budgets and notifications run only after the ledger rows are committed. */
  async afterCommit(result: MaterializeResult): Promise<void> {
    const { rule, created, skippedDates, deactivatedReason } = result;
    const label = rule.note ?? 'Takroriy to‘lov';

    if (created.length > 0) {
      await this.balanceService.invalidate(rule.userId, [rule.accountId]);

      if (rule.type === 'EXPENSE' && rule.categoryId) {
        const months = new Map(created.map((tx) => [formatIsoDate(tx.date).slice(0, 7), tx.date]));
        for (const date of months.values()) {
          await this.budgetsService.checkAndNotify(rule.userId, rule.categoryId, date);
        }
      }

      const last = formatIsoDate(created[created.length - 1].date);
      await this.notifications.createSafe(rule.userId, {
        type: 'RECURRING_CREATED',
        title: 'Takroriy to‘lov yozildi',
        body:
          created.length === 1
            ? `"${label}": ${formatMoney(rule.amount)} (${last}) yozildi.`
            : `"${label}": ${created.length} ta to‘lov yozildi, oxirgisi ${last}.`,
        meta: { recurringRuleId: rule.id, count: created.length, lastDate: last },
        dedupeKey: `recurring-created:${rule.id}:${last}`,
      });
    }

    for (const date of skippedDates) {
      await this.notifications.createSafe(rule.userId, {
        type: 'RECURRING_SKIPPED',
        title: 'Takroriy to‘lov bajarilmadi',
        body: `"${label}" (${formatMoney(rule.amount)}, ${date}) hisobda mablag‘ yetarli bo‘lmagani uchun yozilmadi.`,
        meta: { recurringRuleId: rule.id, date, reason: 'INSUFFICIENT_BALANCE' },
        dedupeKey: `recurring-skipped:${rule.id}:${date}`,
      });
    }

    if (deactivatedReason) {
      await this.notifications.createSafe(rule.userId, {
        type: 'RECURRING_SKIPPED',
        title: 'Takroriy to‘lov to‘xtatildi',
        body: `"${label}" hisobi arxivlangani yoki o‘chirilgani uchun to‘xtatildi.`,
        meta: { recurringRuleId: rule.id, reason: deactivatedReason },
        dedupeKey: `recurring-deactivated:${rule.id}:${formatIsoDate(rule.nextRunAt)}`,
      });
    }
  }
}

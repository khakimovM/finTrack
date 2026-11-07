import { Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { CardImportRepository, ImportOperation } from './card-import.repository';
import { FEE_MERCHANT_KEY, UNDECIDED, isShopPurchase } from './card-planner';
import { CARD_TEXTS } from './card-texts';
import { merchantKey } from './merchant';
import { userLocale } from '../i18n';
import { AccountsRepository } from '../../accounts/accounts.repository';
import { BalanceService } from '../../accounts/balance.service';
import { BudgetsService } from '../../budgets/budgets.service';
import { CategoriesRepository } from '../../categories/categories.repository';
import { DebtsRepository } from '../../debts/debts.repository';
import { TransfersRepository } from '../../transfers/transfers.repository';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { Db } from '../../../infra/prisma/prisma.types';

export type SaveOutcome = { status: 'saved'; count: number } | { status: 'nothing' } | { status: 'gone' };

/** Another tap saved these operations first; this transaction rolls back. */
class AlreadySaved extends Error {}

/**
 * Writes an import's decided operations to the ledger in one transaction, takes a whole import
 * back out, and lines account balances up with the bank's. Strict mode does not apply: the bank
 * has already moved this money, so refusing to record it would only make the ledger wrong
 * (40-domain-money.md §5).
 */
@Injectable()
export class CardLedgerService {
  constructor(
    private readonly repository: CardImportRepository,
    private readonly accounts: AccountsRepository,
    private readonly categories: CategoriesRepository,
    private readonly balances: BalanceService,
    private readonly budgets: BudgetsService,
    private readonly debts: DebtsRepository,
    private readonly transfers: TransfersRepository,
    private readonly prisma: PrismaService,
  ) {}

  async save(user: User, importId: string): Promise<SaveOutcome> {
    const imp = await this.repository.findImport(user.id, importId);
    if (!imp) return { status: 'gone' };
    const ready = await this.stillValid(user, imp.operations.filter((op) => op.status === 'PENDING' && op.resolution !== null));
    if (ready.length === 0) return { status: 'nothing' };

    const touched = new Set<string>();
    const spent: Array<{ categoryId: string; date: Date }> = [];
    try {
      await this.prisma.$transaction(async (db) => {
        const byId = new Map(ready.map((op) => [op.id, op]));
        const done = new Set<string>();
        const mark = async (op: ImportOperation, data: Prisma.CardOperationUncheckedUpdateManyInput) => {
          const updated = await db.cardOperation.updateMany({ where: { id: op.id, userId: user.id, status: 'PENDING' }, data });
          if (updated.count !== 1) throw new AlreadySaved();
          done.add(op.id);
        };
        for (const op of ready) {
          if (done.has(op.id)) continue;
          const partner = op.pairedId ? byId.get(op.pairedId) : undefined;
          await this.write(db, user, op, partner, { mark, touched, spent });
        }
        await db.cardImport.updateMany({ where: { id: importId, userId: user.id }, data: { savedAt: new Date() } });
      });
    } catch (err) {
      if (err instanceof AlreadySaved) return { status: 'nothing' };
      throw err;
    }

    await this.balances.invalidate(user.id, touched);
    const months = new Map(spent.map((s) => [`${s.categoryId}:${s.date.toISOString().slice(0, 7)}`, s]));
    for (const { categoryId, date } of months.values()) await this.budgets.checkAndNotify(user.id, categoryId, date);
    await this.repository.remember(user.id, this.choicesToRemember(ready));
    return { status: 'saved', count: ready.length };
  }

  /** Everything the import wrote leaves the ledger, refunded purchases come back, and the operations are forgotten. */
  async undo(user: User, importId: string): Promise<boolean> {
    const imp = await this.repository.findImport(user.id, importId);
    if (!imp) return false;
    const saved = imp.operations.filter((op) => op.status === 'SAVED');
    const written = saved.filter((op) => op.resolution !== 'CANCELLED');
    const refunds = saved.filter((op) => op.resolution === 'CANCELLED' && op.transactionId);
    const ids = <K extends 'transactionId' | 'transferGroupId' | 'debtId'>(ops: ImportOperation[], key: K) =>
      ops.flatMap((op) => (op[key] ? [op[key] as string] : []));

    const touched = await this.prisma.$transaction(async (db) => {
      const now = new Date();
      const rows = await db.transaction.findMany({
        where: {
          userId: user.id,
          deletedAt: null,
          OR: [
            { id: { in: ids(written, 'transactionId') } },
            { transferGroupId: { in: ids(written, 'transferGroupId') } },
            { debtId: { in: ids(written, 'debtId') } },
          ],
        },
        select: { id: true, accountId: true },
      });
      await db.transaction.updateMany({ where: { userId: user.id, id: { in: rows.map((r) => r.id) } }, data: { deletedAt: now } });
      await db.debt.updateMany({ where: { userId: user.id, id: { in: ids(written, 'debtId') }, deletedAt: null }, data: { deletedAt: now } });

      const back = await db.transaction.findMany({
        where: { userId: user.id, id: { in: ids(refunds, 'transactionId') }, deletedAt: { not: null } },
        select: { id: true, accountId: true },
      });
      await db.transaction.updateMany({ where: { userId: user.id, id: { in: back.map((r) => r.id) } }, data: { deletedAt: null } });
      await db.cardOperation.updateMany({
        where: { userId: user.id, id: { in: refunds.flatMap((op) => (op.pairedId ? [op.pairedId] : [])) } },
        data: { pairedId: null },
      });

      await db.cardOperation.deleteMany({ where: { userId: user.id, importId } });
      await db.cardImport.deleteMany({ where: { userId: user.id, id: importId } });
      return [...rows, ...back].map((r) => r.accountId);
    });
    await this.balances.invalidate(user.id, touched);
    return true;
  }

  /**
   * The bank's latest balance next to FinTrack's, per account the cards book to. Cards sharing an
   * account are added up; an account with a card whose balance the bank never showed is left out.
   */
  async compareWithBank(userId: string, accountIds: string[]): Promise<Array<{ accountId: string; bank: bigint; ledger: bigint }>> {
    const unique = [...new Set(accountIds)];
    if (unique.length === 0) return [];
    const cards = await this.prisma.paymentCard.findMany({ where: { userId, accountId: { in: unique } } });
    const bank = await this.repository.latestBalances(userId, cards.map((c) => c.id));
    const { balances } = await this.balances.getAccountBalances(userId);
    return unique.flatMap((accountId) => {
      const own = cards.filter((c) => c.accountId === accountId);
      if (own.length === 0 || own.some((c) => !bank.has(c.id))) return [];
      return [{ accountId, bank: own.reduce((sum, c) => sum + (bank.get(c.id) ?? 0n), 0n), ledger: balances.get(accountId) ?? 0n }];
    });
  }

  /** Moves each account's opening balance by its difference from the bank. Returns how many changed. */
  async reconcile(user: User, importId: string): Promise<number> {
    const imp = await this.repository.findImport(user.id, importId);
    if (!imp) return 0;
    const accountIds = imp.operations.flatMap((op) => (op.card.accountId ? [op.card.accountId] : []));
    const differences = (await this.compareWithBank(user.id, accountIds)).filter((row) => row.bank !== row.ledger);
    if (differences.length === 0) return 0;
    await this.prisma.$transaction(async (db) => {
      for (const { accountId, bank, ledger } of differences) {
        await db.account.updateMany({ where: { id: accountId, userId: user.id, deletedAt: null }, data: { openingBalance: { increment: bank - ledger } } });
      }
    });
    await this.balances.invalidate(user.id, differences.map((d) => d.accountId));
    return differences.length;
  }

  private async write(
    db: Db,
    user: User,
    op: ImportOperation,
    partner: ImportOperation | undefined,
    out: {
      mark: (op: ImportOperation, data: Prisma.CardOperationUncheckedUpdateManyInput) => Promise<void>;
      touched: Set<string>;
      spent: Array<{ categoryId: string; date: Date }>;
    },
  ): Promise<void> {
    const accountId = op.card.accountId as string;
    const row = { userId: user.id, date: op.date, source: 'CARD' as const, note: op.merchant.slice(0, 500) || null };
    out.touched.add(accountId);
    switch (op.resolution) {
      case 'EXPENSE':
      case 'INCOME': {
        const tx = await db.transaction.create({ data: { ...row, accountId, type: op.resolution, amount: op.amount, categoryId: op.categoryId } });
        if (op.resolution === 'EXPENSE' && op.categoryId) out.spent.push({ categoryId: op.categoryId, date: op.date });
        return out.mark(op, { status: 'SAVED', transactionId: tx.id });
      }
      case 'TRANSFER': {
        if (partner) {
          const [from, into] = op.direction === 'DEBIT' ? [op, partner] : [partner, op];
          const fromAccount = from.card.accountId as string;
          const intoAccount = into.card.accountId as string;
          const group = await this.transfers.createTransfer(db, user.id, { ...row, fromAccountId: fromAccount, toAccountId: intoAccount, amount: into.amount });
          let feeId: string | null = null;
          if (from.amount > into.amount && from.categoryId) {
            const note = CARD_TEXTS[userLocale(user)].feeNote;
            const fee = await db.transaction.create({
              data: { ...row, note, accountId: fromAccount, type: 'EXPENSE', amount: from.amount - into.amount, categoryId: from.categoryId },
            });
            feeId = fee.id;
            out.spent.push({ categoryId: from.categoryId, date: from.date });
          }
          out.touched.add(intoAccount);
          await out.mark(from, { status: 'SAVED', transferGroupId: group.transferGroupId, transactionId: feeId });
          return out.mark(into, { status: 'SAVED', transferGroupId: group.transferGroupId });
        }
        const counter = op.counterAccountId as string;
        const [fromAccountId, toAccountId] = op.direction === 'DEBIT' ? [accountId, counter] : [counter, accountId];
        const group = await this.transfers.createTransfer(db, user.id, { ...row, fromAccountId, toAccountId, amount: op.amount });
        out.touched.add(counter);
        return out.mark(op, { status: 'SAVED', transferGroupId: group.transferGroupId });
      }
      case 'DEBT': {
        const { debt, transaction } = await this.debts.createDebt(db, user.id, {
          direction: op.direction === 'DEBIT' ? 'I_LENT' : 'I_BORROWED',
          personName: op.debtPerson ?? '',
          accountId,
          amount: op.amount,
          date: op.date,
          source: 'CARD',
        });
        return out.mark(op, { status: 'SAVED', debtId: debt.id, transactionId: transaction.id });
      }
      case 'DUPLICATE':
        return out.mark(op, { status: 'LINKED' });
      case 'CANCELLED': {
        if (partner) {
          await out.mark(op, { status: 'SKIPPED' });
          return out.mark(partner, { status: 'SKIPPED' });
        }
        // The purchase came from an earlier import (or was typed in): the refund takes it out.
        if (op.transactionId) {
          await db.transaction.updateMany({ where: { id: op.transactionId, userId: user.id, deletedAt: null }, data: { deletedAt: new Date() } });
        }
        if (op.pairedId) await db.cardOperation.updateMany({ where: { id: op.pairedId, userId: user.id }, data: { pairedId: op.id } });
        return out.mark(op, { status: 'SAVED' });
      }
      default:
        return out.mark(op, { status: 'SKIPPED' });
    }
  }

  /**
   * What changed since the plan (a category or account deleted or archived, a matched row
   * deleted, half of a pair changed) goes back to ❓ instead of being written wrong.
   */
  private async stillValid(user: User, ready: ImportOperation[]): Promise<ImportOperation[]> {
    const [accounts, roots] = await Promise.all([this.accounts.findAll(user.id), this.categories.findAll(user.id)]);
    const active = new Set(accounts.map((a) => a.id));
    const categories = new Map(roots.flatMap((r) => [r, ...(r.children ?? [])]).map((c) => [c.id, c.type]));
    const matched = await this.prisma.transaction.findMany({
      where: { userId: user.id, deletedAt: null, id: { in: ready.flatMap((op) => (op.resolution === 'DUPLICATE' && op.transactionId ? [op.transactionId] : [])) } },
      select: { id: true },
    });
    const liveMatches = new Set(matched.map((m) => m.id));
    const byId = new Map(ready.map((op) => [op.id, op]));

    const valid = (op: ImportOperation): boolean => {
      const accountId = op.card.accountId;
      if (!accountId || !active.has(accountId)) return false;
      const partner = op.pairedId ? byId.get(op.pairedId) : undefined;
      switch (op.resolution) {
        case 'EXPENSE':
          return op.categoryId !== null && categories.get(op.categoryId) === 'EXPENSE';
        case 'INCOME':
          return op.categoryId !== null && categories.get(op.categoryId) === 'INCOME';
        case 'TRANSFER': {
          if (!op.pairedId) return op.counterAccountId !== null && op.counterAccountId !== accountId && active.has(op.counterAccountId);
          if (!partner || partner.resolution !== 'TRANSFER' || !partner.card.accountId || !active.has(partner.card.accountId)) return false;
          if (partner.card.accountId === accountId) return false;
          const from = op.direction === 'DEBIT' ? op : partner;
          const fee = from.amount - (op.direction === 'DEBIT' ? partner : op).amount;
          return fee === 0n || (from.categoryId !== null && categories.get(from.categoryId) === 'EXPENSE');
        }
        case 'DEBT':
          return Boolean(op.debtPerson?.trim());
        case 'DUPLICATE':
          return op.transactionId !== null && liveMatches.has(op.transactionId);
        case 'CANCELLED':
          return partner ? partner.resolution === 'CANCELLED' : op.transactionId !== null;
        default:
          return true;
      }
    };

    const broken = ready.filter((op) => !valid(op));
    // A pair is undone together: one half alone would be written as something it is not.
    const reset = new Set(broken.flatMap((op) => (op.pairedId && byId.has(op.pairedId) ? [op.id, op.pairedId] : [op.id])));
    if (reset.size > 0) {
      await this.repository.updatePending(user.id, [...reset], { ...UNDECIDED, counterAccountId: null, debtPerson: null });
    }
    return ready.filter((op) => !reset.has(op.id));
  }

  /** Shops the person or the AI placed are placed the same way next time; so is a chosen fee category. */
  private choicesToRemember(saved: ImportOperation[]): Array<{ merchantKey: string; categoryId: string }> {
    const choices = new Map<string, string>();
    for (const op of saved) {
      if (!op.categoryId || (op.categorySource !== 'USER' && op.categorySource !== 'AI')) continue;
      if (op.resolution === 'EXPENSE' && isShopPurchase(op)) choices.set(merchantKey(op.merchant), op.categoryId);
      if (op.resolution === 'TRANSFER' && op.direction === 'DEBIT') choices.set(FEE_MERCHANT_KEY, op.categoryId);
    }
    return [...choices].map(([merchantKey, categoryId]) => ({ merchantKey, categoryId }));
  }
}

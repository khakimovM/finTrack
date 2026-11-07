import { Injectable } from '@nestjs/common';
import { CardOperation, Prisma, User } from '@prisma/client';
import { CardImportRepository, ImportOperation } from './card-import.repository';
import { CardImportService } from './card-import.service';
import { FEE_MERCHANT_KEY, UNDECIDED } from './card-planner';
import { AccountsRepository } from '../../accounts/accounts.repository';
import { PrismaService } from '../../../infra/prisma/prisma.service';

export type Decision =
  | { kind: 'category'; categoryId: string }
  | { kind: 'transfer'; accountId: string }
  | { kind: 'debt'; person: string }
  | { kind: 'skip' }
  /** Take apart a pair, or say a "duplicate" is in fact new. */
  | { kind: 'split' }
  /** Confirm a suggested transfer between own cards; `feeCategoryId` when the receiving card got less. */
  | { kind: 'pair'; feeCategoryId?: string };

const CLEAR: Prisma.CardOperationUncheckedUpdateManyInput = { ...UNDECIDED, counterAccountId: null, debtPerson: null };

export const MAX_PERSON_LENGTH = 100;

/** The person's answers about single operations of an import. Nothing reaches the ledger here. */
@Injectable()
export class CardDecisionsService {
  constructor(
    private readonly repository: CardImportRepository,
    private readonly imports: CardImportService,
    private readonly accounts: AccountsRepository,
    private readonly prisma: PrismaService,
  ) {}

  /** False when the operation is gone, already saved, or the answer does not fit it. */
  async decide(user: User, importId: string, seq: number, decision: Decision): Promise<boolean> {
    const op = await this.repository.findOperation(user.id, importId, seq);
    if (!op || op.status !== 'PENDING') return false;
    const partner = op.pairedId
      ? await this.prisma.cardOperation.findFirst({ where: { id: op.pairedId, userId: user.id, importId, status: 'PENDING' } })
      : null;

    switch (decision.kind) {
      case 'category': {
        const type = op.direction === 'DEBIT' ? 'EXPENSE' : 'INCOME';
        const category = (await this.imports.categoryList(user.id)).find((c) => c.id === decision.categoryId);
        if (!category || category.type !== type) return false;
        return this.resolve(user, op, partner, { resolution: type, categoryId: category.id, categorySource: 'USER' });
      }
      case 'transfer': {
        const account = await this.accounts.findActiveById(user.id, decision.accountId);
        if (!account || account.id === op.card.accountId) return false;
        return this.resolve(user, op, partner, { resolution: 'TRANSFER', counterAccountId: account.id });
      }
      case 'debt': {
        const person = decision.person.trim();
        if (person.length === 0 || person.length > MAX_PERSON_LENGTH) return false;
        return this.resolve(user, op, partner, { resolution: 'DEBT', debtPerson: person });
      }
      case 'skip':
        return this.resolve(user, op, partner, { resolution: 'SKIP' });
      case 'split':
        await this.repository.updatePending(user.id, partner ? [op.id, partner.id] : [op.id], CLEAR);
        return true;
      case 'pair':
        return partner ? this.confirmPair(user, op, partner, decision.feeCategoryId) : false;
    }
  }

  /** The receiving card got less than the sending one paid: the difference needs an expense category. */
  async pairNeedsFeeCategory(user: User, importId: string, seq: number): Promise<boolean> {
    const op = await this.repository.findOperation(user.id, importId, seq);
    if (!op?.pairedId) return false;
    const partner = await this.prisma.cardOperation.findFirst({ where: { id: op.pairedId, userId: user.id } });
    if (!partner) return false;
    const [from, into] = op.direction === 'DEBIT' ? [op, partner] : [partner, op];
    return from.amount > into.amount;
  }

  /** A single answer always describes this operation alone, so a pair it was in comes apart. */
  private async resolve(
    user: User,
    op: ImportOperation,
    partner: CardOperation | null,
    data: Prisma.CardOperationUncheckedUpdateManyInput,
  ): Promise<boolean> {
    if (partner) await this.repository.updatePending(user.id, [partner.id], CLEAR);
    return (await this.repository.updatePending(user.id, [op.id], { ...CLEAR, ...data })) === 1;
  }

  private async confirmPair(user: User, op: ImportOperation, partner: CardOperation, feeCategoryId?: string): Promise<boolean> {
    const [from, into] = op.direction === 'DEBIT' ? [op, partner] : [partner, op];
    let fee: Prisma.CardOperationUncheckedUpdateManyInput = {};
    if (from.amount > into.amount) {
      const category = (await this.imports.categoryList(user.id)).find((c) => c.id === feeCategoryId);
      if (!category || category.type !== 'EXPENSE') return false;
      fee = { categoryId: category.id, categorySource: 'USER' };
      await this.repository.remember(user.id, [{ merchantKey: FEE_MERCHANT_KEY, categoryId: category.id }]);
    }
    await this.repository.updatePending(user.id, [from.id], { resolution: 'TRANSFER', ...fee });
    await this.repository.updatePending(user.id, [into.id], { resolution: 'TRANSFER' });
    return true;
  }
}

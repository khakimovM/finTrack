import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { addDays, formatIsoDate, parseIsoDate } from '@fintrack/shared';
import { DraftStore, TransactionDraft } from './drafts/draft.store';
import { DraftView } from './bot-ui';
import { parseQuickEntry } from './parsing/quick-entry.parser';
import { guessCategory, normalizeText } from './parsing/category-guesser';
import { CategoriesRepository } from '../categories/categories.repository';
import { AccountsRepository } from '../accounts/accounts.repository';
import { TransactionsService, CreateTransactionResult } from '../transactions/transactions.service';
import { ClockService } from '../../infra/clock/clock.service';

export interface EntryCandidate {
  type: 'INCOME' | 'EXPENSE';
  amount: bigint;
  note: string;
  date: string;
  categoryName?: string | null;
  accountName?: string | null;
}

export interface Option {
  id: string;
  label: string;
}

export type SaveOutcome =
  | { status: 'saved'; result: CreateTransactionResult }
  | { status: 'needs-category'; draft: TransactionDraft }
  | { status: 'expired' };

/** Chat → draft → ledger. The only way the bot writes a transaction is `save()`. */
@Injectable()
export class EntryService {
  constructor(
    private readonly drafts: DraftStore,
    private readonly categories: CategoriesRepository,
    private readonly accounts: AccountsRepository,
    private readonly transactions: TransactionsService,
    private readonly clock: ClockService,
  ) {}

  /** Parses "50000 taksi"-style text; null when the text is not an entry. */
  async fromText(user: User, text: string, forcedType?: 'INCOME' | 'EXPENSE'): Promise<TransactionDraft | null> {
    const parsed = parseQuickEntry(text);
    if (!parsed) return null;
    const today = parseIsoDate(this.clock.todayIn(user.timezone));
    return this.createDraft(
      user,
      {
        type: forcedType ?? parsed.type,
        amount: parsed.amount,
        note: parsed.note,
        date: formatIsoDate(addDays(today, -parsed.daysAgo)),
      },
      'text',
    );
  }

  async createDraft(user: User, entry: EntryCandidate, source: 'text' | 'voice'): Promise<TransactionDraft> {
    const [categories, accounts] = await Promise.all([this.categoryList(user.id), this.accounts.findAll(user.id)]);
    // Names can come from an AI extractor that spells apostrophes differently (Sog'liq / Sog‘liq).
    const same = (a: string, b: string) => normalizeText(a) === normalizeText(b);
    const byName = (name?: string | null) =>
      name ? categories.find((c) => c.type === entry.type && same(c.name, name)) : undefined;
    const category = byName(entry.categoryName) ?? guessCategory(entry.note, entry.type, categories);
    const account =
      accounts.find((a) => entry.accountName && same(a.name, entry.accountName)) ??
      accounts.find((a) => a.isDefault) ??
      accounts[0];

    return this.drafts.create({
      kind: 'transaction',
      userId: user.id,
      type: entry.type,
      amount: entry.amount.toString(),
      note: entry.note,
      categoryId: category?.id ?? null,
      accountId: account?.id ?? '',
      date: entry.date,
      source,
    });
  }

  async view(user: User, draft: TransactionDraft): Promise<DraftView> {
    const [categories, account] = await Promise.all([
      this.categoryList(user.id),
      draft.accountId ? this.accounts.findById(user.id, draft.accountId) : Promise.resolve(null),
    ]);
    const category = categories.find((c) => c.id === draft.categoryId);
    return {
      draft,
      categoryLabel: category ? `${category.icon} ${category.name}` : null,
      accountLabel: account ? `${account.icon} ${account.name}` : 'hisob tanlanmagan',
      today: this.clock.todayIn(user.timezone),
    };
  }

  async get(user: User, draftId: string): Promise<TransactionDraft | null> {
    const draft = await this.drafts.get(draftId, user.id);
    return draft?.kind === 'transaction' ? draft : null;
  }

  async update(draft: TransactionDraft, patch: Partial<TransactionDraft>): Promise<TransactionDraft> {
    const next = { ...draft, ...patch };
    await this.drafts.save(next);
    return next;
  }

  /** Switching income/expense invalidates the category (types must match); re-guess it. */
  async flip(user: User, draft: TransactionDraft): Promise<TransactionDraft> {
    const type = draft.type === 'INCOME' ? 'EXPENSE' : 'INCOME';
    const guess = guessCategory(draft.note, type, await this.categoryList(user.id));
    return this.update(draft, { type, categoryId: guess?.id ?? null });
  }

  async categoryOptions(user: User, type: 'INCOME' | 'EXPENSE'): Promise<Option[]> {
    return (await this.categoryList(user.id))
      .filter((c) => c.type === type)
      .map((c) => ({ id: c.id, label: `${c.icon} ${c.name}` }));
  }

  async accountOptions(user: User): Promise<Option[]> {
    return (await this.accounts.findAll(user.id)).map((a) => ({ id: a.id, label: `${a.icon} ${a.name}` }));
  }

  async save(user: User, draftId: string): Promise<SaveOutcome> {
    const draft = await this.drafts.consume(draftId, user.id);
    if (!draft || draft.kind !== 'transaction') return { status: 'expired' };
    if (!draft.categoryId) {
      await this.drafts.save(draft);
      return { status: 'needs-category', draft };
    }

    try {
      const result = await this.transactions.create(user.id, {
        type: draft.type,
        accountId: draft.accountId,
        amount: draft.amount,
        categoryId: draft.categoryId,
        date: draft.date,
        note: draft.note || null,
      }, draft.source === 'voice' ? 'VOICE' : 'BOT');
      return { status: 'saved', result };
    } catch (err) {
      // Keep the draft so the user can fix it (e.g. pick another account) and retry.
      await this.drafts.save(draft);
      throw err;
    }
  }

  async discard(user: User, draftId: string): Promise<void> {
    await this.drafts.consume(draftId, user.id);
  }

  async undo(user: User, transactionId: string): Promise<void> {
    await this.transactions.delete(user.id, transactionId);
  }

  /** Roots and their subcategories as one flat list (budgets and guesses need both). */
  private async categoryList(userId: string) {
    const roots = await this.categories.findAll(userId);
    return roots.flatMap((root) => [root, ...(root.children ?? [])]);
  }
}

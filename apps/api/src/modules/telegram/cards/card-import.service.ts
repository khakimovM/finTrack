import { Injectable } from '@nestjs/common';
import { CardNetwork, PaymentCard, User } from '@prisma/client';
import { formatIsoDate } from '@fintrack/shared';
import { CardImportRepository, ImportOperation, ImportWithOperations } from './card-import.repository';
import { CardLedgerService } from './card-ledger.service';
import { FEE_MERCHANT_KEY, PlanInput, UNDECIDED, isShopPurchase, planImport } from './card-planner';
import { ImportView, OperationView, Screen, cardLabel, mappingScreen, summaryScreen } from './card-ui';
import { merchantKey, merchantKind } from './merchant';
import { periodLabel } from '../bot-ui';
import { userLocale } from '../i18n';
import { AccountsRepository } from '../../accounts/accounts.repository';
import { BalanceService } from '../../accounts/balance.service';
import { CategoriesRepository } from '../../categories/categories.repository';
import { MerchantClassifier } from '../../assistant/merchant-classifier.service';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { TelegramBotService } from '../../../infra/telegram/telegram-bot.service';

const REFUND_LOOKBACK_MS = 45 * 24 * 3600_000;
/** A category the person may already keep fees in, before they have chosen one. */
const FEE_CATEGORY_NAME = /komissiya|комисси|xizmat haqi|bank xizmat|boshqa|прочее|другое/i;

export interface Category {
  id: string;
  name: string;
  icon: string;
  type: 'INCOME' | 'EXPENSE';
}

/** Tashkent wall-clock time of an instant: the banks' own time. */
function tashkentClock(at: Date): string {
  return new Date(at.getTime() + 5 * 3600_000).toISOString().slice(11, 16);
}

/**
 * An import goes through three screens: which account each new card is, then the summary with
 * every operation's proposed resolution, then the person's review. This service builds them.
 */
@Injectable()
export class CardImportService {
  constructor(
    private readonly repository: CardImportRepository,
    private readonly accounts: AccountsRepository,
    private readonly categories: CategoriesRepository,
    private readonly balances: BalanceService,
    private readonly classifier: MerchantClassifier,
    private readonly ledger: CardLedgerService,
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramBotService,
  ) {}

  /** Sends the first screen of a freshly gathered import to the person's chat. */
  async present(userId: string, importId: string): Promise<void> {
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null, bannedAt: null } });
    if (!user?.telegramId) return;
    const screen = await this.current(user, importId);
    if (screen) await this.telegram.send(user.telegramId, screen.text, { html: true, replyMarkup: screen.keyboard });
  }

  /** The next card to map to an account, or the summary (planned the first time it is shown). */
  async current(user: User, importId: string): Promise<Screen | null> {
    const imp = await this.repository.findImport(user.id, importId);
    if (!imp) return null;
    const accounts = await this.accounts.findAll(user.id);
    const live = new Set(accounts.map((a) => a.id));
    const unmapped = this.cardsOf(imp).find((card) => !card.accountId || !live.has(card.accountId));
    if (unmapped && imp.operations.some((op) => op.status === 'PENDING')) {
      const options = accounts.map((a) => ({ id: a.id, label: `${a.icon} ${a.name}` }));
      return mappingScreen(imp.id, userLocale(user), unmapped, options);
    }
    if (!imp.plannedAt) await this.plan(user, imp);
    const view = await this.view(user, importId);
    return view ? summaryScreen(view) : null;
  }

  /** The person said which account a card is (or asked for a new one). Null when the import is gone. */
  async mapCard(user: User, importId: string, network: CardNetwork, last4: string, target: string): Promise<Screen | null> {
    const imp = await this.repository.findImport(user.id, importId);
    const card = imp && this.cardsOf(imp).find((c) => c.network === network && c.last4 === last4);
    if (!imp || !card) return null;
    let accountId = target;
    if (target === 'new') {
      accountId = await this.createAccountFor(user, card, imp.operations.filter((op) => op.cardId === card.id));
    } else if (!(await this.accounts.findActiveById(user.id, target))) {
      return null;
    }
    await this.repository.setCardAccount(user.id, card.id, accountId);
    return this.current(user, importId);
  }

  async view(user: User, importId: string): Promise<ImportView | null> {
    const imp = await this.repository.findImport(user.id, importId);
    if (!imp) return null;
    const locale = userLocale(user);
    const [accounts, categories] = await Promise.all([this.accounts.findAll(user.id, true), this.categoryList(user.id)]);
    const accountLabel = (id: string | null) => {
      const a = id ? accounts.find((x) => x.id === id) : undefined;
      return a ? `${a.icon} ${a.name}` : null;
    };
    const byId = new Map(imp.operations.map((op) => [op.id, op]));
    const operations: OperationView[] = imp.operations.map((op) => {
      const partner = op.pairedId ? byId.get(op.pairedId) : undefined;
      const category = categories.find((c) => c.id === op.categoryId);
      return {
        seq: op.seq ?? 0,
        direction: op.direction,
        amount: op.amount,
        merchant: op.merchant,
        card: cardLabel(op.card.network, op.card.last4),
        when: `${formatIsoDate(op.date).split('-').reverse().join('.')} ${tashkentClock(op.occurredAt)}`,
        kind: merchantKind(op.merchant),
        reversal: op.reversal,
        status: op.status,
        resolution: op.resolution,
        category: category ? `${category.icon} ${category.name}` : null,
        counterAccount: accountLabel(op.counterAccountId),
        partner: partner ? { seq: partner.seq ?? 0, card: cardLabel(partner.card.network, partner.card.last4), amount: partner.amount } : null,
        debtPerson: op.debtPerson,
      };
    });
    const dates = imp.operations.map((op) => formatIsoDate(op.date)).sort();
    return {
      id: imp.id,
      locale,
      period: dates.length ? periodLabel(dates[0], dates[dates.length - 1], locale) : '',
      cards: this.cardsOf(imp).map((c) => ({ label: cardLabel(c.network, c.last4), account: accountLabel(c.accountId) })),
      operations,
      ignored: imp.ignored,
      repeated: imp.repeated,
      balances: imp.savedAt ? await this.balanceRows(user.id, imp, accountLabel) : null,
    };
  }

  private async balanceRows(userId: string, imp: ImportWithOperations, label: (id: string) => string | null): Promise<ImportView['balances']> {
    const accountIds = this.cardsOf(imp).flatMap((c) => (c.accountId ? [c.accountId] : []));
    const rows = await this.ledger.compareWithBank(userId, accountIds);
    return rows.flatMap(({ accountId, bank, ledger }) => {
      const card = label(accountId);
      return card ? [{ card, bank, ledger }] : [];
    });
  }

  /** Live categories of both types, subcategories included. */
  async categoryList(userId: string): Promise<Category[]> {
    const roots = await this.categories.findAll(userId);
    return roots.flatMap((root) => [root, ...(root.children ?? [])]);
  }

  /**
   * Proposes a resolution for every operation (see card-planner.ts), asking the AI only about the
   * shops nothing else could place.
   */
  private async plan(user: User, imp: ImportWithOperations): Promise<void> {
    const ops = imp.operations.filter((op) => op.status === 'PENDING' && op.resolution === null && op.card.accountId);
    if (ops.length === 0) return this.repository.markPlanned(user.id, imp.id);
    const inputs: PlanInput[] = ops.map((op) => ({
      id: op.id,
      cardId: op.cardId,
      accountId: op.card.accountId ?? '',
      direction: op.direction,
      amount: op.amount,
      merchant: op.merchant,
      occurredAt: op.occurredAt,
      date: formatIsoDate(op.date),
      reversal: op.reversal,
    }));
    const categories = await this.categoryList(user.id);
    const memory = await this.repository.memory(user.id, [...inputs.filter(isShopPurchase).map((i) => merchantKey(i.merchant)), FEE_MERCHANT_KEY]);
    const earliest = Math.min(...ops.map((op) => op.occurredAt.getTime()));
    const [manual, savedPurchases] = await Promise.all([
      this.repository.manualEntries(user.id, [...new Set(ops.map((op) => op.date.getTime()))].map((t) => new Date(t)), ops.map((op) => op.amount)),
      this.repository.savedPurchases(user.id, [...new Set(ops.map((op) => op.cardId))], new Date(earliest - REFUND_LOOKBACK_MS)),
    ]);
    const feeCategoryId =
      memory.get(FEE_MERCHANT_KEY) ?? categories.find((c) => c.type === 'EXPENSE' && FEE_CATEGORY_NAME.test(c.name))?.id ?? null;

    const plans = planImport(inputs, { categories, memory, feeCategoryId, manual, savedPurchases });

    const unknown = inputs.filter((i) => isShopPurchase(i) && plans.get(i.id)?.resolution === null);
    if (unknown.length > 0) {
      const expense = categories.filter((c) => c.type === 'EXPENSE');
      const placed = await this.classifier.classify(user.id, unknown.map((i) => i.merchant), expense.map((c) => c.name));
      for (const op of unknown) {
        const category = expense.find((c) => c.name === placed.get(op.merchant));
        if (category) plans.set(op.id, { ...UNDECIDED, resolution: 'EXPENSE', categoryId: category.id, categorySource: 'AI' });
      }
    }

    for (const [id, plan] of plans) {
      if (plan.resolution !== null || plan.pairedId !== null) await this.repository.updatePending(user.id, [id], plan);
    }
    await this.repository.markPlanned(user.id, imp.id);
  }

  /** "Uzcard •1234", or the same with a number when that name is taken (deleted accounts keep theirs). */
  private async createAccountFor(user: User, card: PaymentCard, ops: ImportOperation[]): Promise<string> {
    const base = cardLabel(card.network, card.last4);
    const taken = new Set(
      (await this.prisma.account.findMany({ where: { userId: user.id, name: { startsWith: base } }, select: { name: true } })).map((a) =>
        a.name.toLowerCase(),
      ),
    );
    let name = base;
    for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${base} (${n})`;

    // The bank tells the balance after each operation, so the one before the earliest is known.
    const first = [...ops].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime()).find((op) => op.balanceAfter !== null);
    const openingBalance = first?.balanceAfter
      ? first.balanceAfter + (first.direction === 'DEBIT' ? first.amount : -first.amount)
      : 0n;
    const account = await this.accounts.create(user.id, {
      name,
      type: 'CARD',
      currency: 'UZS',
      openingBalance,
      icon: '💳',
      color: card.network === 'HUMO' ? '#0ea5e9' : '#2563eb',
      isDefault: false,
    });
    await this.balances.invalidate(user.id);
    return account.id;
  }

  private cardsOf(imp: ImportWithOperations): PaymentCard[] {
    const cards = new Map<string, PaymentCard>();
    for (const op of imp.operations) cards.set(op.card.id, op.card);
    return [...cards.values()].sort((a, b) => a.network.localeCompare(b.network) || a.last4.localeCompare(b.last4));
  }
}

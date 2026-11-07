import { CardCategorySource, CardResolution, TransactionType } from '@prisma/client';
import { MerchantKind, knownMerchantCategory, merchantKey, merchantKind } from './merchant';
import { GuessableCategory, guessCategory, normalizeText } from '../parsing/category-guesser';

/**
 * Proposes what each operation of an import is, before the person sees the list. Only what the
 * operations themselves prove is decided here: a refund and its purchase, a transfer between two
 * of the person's cards, money already typed in by hand, a shop of a known kind. Everything else
 * is left for the person (❓), never guessed into income or expense.
 */

/** Money moved between one's own cards lands within minutes, minus the processor's fee. */
const TRANSFER_WINDOW_MS = 15 * 60_000;
const MAX_FEE_PERCENT = 3n;
/** A refund comes back within weeks of its purchase, and never before it. */
const REFUND_WINDOW_MS = 45 * 24 * 3600_000;
const CLOCK_SLACK_MS = 60_000;
/** MerchantCategory key for the fee kept on a transfer between own cards. */
export const FEE_MERCHANT_KEY = '__FEE__';

const TRANSFER_KINDS: ReadonlySet<MerchantKind> = new Set(['OWN_TRANSFER', 'P2P']);
const DEBIT_TYPES: ReadonlySet<TransactionType> = new Set(['EXPENSE', 'LOAN_GIVEN', 'LOAN_REPAY_OUT', 'TRANSFER_OUT']);
const CREDIT_TYPES: ReadonlySet<TransactionType> = new Set(['INCOME', 'LOAN_TAKEN', 'LOAN_REPAY_IN', 'TRANSFER_IN']);
/** Card spending is often typed in on the default (cash) account; transfers and debts name the card's. */
const ANY_ACCOUNT_TYPES: ReadonlySet<TransactionType> = new Set(['EXPENSE', 'INCOME']);

export interface PlanInput {
  id: string;
  cardId: string;
  /** The card's account: every card has one before an import is planned. */
  accountId: string;
  direction: 'DEBIT' | 'CREDIT';
  amount: bigint;
  merchant: string;
  occurredAt: Date;
  date: string;
  reversal: boolean;
}

/** A live ledger row the person entered themselves, on one of the operations' dates. */
export interface ManualEntry {
  id: string;
  accountId: string;
  type: TransactionType;
  amount: bigint;
  date: string;
}

/** A purchase saved from an earlier import, which a refund in this one may cancel. */
export interface SavedPurchase {
  id: string;
  cardId: string;
  amount: bigint;
  merchant: string;
  occurredAt: Date;
  transactionId: string | null;
}

export interface PlanContext {
  /** Live categories of both types, subcategories included. */
  categories: GuessableCategory[];
  /** merchantKey → category id, already checked to be a live expense category. */
  memory: ReadonlyMap<string, string>;
  feeCategoryId: string | null;
  manual: ManualEntry[];
  savedPurchases: SavedPurchase[];
}

export interface OperationPlan {
  resolution: CardResolution | null;
  categoryId: string | null;
  categorySource: CardCategorySource | null;
  pairedId: string | null;
  transactionId: string | null;
}

export const UNDECIDED: Readonly<OperationPlan> = {
  resolution: null,
  categoryId: null,
  categorySource: null,
  pairedId: null,
  transactionId: null,
};

export function planImport(ops: PlanInput[], ctx: PlanContext): Map<string, OperationPlan> {
  const plans = new Map<string, OperationPlan>(ops.map((op) => [op.id, { ...UNDECIDED }]));
  const byTime = [...ops].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  const explained = new Set<string>();
  const set = (op: PlanInput, plan: Partial<OperationPlan>) => {
    plans.set(op.id, { ...UNDECIDED, ...plan });
    explained.add(op.id);
  };

  pairRefunds(byTime, ctx, set, explained);
  pairTransfers(byTime, ctx, set, explained);

  const usedManual = new Set<string>();
  for (const op of byTime) {
    if (explained.has(op.id)) continue;
    const types = op.direction === 'DEBIT' ? DEBIT_TYPES : CREDIT_TYPES;
    const entry = ctx.manual.find(
      (m) =>
        !usedManual.has(m.id) &&
        types.has(m.type) &&
        m.amount === op.amount &&
        m.date === op.date &&
        (ANY_ACCOUNT_TYPES.has(m.type) || m.accountId === op.accountId),
    );
    if (!entry) continue;
    usedManual.add(entry.id);
    set(op, { resolution: 'DUPLICATE', transactionId: entry.id });
  }

  for (const op of byTime) {
    if (explained.has(op.id) || !isShopPurchase(op)) continue;
    const category = shopCategory(op.merchant, ctx);
    if (category) set(op, { resolution: 'EXPENSE', ...category });
  }
  return plans;
}

/** Paying a shop: the one kind of operation whose category the shop's name can tell. */
export function isShopPurchase(op: Pick<PlanInput, 'direction' | 'merchant' | 'reversal'>): boolean {
  return op.direction === 'DEBIT' && !op.reversal && merchantKind(op.merchant) === 'SHOP';
}

/** The person's earlier choice for this shop, then the known chains, then words in the name. */
export function shopCategory(
  merchant: string,
  ctx: Pick<PlanContext, 'categories' | 'memory'>,
): { categoryId: string; categorySource: CardCategorySource } | null {
  const remembered = ctx.memory.get(merchantKey(merchant));
  if (remembered) return { categoryId: remembered, categorySource: 'MEMORY' };

  const expense = ctx.categories.filter((c) => c.type === 'EXPENSE');
  const names = knownMerchantCategory(merchant)?.map(normalizeText);
  const known = names && expense.find((c) => names.includes(normalizeText(c.name)));
  if (known) return { categoryId: known.id, categorySource: 'KNOWN' };

  const guess = guessCategory(merchant, 'EXPENSE', expense);
  return guess ? { categoryId: guess.id, categorySource: 'GUESS' } : null;
}

type Setter = (op: PlanInput, plan: Partial<OperationPlan>) => void;

/** A refund cancels its purchase: neither is income or expense. */
function pairRefunds(byTime: PlanInput[], ctx: PlanContext, set: Setter, explained: Set<string>): void {
  const usedSaved = new Set<string>();
  for (const refund of byTime) {
    if (refund.direction !== 'CREDIT' || !refund.reversal) continue;
    const key = merchantKey(refund.merchant);
    const sameMoney = (p: { cardId: string; amount: bigint; merchant: string; occurredAt: Date }) =>
      p.cardId === refund.cardId &&
      p.amount === refund.amount &&
      merchantKey(p.merchant) === key &&
      refundsWindow(p.occurredAt, refund.occurredAt);

    const purchase = byTime.find((p) => !explained.has(p.id) && p.direction === 'DEBIT' && !p.reversal && sameMoney(p));
    if (purchase) {
      set(purchase, { resolution: 'CANCELLED', pairedId: refund.id });
      set(refund, { resolution: 'CANCELLED', pairedId: purchase.id });
      continue;
    }
    const saved = ctx.savedPurchases.find((p) => !usedSaved.has(p.id) && p.transactionId !== null && sameMoney(p));
    if (saved) {
      usedSaved.add(saved.id);
      set(refund, { resolution: 'CANCELLED', pairedId: saved.id, transactionId: saved.transactionId });
    }
  }
}

/**
 * The same money leaving one of the person's cards and reaching another within minutes is a
 * transfer between them. What the receiving card got less is the processor's fee, an expense.
 */
function pairTransfers(byTime: PlanInput[], ctx: PlanContext, set: Setter, explained: Set<string>): void {
  const gap = (a: PlanInput, b: PlanInput) => Math.abs(a.occurredAt.getTime() - b.occurredAt.getTime());
  for (const out of byTime) {
    if (explained.has(out.id) || out.direction !== 'DEBIT' || !TRANSFER_KINDS.has(merchantKind(out.merchant))) continue;
    const [into] = byTime
      .filter(
        (c) =>
          !explained.has(c.id) &&
          c.direction === 'CREDIT' &&
          !c.reversal &&
          TRANSFER_KINDS.has(merchantKind(c.merchant)) &&
          c.cardId !== out.cardId &&
          c.accountId !== out.accountId &&
          c.amount <= out.amount &&
          (out.amount - c.amount) * 100n <= out.amount * MAX_FEE_PERCENT &&
          gap(out, c) <= TRANSFER_WINDOW_MS,
      )
      .sort((a, b) => Number(b.amount - a.amount) || gap(out, a) - gap(out, b));
    if (!into) continue;

    const hasFee = out.amount > into.amount;
    // A fee needs an expense category; until the person has chosen one, the pair waits for them.
    const resolution = !hasFee || ctx.feeCategoryId ? 'TRANSFER' : null;
    const fee = hasFee && ctx.feeCategoryId ? { categoryId: ctx.feeCategoryId, categorySource: 'MEMORY' as const } : {};
    set(out, { resolution, pairedId: into.id, ...fee });
    set(into, { resolution, pairedId: out.id });
  }
}

function refundsWindow(purchasedAt: Date, refundedAt: Date): boolean {
  const delta = refundedAt.getTime() - purchasedAt.getTime();
  return delta >= -CLOCK_SLACK_MS && delta <= REFUND_WINDOW_MS;
}

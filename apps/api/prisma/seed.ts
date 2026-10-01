/* Demo data for local development: one user with ~3 months of realistic ledger history. */
import { PrismaClient, Prisma, TransactionType } from '@prisma/client';
import { DEFAULT_ACCOUNT, DEFAULT_CATEGORIES } from '../src/modules/auth/user-defaults';

/**
 * Sign-in is Telegram-only, so the demo user is keyed by a fake Telegram id. To use it locally,
 * set DEMO_TELEGRAM_ID to your own Telegram user id before seeding; then "Telegram orqali kirish"
 * signs you straight into the demo data.
 */
const DEMO_TELEGRAM_ID = BigInt(process.env.DEMO_TELEGRAM_ID ?? '100000001');
const SOM = 100n;

const prisma = new PrismaClient();

// Deterministic PRNG so every developer gets the same demo numbers.
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function utcDate(daysAgo: number): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysAgo));
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production' && process.env.SEED_ALLOW_PRODUCTION !== 'true') {
    throw new Error('Refusing to seed a production database (set SEED_ALLOW_PRODUCTION=true to override).');
  }

  const existing = await prisma.user.findFirst({ where: { telegramId: DEMO_TELEGRAM_ID } });
  if (existing) {
    console.log(`Demo user (telegram ${DEMO_TELEGRAM_ID}) already exists — skipping.`);
    return;
  }

  const rand = mulberry32(20260801);

  await prisma.$transaction(
    async (tx) => {
      const user = await tx.user.create({
        data: { telegramId: DEMO_TELEGRAM_ID, name: 'Aziz Karimov', telegramUsername: 'demo_user' },
      });

      await tx.category.createMany({
        data: DEFAULT_CATEGORIES.map((c) => ({ ...c, userId: user.id, isSystem: true })),
      });
      const categories = await tx.category.findMany({ where: { userId: user.id } });
      const byName = new Map(categories.map((c) => [c.name, c]));
      const expenseCats = categories.filter((c) => c.type === 'EXPENSE');

      const cash = await tx.account.create({
        data: { ...DEFAULT_ACCOUNT, userId: user.id, isDefault: true, openingBalance: 500_000n * SOM },
      });
      const card = await tx.account.create({
        data: {
          userId: user.id,
          name: 'Humo karta',
          type: 'CARD',
          icon: '💳',
          color: '#6366f1',
          sortOrder: 2,
          openingBalance: 2_000_000n * SOM,
        },
      });

      const rows: Prisma.TransactionCreateManyInput[] = [];
      for (let daysAgo = 90; daysAgo >= 0; daysAgo--) {
        const date = utcDate(daysAgo);
        if (date.getUTCDate() === 5) {
          rows.push({
            userId: user.id,
            accountId: card.id,
            type: TransactionType.INCOME,
            amount: 8_500_000n * SOM,
            categoryId: byName.get('Oylik')?.id,
            date,
            note: 'Oylik maosh',
          });
        }
        const count = Math.floor(rand() * 3);
        for (let i = 0; i < count; i++) {
          const category = expenseCats[Math.floor(rand() * expenseCats.length)];
          const som = BigInt(Math.round((5_000 + rand() * 195_000) / 1000) * 1000);
          rows.push({
            userId: user.id,
            accountId: rand() < 0.6 ? card.id : cash.id,
            type: TransactionType.EXPENSE,
            amount: som * SOM,
            categoryId: category.id,
            date,
            note: `${category.name} xarajati`,
          });
        }
      }
      await tx.transaction.createMany({ data: rows });

      const debt = await tx.debt.create({
        data: {
          userId: user.id,
          direction: 'I_LENT',
          personName: 'Jasur',
          personPhone: '+998901234567',
          amount: 1_000_000n * SOM,
          dueDate: utcDate(-10),
          status: 'PARTIALLY_PAID',
          note: 'To‘yga',
        },
      });
      await tx.transaction.create({
        data: {
          userId: user.id,
          accountId: cash.id,
          type: TransactionType.LOAN_GIVEN,
          amount: debt.amount,
          debtId: debt.id,
          date: utcDate(40),
        },
      });
      const repayTx = await tx.transaction.create({
        data: {
          userId: user.id,
          accountId: cash.id,
          type: TransactionType.LOAN_REPAY_IN,
          amount: 400_000n * SOM,
          debtId: debt.id,
          date: utcDate(15),
        },
      });
      await tx.debtPayment.create({
        data: { debtId: debt.id, transactionId: repayTx.id, amount: repayTx.amount, paidAt: repayTx.date },
      });

      const food = byName.get('Oziq-ovqat');
      if (food) {
        const today = utcDate(0);
        await tx.budget.create({
          data: {
            userId: user.id,
            categoryId: food.id,
            month: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)),
            limitAmount: 1_500_000n * SOM,
          },
        });
      }

      console.log(`Seeded demo user (telegram ${DEMO_TELEGRAM_ID}) with ${rows.length + 2} transactions.`);
    },
    { timeout: 60_000 },
  );
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

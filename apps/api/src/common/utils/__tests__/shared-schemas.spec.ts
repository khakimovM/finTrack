import {
  CreateAccountInputSchema,
  CreateDebtInputSchema,
  CreateRecurringRuleInputSchema,
  CreateTransactionInputSchema,
  ListTransactionsQuerySchema,
  StatsTimeseriesQuerySchema,
  positiveTiyinSchema,
} from '@fintrack/shared';

const UUID = '11111111-1111-1111-1111-111111111111';

describe('shared validation schemas', () => {
  describe('amounts', () => {
    it('accepts up to 18 digits and rejects values that would overflow BIGINT', () => {
      expect(positiveTiyinSchema.safeParse('999999999999999999').success).toBe(true);
      expect(positiveTiyinSchema.safeParse('9999999999999999999').success).toBe(false);
    });

    it.each(['0', '-1', '01', '1.5', '1e3', ''])('rejects %p', (value) => {
      expect(positiveTiyinSchema.safeParse(value).success).toBe(false);
    });
  });

  describe('dates', () => {
    const base = { type: 'EXPENSE', accountId: UUID, amount: '100', categoryId: UUID };

    it('rejects calendar dates that do not exist', () => {
      expect(CreateTransactionInputSchema.safeParse({ ...base, date: '2026-02-31' }).success).toBe(false);
      expect(CreateTransactionInputSchema.safeParse({ ...base, date: '2028-02-29' }).success).toBe(true);
    });

    it('rejects from > to on list filters', () => {
      const res = ListTransactionsQuerySchema.safeParse({ from: '2026-09-10', to: '2026-09-01' });
      expect(res.success).toBe(false);
    });

    it('caps daily time series at roughly a year of buckets', () => {
      expect(
        StatsTimeseriesQuerySchema.safeParse({ groupBy: 'day', from: '2026-01-01', to: '2026-12-31' }).success,
      ).toBe(true);
      expect(
        StatsTimeseriesQuerySchema.safeParse({ groupBy: 'day', from: '1900-01-01', to: '2026-12-31' }).success,
      ).toBe(false);
      expect(
        StatsTimeseriesQuerySchema.safeParse({ groupBy: 'month', from: '2000-01-01', to: '2026-12-31' }).success,
      ).toBe(true);
    });
  });

  describe('write schemas', () => {
    it('reject unknown keys (e.g. a smuggled userId)', () => {
      const res = CreateAccountInputSchema.safeParse({ name: 'Karta', type: 'CARD', userId: UUID });
      expect(res.success).toBe(false);
    });

    it('only allow UZS until multi-currency exists', () => {
      expect(CreateAccountInputSchema.safeParse({ name: 'Karta', type: 'CARD', currency: 'USD' }).success).toBe(
        false,
      );
    });

    it('treat empty optional form fields as null', () => {
      const res = CreateDebtInputSchema.parse({
        direction: 'I_LENT',
        personName: 'Jasur',
        personPhone: '',
        accountId: UUID,
        amount: '100',
        dueDate: '',
      });
      expect(res.personPhone).toBeNull();
      expect(res.dueDate).toBeNull();
    });

    it('recurring rules need endsAt >= startsAt and a weekday for weekly rules', () => {
      const base = { accountId: UUID, type: 'EXPENSE', amount: '1', startsAt: '2026-09-10' };
      expect(
        CreateRecurringRuleInputSchema.safeParse({ ...base, frequency: 'MONTHLY', endsAt: '2026-09-01' }).success,
      ).toBe(false);
      expect(CreateRecurringRuleInputSchema.safeParse({ ...base, frequency: 'WEEKLY', dayOfCycle: 9 }).success).toBe(
        false,
      );
      expect(CreateRecurringRuleInputSchema.safeParse({ ...base, frequency: 'WEEKLY', dayOfCycle: 3 }).success).toBe(
        true,
      );
    });
  });
});

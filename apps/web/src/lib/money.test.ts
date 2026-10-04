import { describe, expect, it } from 'vitest';
import { formatAmount, formatAmountNumber, MINUS, NBSP, shortMoney, shortSom, signOf, toneOf } from './money';

const nb = (text: string) => text.replace(/ /g, NBSP);

describe('amount formatting', () => {
  it('groups thousands with a no-break space and drops ",00"', () => {
    expect(formatAmountNumber('4305000000')).toBe(nb('43 050 000'));
    expect(formatAmountNumber('150050')).toBe(nb('1 500,50'));
    expect(formatAmountNumber('-3500000')).toBe(nb('35 000'));
  });

  it('adds the currency and the requested sign', () => {
    expect(formatAmount('970000000', { sign: '+' })).toBe(nb('+9 700 000 so‘m'));
    expect(formatAmount('638000000', { sign: '-' })).toBe(`${MINUS}${nb('6 380 000 so‘m')}`);
    expect(formatAmount('-50000', { sign: 'auto' })).toBe(`${MINUS}${nb('500 so‘m')}`);
    expect(formatAmount('0', { sign: 'auto' })).toBe(nb('0 so‘m'));
    expect(formatAmount('120000', { currency: false })).toBe(nb('1 200'));
  });

  it('gives transfers and debt movements no sign', () => {
    expect(signOf(toneOf('INCOME'))).toBe('+');
    expect(signOf(toneOf('EXPENSE'))).toBe('-');
    expect(signOf(toneOf('TRANSFER_OUT'))).toBe('none');
    expect(signOf(toneOf('LOAN_GIVEN'))).toBe('none');
    expect(signOf(toneOf('LOAN_REPAY_IN'))).toBe('none');
  });
});

describe('short chart labels', () => {
  it('uses ming, mln and mlrd with one comma decimal', () => {
    expect(shortSom(250_000)).toBe('250 ming');
    expect(shortSom(1_500_000)).toBe('1,5 mln');
    expect(shortSom(6_380_000)).toBe('6,4 mln');
    expect(shortSom(10_000_000)).toBe('10 mln');
    expect(shortSom(2_000_000_000)).toBe('2 mlrd');
    expect(shortSom(800)).toBe('800');
    expect(shortSom(-1_200_000)).toBe(`${MINUS}1,2 mln`);
  });

  it('reads tiyin strings from the API', () => {
    expect(shortMoney('638000000')).toBe('6,4 mln');
  });
});

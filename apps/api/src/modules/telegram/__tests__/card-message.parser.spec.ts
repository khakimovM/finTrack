import { parseBankAmount, parseCardMessage } from '../cards/card-message.parser';
import { knownMerchantCategory, merchantKey, merchantKind } from '../cards/merchant';
import { HUMO, UZCARD } from './fixtures/card-messages';

const operation = (text: string, network: 'UZCARD' | 'HUMO' = 'UZCARD') => {
  const parsed = parseCardMessage(text, network);
  if (parsed.kind !== 'operation') throw new Error(`not an operation: ${parsed.reason}`);
  return parsed.operation;
};

describe('parseCardMessage: Uzcard (CardXabar)', () => {
  it('reads a purchase: amount, card, merchant without the address, time and the balance after', () => {
    expect(operation(UZCARD.purchase)).toEqual({
      network: 'UZCARD',
      last4: '1111',
      direction: 'DEBIT',
      amount: 1_845_000n,
      merchant: 'ANGLESEY FOOD',
      label: 'Pokupka',
      date: '2026-10-31',
      time: '21:14',
      balanceAfter: 35_241_840n,
      reversal: false,
    });
  });

  it('reads money coming in, including amounts in the millions with tiyin', () => {
    expect(operation(UZCARD.transferIn)).toMatchObject({ direction: 'CREDIT', amount: 7_500_000n, merchant: 'CLICK P2P H2UEW' });
    expect(operation(UZCARD.topUp)).toMatchObject({ direction: 'CREDIT', amount: 174_230_550n, balanceAfter: 174_955_566n, last4: '2222' });
  });

  it('marks a cancelled payment coming back as a reversal', () => {
    expect(operation(UZCARD.refund)).toMatchObject({ direction: 'CREDIT', reversal: true, merchant: 'OOO UZUM' });
    expect(operation(UZCARD.purchase).reversal).toBe(false);
  });

  it('skips a refused payment, the balance summary and the bot’s own messages', () => {
    expect(parseCardMessage(UZCARD.declined, 'UZCARD')).toEqual({ kind: 'ignored', reason: 'declined' });
    expect(parseCardMessage(UZCARD.totalBalance, 'UZCARD')).toEqual({ kind: 'ignored', reason: 'not-an-operation' });
    expect(parseCardMessage(UZCARD.welcome, 'UZCARD')).toEqual({ kind: 'ignored', reason: 'not-an-operation' });
    expect(parseCardMessage('', 'UZCARD')).toEqual({ kind: 'ignored', reason: 'not-an-operation' });
  });

  it('does not depend on the language of the labels, only on the emoji lines', () => {
    for (const label of ['Покупка', 'Xarid', 'Харид', 'Purchase']) {
      expect(operation(UZCARD.purchase.replace('Pokupka', label))).toMatchObject({ label, amount: 1_845_000n, direction: 'DEBIT' });
    }
    expect(operation(UZCARD.refund.replace('OTMENA', 'Отмена')).reversal).toBe(true);
    expect(operation(UZCARD.refund.replace('OTMENA E-Com oplata', 'Cancel of e-com payment')).reversal).toBe(true);
  });

  it('leaves foreign-currency operations to be entered by hand', () => {
    expect(parseCardMessage(UZCARD.ecom.replace('12 800.00 UZS', '12.50 USD'), 'UZCARD')).toEqual({
      kind: 'ignored',
      reason: 'foreign-currency',
    });
  });

  it('copes with non-breaking spaces and a missing balance line', () => {
    const text = UZCARD.ecom.replace('12 800.00', '12 800.00').split('\n').slice(0, 5).join('\n');
    expect(operation(text)).toMatchObject({ amount: 1_280_000n, balanceAfter: null, merchant: 'OOO WB TAXI' });
  });
});

describe('parseCardMessage: Humo', () => {
  it('reads the Humo layout: time before date, dots for thousands, commas for tiyin', () => {
    expect(operation(HUMO.payment, 'HUMO')).toEqual({
      network: 'HUMO',
      last4: '3333',
      direction: 'DEBIT',
      amount: 170_000n,
      merchant: 'TRANSPORT TOLOV>M U',
      label: "To'lov",
      date: '2026-02-19',
      time: '08:00',
      balanceAfter: 99_594n,
      reversal: false,
    });
    expect(operation(HUMO.topUp, 'HUMO')).toMatchObject({ direction: 'CREDIT', amount: 110_000n, balanceAfter: 209_594n });
  });
});

describe('parseBankAmount', () => {
  it('tells the decimal separator from the thousands one by the two digits after it', () => {
    expect(parseBankAmount('40 440.00')).toBe(4_044_000n);
    expect(parseBankAmount('1.700,00')).toBe(170_000n);
    expect(parseBankAmount('1.700')).toBe(170_000n);
    expect(parseBankAmount('995,94')).toBe(99_594n);
    expect(parseBankAmount('1 742 305.50')).toBe(174_230_550n);
    expect(parseBankAmount('12')).toBe(1_200n);
    expect(parseBankAmount('abc')).toBeNull();
  });
});

describe('merchants', () => {
  it('keys a merchant the same way however it was spaced or cased', () => {
    expect(merchantKey('  ooo   atto tolov ')).toBe('OOO ATTO TOLOV');
  });

  it('tells own-card transfers, P2P and payment services apart from shops', () => {
    for (const m of ['UZCARD TO VISA', 'UB VISA TO UZCARD', 'UB P2P UZCARD2HUMO', 'UB P2P HUMO2UZCARD']) {
      expect(merchantKind(m)).toBe('OWN_TRANSFER');
    }
    for (const m of ['CLICK P2P U2HEW', 'CLICK P2P', 'PAYME P2P', 'CLICK P2P UZCARD ANY   UZCARD XB', 'CLICK P2P>TOSHKENT S']) {
      expect(merchantKind(m)).toBe('P2P');
    }
    for (const m of ['AO CLICK', 'CLICK OPLATA']) expect(merchantKind(m)).toBe('PAYMENT_SERVICE');
    for (const m of ['OOO UZUM', 'YANDEXGO UB SCOOTER OPLATA', 'OCTOBANK YANDEXPLUS OPLATA', 'ANGLESEY FOOD']) {
      expect(merchantKind(m)).toBe('SHOP');
    }
  });

  it('knows the category of common merchants, and says nothing about the rest', () => {
    expect(knownMerchantCategory('OOO ATTO TOLOV')).toContain('Transport');
    expect(knownMerchantCategory('TRANSPORT TOLOV>M U')).toContain('Transport');
    expect(knownMerchantCategory('YANDEXGO UB SCOOTER OPLATA')).toContain('Transport');
    expect(knownMerchantCategory('OOO WB TAXI')).toContain('Transport');
    expect(knownMerchantCategory('OCTOBANK YANDEXPLUS OPLATA')).toContain("Ko'ngilochar");
    expect(knownMerchantCategory('ANGLESEY FOOD')).toContain('Oziq-ovqat');
    expect(knownMerchantCategory('LLC MADINA QANDOLAT')).toContain('Oziq-ovqat');
    expect(knownMerchantCategory('OKEAN FARM GLOBAL MASULIYATI C')).toContain("Sog'liq");
    expect(knownMerchantCategory('XALQ RETAIL MCHJ KHK')).toBeNull();
    expect(knownMerchantCategory('OOO UZUM')).toBeNull();
  });
});

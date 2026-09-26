import {
  somToTiyin,
  tiyinToSom,
  formatMoney,
  addMoney,
  subMoney,
  InvalidAmountError,
} from '@fintrack/shared';

describe('Money Utilities (@fintrack/shared)', () => {
  describe('somToTiyin', () => {
    it('converts 0 som to 0n tiyin', () => {
      expect(somToTiyin('0')).toBe(0n);
      expect(somToTiyin(0)).toBe(0n);
      expect(somToTiyin('0.00')).toBe(0n);
    });

    it('converts 0.01 som to 1n tiyin', () => {
      expect(somToTiyin('0.01')).toBe(1n);
    });

    it('converts 0.99 som to 99n tiyin', () => {
      expect(somToTiyin('0.99')).toBe(99n);
    });

    it('converts 1.00 som to 100n tiyin', () => {
      expect(somToTiyin('1')).toBe(100n);
      expect(somToTiyin('1.00')).toBe(100n);
      expect(somToTiyin(1)).toBe(100n);
    });

    it('handles formatted som with spaces and commas', () => {
      expect(somToTiyin('1 500,50')).toBe(150050n);
      expect(somToTiyin('12 345 678,90')).toBe(1234567890n);
    });

    it('handles negative som amounts', () => {
      expect(somToTiyin('-50.25')).toBe(-5025n);
      expect(somToTiyin('-1 500,00')).toBe(-150000n);
    });

    it('handles values larger than Number.MAX_SAFE_INTEGER', () => {
      const hugeSom = '9007199254740992.50'; // > MAX_SAFE_INTEGER (9007199254740991)
      const expectedTiyin = 900719925474099250n;
      expect(somToTiyin(hugeSom)).toBe(expectedTiyin);
    });

    it('throws InvalidAmountError for invalid strings', () => {
      expect(() => somToTiyin('abc')).toThrow(InvalidAmountError);
      expect(() => somToTiyin('12.345')).toThrow(InvalidAmountError); // more than 2 decimal places
      expect(() => somToTiyin('')).toThrow(InvalidAmountError);
    });
  });

  describe('tiyinToSom', () => {
    it('converts 0 tiyin to "0.00"', () => {
      expect(tiyinToSom(0n)).toBe('0.00');
      expect(tiyinToSom('0')).toBe('0.00');
    });

    it('converts 1 tiyin to "0.01"', () => {
      expect(tiyinToSom(1n)).toBe('0.01');
    });

    it('converts 99 tiyin to "0.99"', () => {
      expect(tiyinToSom(99n)).toBe('0.99');
    });

    it('converts 100 tiyin to "1.00"', () => {
      expect(tiyinToSom(100n)).toBe('1.00');
    });

    it('converts 150050 tiyin to "1500.50"', () => {
      expect(tiyinToSom(150050n)).toBe('1500.50');
    });

    it('converts negative tiyin to negative decimal string', () => {
      expect(tiyinToSom(-5025n)).toBe('-50.25');
    });

    it('handles values larger than Number.MAX_SAFE_INTEGER', () => {
      const hugeTiyin = 900719925474099250n;
      expect(tiyinToSom(hugeTiyin)).toBe('9007199254740992.50');
    });
  });

  describe('round-trip conversion', () => {
    it('somToTiyin(tiyinToSom(x)) === x for various values', () => {
      const testCases = [0n, 1n, 99n, 100n, 150050n, -5025n, 900719925474099250n];
      for (const val of testCases) {
        expect(somToTiyin(tiyinToSom(val))).toBe(val);
      }
    });
  });

  describe('formatMoney', () => {
    it('formats positive and negative amounts in Uzbek som format', () => {
      expect(formatMoney(150050n)).toBe('1 500,50 so‘m');
      expect(formatMoney(150000n)).toBe('1 500 so‘m');
      expect(formatMoney(-5025n)).toBe('-50,25 so‘m');
      expect(formatMoney(0n)).toBe('0 so‘m');
    });

    it('supports custom currency and forced fraction display', () => {
      expect(formatMoney(150000n, { showFraction: true })).toBe('1 500,00 so‘m');
      expect(formatMoney(100000n, { currency: 'USD' })).toBe('1 000 USD');
    });
  });

  describe('addMoney and subMoney', () => {
    it('adds multiple tiyin values accurately', () => {
      expect(addMoney(100n, 250n, '50')).toBe(400n);
    });

    it('subtracts tiyin values accurately', () => {
      expect(subMoney(500n, 150n)).toBe(350n);
      expect(subMoney(100n, 250n)).toBe(-150n);
    });
  });
});
